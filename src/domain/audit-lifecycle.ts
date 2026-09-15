// Project Audit Lifecycle State Machine
// Authoritative source: docs/specs/04-state-machine.md §2, §7 (INV-02, INV-03, INV-05, INV-08, INV-10), §8
// Rule: Pure function. No I/O, no DB imports, no clock imports.

import type {
  AuditState,
  DomainErrorCode,
  Effect,
} from './types';

export interface ClusterAnswer {
  clusterKey: string;
  answers: Record<string, boolean>;
}

export interface AuditSnapshot {
  audit: AuditState;
  hasAsset: boolean;
  hasTaskTemplate: boolean;
  witnessTarget: number;
  witnessCount: number;
  distinctClusterKeys: string[];
  confirmedAt?: Date | null;
  expiresAt?: Date | null;
}

export type AuditEvent =
  | {
      type: 'TASK_CREATED';
      taskId: string;
      assetId: string;
      expiresAt: Date;
      witnessTarget?: number;
      at: Date;
    }
  | {
      type: 'FIRST_OBSERVATION';
      clusterKey: string;
      weight: number;
      at: Date;
    }
  | {
      type: 'THRESHOLD_MET_CONSISTENT';
      clusterAnswers: ClusterAnswer[];
      at: Date;
    }
  | {
      type: 'THRESHOLD_MET_CONFLICTING';
      clusterAnswers: ClusterAnswer[];
      at: Date;
    }
  | {
      type: 'CONTRADICTS_OFFICIAL_CLAIM';
      contradictingClustersCount: number;
      at: Date;
    }
  | {
      type: 'LATE_CONTRADICTION';
      contradictingClustersCount: number;
      at: Date;
    }
  | {
      type: 'TASK_EXPIRED';
      at: Date;
    }
  | {
      type: 'DUPLICATE_OBSERVATION';
      clusterKey: string;
      at: Date;
    };

export type AuditResult =
  | {
      ok: true;
      next: AuditState;
      effects: Effect[];
    }
  | {
      ok: false;
      code: DomainErrorCode;
      message: string;
      effects: never[];
    };

/**
 * Computes the multi-witness agreement ratio across distinct clusters.
 *
 * Per 04-state-machine.md §2 (line 51):
 * "for each question, compute the majority answer across distinct clusters.
 * Agreement = (clusters agreeing with majority) / (clusters answering).
 * If any question falls below 2/3, the result is DISCREPANCY_FLAGGED, not PHYSICALLY_CONFIRMED."
 */
export function calculateAgreement(clusterAnswers: ClusterAnswer[]): {
  isConsistent: boolean;
  minAgreement: number;
  distinctClusterCount: number;
  perQuestion: Record<string, number>;
} {
  // Deduplicate by clusterKey to enforce INV-02
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

  // Collect all distinct question IDs
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
        } else {
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
    // Using integer arithmetic majorityVotes * 3 >= totalVotes * 2 to avoid float inaccuracies
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
 * Pure transition function for the Project Audit Lifecycle.
 *
 * Implements 04-state-machine.md §2:
 * 1. NOT_DISPATCHED -> TASK_CREATED -> TASK_DISPATCHED
 * 2. TASK_DISPATCHED -> FIRST_OBSERVATION -> AWAITING_THRESHOLD
 * 3. AWAITING_THRESHOLD -> THRESHOLD_MET_CONSISTENT -> PHYSICALLY_CONFIRMED
 * 4. AWAITING_THRESHOLD -> THRESHOLD_MET_CONFLICTING -> DISCREPANCY_FLAGGED
 * 5. AWAITING_THRESHOLD -> CONTRADICTS_OFFICIAL_CLAIM -> DISCREPANCY_FLAGGED
 * 6. PHYSICALLY_CONFIRMED -> LATE_CONTRADICTION -> DISCREPANCY_FLAGGED
 * 7. AWAITING_THRESHOLD -> TASK_EXPIRED -> AWAITING_THRESHOLD (state unchanged)
 * 8. ANY STATE -> DUPLICATE_OBSERVATION -> SAME STATE (state unchanged)
 */
export function transition(
  current: AuditSnapshot,
  event: AuditEvent
): AuditResult {
  switch (event.type) {
    case 'TASK_CREATED': {
      // Guard: must be in NOT_DISPATCHED
      if (current.audit !== 'NOT_DISPATCHED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot create inspection task when audit state is '${current.audit}'; expected 'NOT_DISPATCHED'`,
          effects: [],
        };
      }

      // Guard: project has >= 1 asset
      if (!current.hasAsset) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Cannot dispatch task: project has no associated physical assets',
          effects: [],
        };
      }

      // Guard: asset_type has a task template
      if (!current.hasTaskTemplate) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Cannot dispatch task: asset type has no inspection question template',
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'CREATE_TASK',
          taskId: event.taskId,
          assetId: event.assetId,
          expiresAt: event.expiresAt.toISOString(),
        },
        {
          kind: 'ENQUEUE_OUTBOX',
          templateKey: 'TASK_DISPATCHED_NOTIFICATION',
          recipientId: 'WARD_MONITORS',
        },
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'NOT_DISPATCHED',
            to: 'TASK_DISPATCHED',
            taskId: event.taskId,
            assetId: event.assetId,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'TASK_DISPATCHED',
        effects,
      };
    }

    case 'FIRST_OBSERVATION': {
      // Guard: must be in TASK_DISPATCHED
      if (current.audit !== 'TASK_DISPATCHED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot accept first observation from state '${current.audit}'; expected 'TASK_DISPATCHED'`,
          effects: [],
        };
      }

      // Guard: observation accepted with weight = 1 (first distinct cluster)
      if (event.weight !== 1) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'First observation must be from a new cluster with weight = 1',
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'RECOMPUTE_WITNESS_COUNT',
          witnessCount: 1,
          clusterKey: event.clusterKey,
        },
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'TASK_DISPATCHED',
            to: 'AWAITING_THRESHOLD',
            clusterKey: event.clusterKey,
            witnessCount: 1,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'AWAITING_THRESHOLD',
        effects,
      };
    }

    case 'THRESHOLD_MET_CONSISTENT': {
      // Guard: must be in AWAITING_THRESHOLD
      if (current.audit !== 'AWAITING_THRESHOLD') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot evaluate consistent threshold from state '${current.audit}'; expected 'AWAITING_THRESHOLD'`,
          effects: [],
        };
      }

      // Compute agreement across distinct clusters
      const agreement = calculateAgreement(event.clusterAnswers);

      // Guard: witness_count >= witness_target
      if (agreement.distinctClusterCount < current.witnessTarget) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Witness target not met: distinct clusters ${agreement.distinctClusterCount} < target ${current.witnessTarget}`,
          effects: [],
        };
      }

      // Guard: agreement >= 2/3 on EVERY question
      if (!agreement.isConsistent) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Answer agreement fell below 2/3 threshold on one or more questions (min agreement: ${(agreement.minAgreement * 100).toFixed(1)}%)`,
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'AWAITING_THRESHOLD',
            to: 'PHYSICALLY_CONFIRMED',
            witnessCount: agreement.distinctClusterCount,
            witnessTarget: current.witnessTarget,
            perQuestionAgreement: agreement.perQuestion,
            at: event.at.toISOString(),
          },
        },
        {
          kind: 'NOTIFY_MODERATOR',
          action: 'PHYSICAL_CONFIRMATION_ACHIEVED',
        },
        {
          kind: 'MARK_BULLETIN_ELIGIBLE',
        },
      ];

      return {
        ok: true,
        next: 'PHYSICALLY_CONFIRMED',
        effects,
      };
    }

    case 'THRESHOLD_MET_CONFLICTING': {
      // Guard: must be in AWAITING_THRESHOLD
      if (current.audit !== 'AWAITING_THRESHOLD') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot evaluate conflicting threshold from state '${current.audit}'; expected 'AWAITING_THRESHOLD'`,
          effects: [],
        };
      }

      // Compute agreement across distinct clusters
      const agreement = calculateAgreement(event.clusterAnswers);

      // Guard: witness_count >= witness_target
      if (agreement.distinctClusterCount < current.witnessTarget) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Witness target not met: distinct clusters ${agreement.distinctClusterCount} < target ${current.witnessTarget}`,
          effects: [],
        };
      }

      // Guard: agreement < 2/3 on at least one question
      if (agreement.isConsistent) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Answers are consistent across questions; expected conflicting threshold',
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'AWAITING_THRESHOLD',
            to: 'DISCREPANCY_FLAGGED',
            witnessCount: agreement.distinctClusterCount,
            witnessTarget: current.witnessTarget,
            perQuestionAgreement: agreement.perQuestion,
            at: event.at.toISOString(),
          },
        },
        {
          kind: 'ENQUEUE_MODERATOR',
          queue: 'DISCREPANCY_REVIEW',
        },
        {
          kind: 'PAUSE_PROBATION_CLOCK',
        },
      ];

      return {
        ok: true,
        next: 'DISCREPANCY_FLAGGED',
        effects,
      };
    }

    case 'CONTRADICTS_OFFICIAL_CLAIM': {
      // Guard: must be in AWAITING_THRESHOLD
      if (current.audit !== 'AWAITING_THRESHOLD') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot flag contradiction from state '${current.audit}'; expected 'AWAITING_THRESHOLD'`,
          effects: [],
        };
      }

      // Guard: at least 2 distinct clusters contradict official claim
      if (event.contradictingClustersCount < 2) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Requires >= 2 distinct clusters contradicting official claim; got ${event.contradictingClustersCount}`,
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'AWAITING_THRESHOLD',
            to: 'DISCREPANCY_FLAGGED',
            contradictingClustersCount: event.contradictingClustersCount,
            at: event.at.toISOString(),
          },
        },
        {
          kind: 'OPEN_RESPONSE_WINDOW',
          durationHours: 72,
        },
        {
          kind: 'PAUSE_PROBATION_CLOCK',
        },
      ];

      return {
        ok: true,
        next: 'DISCREPANCY_FLAGGED',
        effects,
      };
    }

    case 'LATE_CONTRADICTION': {
      // Guard: must be in PHYSICALLY_CONFIRMED
      if (current.audit !== 'PHYSICALLY_CONFIRMED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot process late contradiction from state '${current.audit}'; expected 'PHYSICALLY_CONFIRMED'`,
          effects: [],
        };
      }

      // Guard: at least 2 new distinct clusters contradict
      if (event.contradictingClustersCount < 2) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Requires >= 2 new distinct clusters contradicting; got ${event.contradictingClustersCount}`,
          effects: [],
        };
      }

      // Guard: within 30 days of confirmation
      if (!current.confirmedAt) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Missing confirmation timestamp on PHYSICALLY_CONFIRMED snapshot',
          effects: [],
        };
      }

      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const elapsed = event.at.getTime() - current.confirmedAt.getTime();

      if (elapsed < 0 || elapsed > THIRTY_DAYS_MS) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Late contradiction window expired: elapsed ${(elapsed / (24 * 60 * 60 * 1000)).toFixed(1)} days exceeds 30-day limit`,
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'PHYSICALLY_CONFIRMED',
            to: 'DISCREPANCY_FLAGGED',
            contradictingClustersCount: event.contradictingClustersCount,
            at: event.at.toISOString(),
          },
        },
        {
          kind: 'QUEUE_BULLETIN_CORRECTION',
        },
        {
          kind: 'PAUSE_PROBATION_CLOCK',
        },
      ];

      return {
        ok: true,
        next: 'DISCREPANCY_FLAGGED',
        effects,
      };
    }

    case 'TASK_EXPIRED': {
      // Guard: must be in AWAITING_THRESHOLD
      if (current.audit !== 'AWAITING_THRESHOLD') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot expire task from state '${current.audit}'; expected 'AWAITING_THRESHOLD'`,
          effects: [],
        };
      }

      // Guard: expiresAt must be defined and now > expiresAt
      if (!current.expiresAt || event.at.getTime() <= current.expiresAt.getTime()) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Task expiration time has not elapsed',
          effects: [],
        };
      }

      // Guard: threshold is unmet (witnessCount < witnessTarget)
      if (current.witnessCount >= current.witnessTarget) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Witness target already met; task cannot expire as unmet',
          effects: [],
        };
      }

      // State remains unchanged: AWAITING_THRESHOLD
      const effects: Effect[] = [
        {
          kind: 'CLOSE_TASK',
        },
        {
          kind: 'AUDIT',
          action: 'TASK_EXPIRED',
          payload: {
            state: 'AWAITING_THRESHOLD',
            witnessCount: current.witnessCount,
            witnessTarget: current.witnessTarget,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'AWAITING_THRESHOLD',
        effects,
      };
    }

    case 'DUPLICATE_OBSERVATION': {
      // Guard: cluster_key already present for this task
      const isDuplicate = current.distinctClusterKeys.includes(event.clusterKey);

      if (!isDuplicate) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Cluster key '${event.clusterKey}' is not present in existing clusters; cannot mark duplicate`,
          effects: [],
        };
      }

      // State remains exactly unchanged; weight = 0; audit as OBSERVATION_SUPPRESSED
      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'OBSERVATION_SUPPRESSED',
          payload: {
            clusterKey: event.clusterKey,
            weight: 0,
            currentState: current.audit,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: current.audit,
        effects,
      };
    }

    default: {
      const _exhaustive: never = event;
      return {
        ok: false,
        code: 'E_ILLEGAL_TRANSITION',
        message: `Unhandled event: ${JSON.stringify(_exhaustive)}`,
        effects: [],
      };
    }
  }
}
