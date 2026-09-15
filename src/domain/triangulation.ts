// Multi-Witness Triangulation and Agreement Domain Engine
// Authoritative sources: docs/specs/04-state-machine.md §2, §7 (INV-02, INV-08),
// docs/specs/07-trust-and-security.md §3, §4, docs/specs/10-skills.md S-05,
// docs/specs/02-architecture.md §2, §5 (Path B), docs/specs/03-data-model.md §4
// Rule: Pure function. Zero external I/O, no DB imports, no framework imports, no real clock reads.
// Trust boundary: Raw MSISDNs must NEVER enter this module (07 §5). Only opaque cluster_key values participate.

export interface ClusterAnswer {
  clusterKey: string;
  answers: Record<string, boolean>;
}

export interface ObservationWeightResult {
  weight: 0 | 1;
  isDuplicate: boolean;
  reasonKey?: string;
}

export interface AgreementResult {
  isConsistent: boolean;
  minAgreement: number;
  distinctClusterCount: number;
  perQuestion: Record<string, number>;
}

export interface OfficialClaimContradictionResult {
  contradicts: boolean;
  contradictingClustersCount: number;
  contradictingQuestions: string[];
}

export type TriangulationRecommendedEvent =
  | { type: 'THRESHOLD_MET_CONSISTENT'; clusterAnswers: ClusterAnswer[]; at: Date }
  | { type: 'THRESHOLD_MET_CONFLICTING'; clusterAnswers: ClusterAnswer[]; at: Date }
  | { type: 'CONTRADICTS_OFFICIAL_CLAIM'; contradictingClustersCount: number; at: Date };

export interface TriangulationParams {
  witnessTarget: number;
  witnessCount: number;
  clusterAnswers: ClusterAnswer[];
  officialClaims?: Record<string, boolean>;
  at?: Date;
}

export interface TriangulationEvaluation {
  witnessCount: number;
  witnessTarget: number;
  isThresholdMet: boolean;
  agreement: AgreementResult;
  contradiction: OfficialClaimContradictionResult;
  recommendedEvent?: TriangulationRecommendedEvent;
}

/**
 * Assigns weight to an incoming observation based on whether its cluster_key has already been observed for this task.
 *
 * Authoritative: 07 §3 lines 56-57:
 * - The first observation for a cluster_key on a task gets weight = 1.
 * - Every subsequent observation for that cluster_key is stored with weight = 0,
 *   returned to caller as counted: false with reasonKey "observation.cluster_already_counted",
 *   and audited as OBSERVATION_SUPPRESSED.
 */
export function assignObservationWeight(
  existingClusterKeys: Iterable<string>,
  incomingClusterKey: string
): ObservationWeightResult {
  if (!incomingClusterKey || typeof incomingClusterKey !== 'string') {
    throw new Error('incomingClusterKey must be a non-empty string');
  }

  const existingSet = existingClusterKeys instanceof Set
    ? existingClusterKeys
    : new Set(existingClusterKeys);

  if (existingSet.has(incomingClusterKey)) {
    return {
      weight: 0,
      isDuplicate: true,
      reasonKey: 'observation.cluster_already_counted',
    };
  }

  return {
    weight: 1,
    isDuplicate: false,
  };
}

/**
 * Computes witness count strictly enforcing INV-02:
 * witness_count = count(distinct cluster_key) where weight = 1
 *
 * Authoritative: 04 §7 line 130, 07 §3 line 53.
 * Observations with weight = 0 never count.
 */
export function countWitnesses(
  observations: Iterable<{ clusterKey: string; weight: number }>
): number {
  const distinctValidClusters = new Set<string>();

  for (const obs of observations) {
    if (obs.weight === 1 && obs.clusterKey) {
      distinctValidClusters.add(obs.clusterKey);
    }
  }

  return distinctValidClusters.size;
}

/**
 * Computes multi-witness agreement ratio across distinct clusters.
 *
 * Authoritative: 04-state-machine.md §2 line 51:
 * "for each question, compute the majority answer across distinct clusters.
 * Agreement = (clusters agreeing with majority) / (clusters answering).
 * If any question falls below 2/3, the result is DISCREPANCY_FLAGGED, not PHYSICALLY_CONFIRMED."
 *
 * Strict integer arithmetic: majorityVotes * 3 >= totalVotes * 2
 * avoids floating-point precision issues with 2/3 (0.6666...).
 */
export function calculateAgreement(clusterAnswers: ClusterAnswer[]): AgreementResult {
  // Deduplicate by clusterKey to enforce INV-02 (first observation per clusterKey wins)
  const uniqueByCluster = new Map<string, Record<string, boolean>>();
  for (const item of clusterAnswers) {
    if (!uniqueByCluster.has(item.clusterKey)) {
      uniqueByCluster.set(item.clusterKey, item.answers);
    }
  }

  const distinctClusterCount = uniqueByCluster.size;
  if (distinctClusterCount === 0) {
    return {
      isConsistent: false,
      minAgreement: 0,
      distinctClusterCount: 0,
      perQuestion: {},
    };
  }

  // Collect all distinct question IDs across answers
  const allQuestionIds = new Set<string>();
  for (const answers of uniqueByCluster.values()) {
    for (const qId of Object.keys(answers)) {
      allQuestionIds.add(qId);
    }
  }

  if (allQuestionIds.size === 0) {
    return {
      isConsistent: false,
      minAgreement: 0,
      distinctClusterCount,
      perQuestion: {},
    };
  }

  let minAgreement = 1.0;
  let isConsistent = true;
  const perQuestion: Record<string, number> = {};

  for (const qId of allQuestionIds) {
    let trueVotes = 0;
    let falseVotes = 0;

    for (const answers of uniqueByCluster.values()) {
      if (qId in answers) {
        if (answers[qId] === true) {
          trueVotes++;
        } else if (answers[qId] === false) {
          falseVotes++;
        }
      }
    }

    const totalVotes = trueVotes + falseVotes;
    if (totalVotes === 0) {
      continue;
    }

    const majorityVotes = Math.max(trueVotes, falseVotes);
    const agreement = majorityVotes / totalVotes;
    perQuestion[qId] = agreement;

    if (agreement < minAgreement) {
      minAgreement = agreement;
    }

    // Strict 2/3 threshold (majorityVotes / totalVotes >= 2/3)
    // Using integer arithmetic majorityVotes * 3 >= totalVotes * 2
    if (majorityVotes * 3 < totalVotes * 2) {
      isConsistent = false;
    }
  }

  return {
    isConsistent,
    minAgreement,
    distinctClusterCount,
    perQuestion,
  };
}

/**
 * Evaluates whether community observations contradict officially asserted claims.
 *
 * Authoritative: 04 §2 line 44:
 * ">=2 distinct clusters answer 'no' to a question the official record asserts"
 * -> CONTRADICTS_OFFICIAL_CLAIM -> DISCREPANCY_FLAGGED.
 */
export function checkOfficialClaimContradiction(
  clusterAnswers: ClusterAnswer[],
  officialClaims: Record<string, boolean> = {}
): OfficialClaimContradictionResult {
  const uniqueByCluster = new Map<string, Record<string, boolean>>();
  for (const item of clusterAnswers) {
    if (!uniqueByCluster.has(item.clusterKey)) {
      uniqueByCluster.set(item.clusterKey, item.answers);
    }
  }

  const contradictingQuestions: string[] = [];
  let maxContradictingClusters = 0;

  for (const [qId, expectedVal] of Object.entries(officialClaims)) {
    let contradictionCount = 0;

    for (const answers of uniqueByCluster.values()) {
      if (qId in answers && answers[qId] !== expectedVal) {
        contradictionCount++;
      }
    }

    if (contradictionCount > maxContradictingClusters) {
      maxContradictingClusters = contradictionCount;
    }

    // Spec: >= 2 distinct clusters contradicts official claim
    if (contradictionCount >= 2) {
      contradictingQuestions.push(qId);
    }
  }

  return {
    contradicts: contradictingQuestions.length > 0,
    contradictingClustersCount: maxContradictingClusters,
    contradictingQuestions,
  };
}

/**
 * Pure deterministic multi-witness triangulation evaluator.
 *
 * Synthesizes witness tally, agreement, and official claim contradiction into
 * the canonical AuditEvent type per 04-state-machine.md §2:
 * 1. If official claims are contradicted by >= 2 distinct clusters -> CONTRADICTS_OFFICIAL_CLAIM
 * 2. If witnessCount < witnessTarget -> AWAITING_THRESHOLD (no threshold transition)
 * 3. If witnessCount >= witnessTarget:
 *    - all questions >= 2/3 -> THRESHOLD_MET_CONSISTENT
 *    - any question < 2/3   -> THRESHOLD_MET_CONFLICTING
 */
export function evaluateTriangulation(params: TriangulationParams): TriangulationEvaluation {
  const contradiction = checkOfficialClaimContradiction(
    params.clusterAnswers,
    params.officialClaims || {}
  );
  const agreement = calculateAgreement(params.clusterAnswers);
  const isThresholdMet = params.witnessCount >= params.witnessTarget;
  const at = params.at || new Date('2026-09-15T00:00:00Z');

  let recommendedEvent: TriangulationRecommendedEvent | undefined;

  if (contradiction.contradicts) {
    recommendedEvent = {
      type: 'CONTRADICTS_OFFICIAL_CLAIM',
      contradictingClustersCount: contradiction.contradictingClustersCount,
      at,
    };
  } else if (isThresholdMet) {
    if (agreement.isConsistent && agreement.distinctClusterCount >= params.witnessTarget) {
      recommendedEvent = {
        type: 'THRESHOLD_MET_CONSISTENT',
        clusterAnswers: params.clusterAnswers,
        at,
      };
    } else {
      recommendedEvent = {
        type: 'THRESHOLD_MET_CONFLICTING',
        clusterAnswers: params.clusterAnswers,
        at,
      };
    }
  }

  return {
    witnessCount: params.witnessCount,
    witnessTarget: params.witnessTarget,
    isThresholdMet,
    agreement,
    contradiction,
    recommendedEvent,
  };
}
