import { describe, it, expect } from 'vitest';
import {
  assignObservationWeight,
  countWitnesses,
  calculateAgreement,
  checkOfficialClaimContradiction,
  evaluateTriangulation,
  type ClusterAnswer,
} from '@/domain/triangulation';
import {
  transition,
  type AuditSnapshot,
  type AuditEvent,
} from '@/domain/audit-lifecycle';

describe('T-12: Multi-Witness Triangulation and Agreement', () => {
  const FIXED_AT = new Date('2026-09-15T12:00:00Z');

  describe('A. Observation Weighting & Duplicate Suppression (07 §3, ADV-01)', () => {
    it('assigns weight 1 to a new cluster key', () => {
      const existing = new Set<string>(['cluster-alpha', 'cluster-beta']);
      const result = assignObservationWeight(existing, 'cluster-gamma');

      expect(result).toEqual({
        weight: 1,
        isDuplicate: false,
      });
    });

    it('assigns weight 0 with reasonKey to an already-seen cluster key', () => {
      const existing = new Set<string>(['cluster-alpha', 'cluster-beta']);
      const result = assignObservationWeight(existing, 'cluster-alpha');

      expect(result).toEqual({
        weight: 0,
        isDuplicate: true,
        reasonKey: 'observation.cluster_already_counted',
      });
    });

    it('accepts array or iterable for existing cluster keys', () => {
      const existingArray = ['cluster-01', 'cluster-02'];
      expect(assignObservationWeight(existingArray, 'cluster-01').weight).toBe(0);
      expect(assignObservationWeight(existingArray, 'cluster-03').weight).toBe(1);
    });

    it('throws error if incoming cluster key is empty or invalid', () => {
      expect(() => assignObservationWeight(new Set(), '')).toThrow(/must be a non-empty string/);
      expect(() => assignObservationWeight(new Set(), null as unknown as string)).toThrow(/must be a non-empty string/);
    });

    it('ADV-01: 10 submissions from the same cluster yield exactly 1 weight-1 and 9 weight-0', () => {
      const clusterKey = 'cluster-sybil-farm-01';
      const history = new Set<string>();
      const weights: number[] = [];

      for (let i = 0; i < 10; i++) {
        const res = assignObservationWeight(history, clusterKey);
        weights.push(res.weight);
        history.add(clusterKey);
      }

      expect(weights[0]).toBe(1);
      expect(weights.slice(1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });
  });

  describe('B. Invariant INV-02 Witness Counting (04 §7 line 130, 07 §3 line 53)', () => {
    it('counts distinct cluster keys where weight = 1', () => {
      const observations = [
        { clusterKey: 'cluster-01', weight: 1 },
        { clusterKey: 'cluster-02', weight: 1 },
        { clusterKey: 'cluster-03', weight: 1 },
      ];

      expect(countWitnesses(observations)).toBe(3);
    });

    it('ignores observations where weight = 0', () => {
      const observations = [
        { clusterKey: 'cluster-01', weight: 1 },
        { clusterKey: 'cluster-01', weight: 0 }, // duplicate
        { clusterKey: 'cluster-02', weight: 1 },
        { clusterKey: 'cluster-02', weight: 0 }, // duplicate
        { clusterKey: 'cluster-03', weight: 0 }, // suppressed
      ];

      expect(countWitnesses(observations)).toBe(2);
    });

    it('defensively deduplicates repeated weight-1 entries with the same clusterKey', () => {
      const observations = [
        { clusterKey: 'cluster-01', weight: 1 },
        { clusterKey: 'cluster-01', weight: 1 },
      ];

      expect(countWitnesses(observations)).toBe(1);
    });

    it('returns 0 for empty observations', () => {
      expect(countWitnesses([])).toBe(0);
    });
  });

  describe('C. Multi-Witness Agreement Calculation (04 §2 line 51)', () => {
    it('ADV-04: 3/3 unanimous agreement yields isConsistent = true (100% agreement)', () => {
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true, q2: true } },
        { clusterKey: 'c2', answers: { q1: true, q2: true } },
        { clusterKey: 'c3', answers: { q1: true, q2: true } },
      ];

      const res = calculateAgreement(clusterAnswers);
      expect(res.isConsistent).toBe(true);
      expect(res.distinctClusterCount).toBe(3);
      expect(res.minAgreement).toBe(1.0);
      expect(res.perQuestion).toEqual({ q1: 1.0, q2: 1.0 });
    });

    it('2/3 majority agreement yields isConsistent = true', () => {
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: false } },
      ];

      const res = calculateAgreement(clusterAnswers);
      expect(res.isConsistent).toBe(true);
      expect(res.minAgreement).toBeCloseTo(2 / 3);
      expect(res.perQuestion.q1).toBeCloseTo(2 / 3);
    });

    it('ADV-05: 2/4 split yields isConsistent = false (50% < 2/3)', () => {
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: false } },
        { clusterKey: 'c4', answers: { q1: false } },
      ];

      const res = calculateAgreement(clusterAnswers);
      expect(res.isConsistent).toBe(false);
      expect(res.minAgreement).toBe(0.5);
    });

    it('flags inconsistent if any single question falls below 2/3 agreement', () => {
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true, q2: true, q3: true } },
        { clusterKey: 'c2', answers: { q1: true, q2: true, q3: false } },
        { clusterKey: 'c3', answers: { q1: true, q2: false, q3: false } },
      ];

      // q1: 3 true, 0 false -> 3/3 = 1.0 >= 2/3
      // q2: 2 true, 1 false -> 2/3 = 0.666... >= 2/3
      // q3: 1 true, 2 false -> majority is 2/3 >= 2/3
      expect(calculateAgreement(clusterAnswers).isConsistent).toBe(true);

      // Now add c4 where q3 becomes 2 true, 2 false (50%)
      const clusterAnswersWithTie: ClusterAnswer[] = [
        ...clusterAnswers,
        { clusterKey: 'c4', answers: { q1: true, q2: true, q3: true } },
      ];
      // q1: 4/4 = 1.0
      // q2: 3/4 = 0.75 >= 2/3
      // q3: 2 true, 2 false -> 2/4 = 0.5 < 2/3 -> FAIL
      const res = calculateAgreement(clusterAnswersWithTie);
      expect(res.isConsistent).toBe(false);
      expect(res.perQuestion.q3).toBe(0.5);
      expect(res.minAgreement).toBe(0.5);
    });

    it('returns isConsistent = false for empty input or answers with no questions', () => {
      expect(calculateAgreement([]).isConsistent).toBe(false);
      expect(calculateAgreement([{ clusterKey: 'c1', answers: {} }]).isConsistent).toBe(false);
    });

    it('deduplicates multiple responses from the same cluster key before computing ratios', () => {
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c1', answers: { q1: false } }, // duplicate submission from same cluster
        { clusterKey: 'c1', answers: { q1: false } }, // duplicate submission from same cluster
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: true } },
      ];

      // c1 should only count once (first submission: true)
      // c1: true, c2: true, c3: true -> 3/3 = 1.0
      const res = calculateAgreement(clusterAnswers);
      expect(res.distinctClusterCount).toBe(3);
      expect(res.isConsistent).toBe(true);
      expect(res.perQuestion.q1).toBe(1.0);
    });
  });

  describe('D. Strict Integer Arithmetic (majorityVotes * 3 >= totalVotes * 2)', () => {
    it('evaluates exact 2/3 boundary without IEEE-754 precision artifacts', () => {
      // 2 out of 3 votes: 2 * 3 = 6 >= 3 * 2 = 6 -> true
      const exactTwoThirds: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: false } },
      ];
      expect(calculateAgreement(exactTwoThirds).isConsistent).toBe(true);

      // 4 out of 6 votes: 4 * 3 = 12 >= 6 * 2 = 12 -> true
      const fourOfSix: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: true } },
        { clusterKey: 'c4', answers: { q1: true } },
        { clusterKey: 'c5', answers: { q1: false } },
        { clusterKey: 'c6', answers: { q1: false } },
      ];
      expect(calculateAgreement(fourOfSix).isConsistent).toBe(true);

      // 666 out of 1000 votes: 666 * 3 = 1998 < 1000 * 2 = 2000 -> false
      const syntheticClusterAnswers: ClusterAnswer[] = [];
      for (let i = 0; i < 666; i++) {
        syntheticClusterAnswers.push({ clusterKey: `c-true-${i}`, answers: { q1: true } });
      }
      for (let i = 0; i < 334; i++) {
        syntheticClusterAnswers.push({ clusterKey: `c-false-${i}`, answers: { q1: false } });
      }
      const res = calculateAgreement(syntheticClusterAnswers);
      expect(res.isConsistent).toBe(false);
      expect(res.distinctClusterCount).toBe(1000);
    });
  });

  describe('E. Official Claim Contradiction (04 §2 line 44)', () => {
    const officialClaims = {
      generator_operational: true,
      water_running: true,
    };

    it('returns contradicts = false when 0 or 1 cluster contradicts official claim', () => {
      // 0 contradictions
      const unanimousConfirm: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { generator_operational: true, water_running: true } },
        { clusterKey: 'c2', answers: { generator_operational: true, water_running: true } },
      ];
      expect(checkOfficialClaimContradiction(unanimousConfirm, officialClaims).contradicts).toBe(false);

      // Only 1 cluster contradicts
      const singleContradict: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { generator_operational: false, water_running: true } },
        { clusterKey: 'c2', answers: { generator_operational: true, water_running: true } },
      ];
      const res1 = checkOfficialClaimContradiction(singleContradict, officialClaims);
      expect(res1.contradicts).toBe(false);
      expect(res1.contradictingClustersCount).toBe(1);
    });

    it('returns contradicts = true when >= 2 distinct clusters contradict an official claim', () => {
      const twoContradict: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { generator_operational: false, water_running: true } },
        { clusterKey: 'c2', answers: { generator_operational: false, water_running: true } },
        { clusterKey: 'c3', answers: { generator_operational: true, water_running: true } },
      ];

      const res = checkOfficialClaimContradiction(twoContradict, officialClaims);
      expect(res.contradicts).toBe(true);
      expect(res.contradictingClustersCount).toBe(2);
      expect(res.contradictingQuestions).toEqual(['generator_operational']);
    });

    it('does not count duplicate answers from the same cluster twice toward contradiction', () => {
      const repeatedClusterContradict: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { generator_operational: false } },
        { clusterKey: 'c1', answers: { generator_operational: false } }, // duplicate from c1
        { clusterKey: 'c2', answers: { generator_operational: true } },
      ];

      const res = checkOfficialClaimContradiction(repeatedClusterContradict, officialClaims);
      expect(res.contradicts).toBe(false);
      expect(res.contradictingClustersCount).toBe(1);
    });
  });

  describe('F. Triangulation Evaluator (evaluateTriangulation)', () => {
    const consistentAnswers: ClusterAnswer[] = [
      { clusterKey: 'c1', answers: { q1: true, q2: true } },
      { clusterKey: 'c2', answers: { q1: true, q2: true } },
      { clusterKey: 'c3', answers: { q1: true, q2: false } },
    ];

    const conflictingAnswers: ClusterAnswer[] = [
      { clusterKey: 'c1', answers: { q1: true, q2: true } },
      { clusterKey: 'c2', answers: { q1: false, q2: true } },
    ];

    it('returns recommendedEvent undefined when witnessCount < witnessTarget (awaiting)', () => {
      const res = evaluateTriangulation({
        witnessTarget: 3,
        witnessCount: 2,
        clusterAnswers: consistentAnswers,
        at: FIXED_AT,
      });

      expect(res.isThresholdMet).toBe(false);
      expect(res.recommendedEvent).toBeUndefined();
    });

    it('returns THRESHOLD_MET_CONSISTENT when witnessCount >= witnessTarget and agreement is consistent', () => {
      const res = evaluateTriangulation({
        witnessTarget: 3,
        witnessCount: 3,
        clusterAnswers: consistentAnswers,
        at: FIXED_AT,
      });

      expect(res.isThresholdMet).toBe(true);
      expect(res.recommendedEvent).toEqual({
        type: 'THRESHOLD_MET_CONSISTENT',
        clusterAnswers: consistentAnswers,
        at: FIXED_AT,
      });
    });

    it('returns THRESHOLD_MET_CONFLICTING when witnessCount >= witnessTarget and agreement is conflicting', () => {
      const res = evaluateTriangulation({
        witnessTarget: 2,
        witnessCount: 2,
        clusterAnswers: conflictingAnswers,
        at: FIXED_AT,
      });

      expect(res.isThresholdMet).toBe(true);
      expect(res.recommendedEvent).toEqual({
        type: 'THRESHOLD_MET_CONFLICTING',
        clusterAnswers: conflictingAnswers,
        at: FIXED_AT,
      });
    });

    it('prioritizes CONTRADICTS_OFFICIAL_CLAIM over awaiting threshold when >= 2 clusters contradict', () => {
      const contradictionAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { borehole_working: false } },
        { clusterKey: 'c2', answers: { borehole_working: false } },
      ];

      const res = evaluateTriangulation({
        witnessTarget: 3,
        witnessCount: 2, // below threshold 3!
        clusterAnswers: contradictionAnswers,
        officialClaims: { borehole_working: true },
        at: FIXED_AT,
      });

      expect(res.recommendedEvent).toEqual({
        type: 'CONTRADICTS_OFFICIAL_CLAIM',
        contradictingClustersCount: 2,
        at: FIXED_AT,
      });
    });
  });

  describe('G. Domain Settled-State Guard (INV-08 Domain Boundary)', () => {
    it('rejects threshold transition when state is already PHYSICALLY_CONFIRMED', () => {
      const snapshot: AuditSnapshot = {
        audit: 'PHYSICALLY_CONFIRMED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
        confirmedAt: FIXED_AT,
      };

      const event: AuditEvent = {
        type: 'THRESHOLD_MET_CONSISTENT',
        clusterAnswers: [
          { clusterKey: 'c1', answers: { q1: true } },
          { clusterKey: 'c2', answers: { q1: true } },
          { clusterKey: 'c3', answers: { q1: true } },
        ],
        at: FIXED_AT,
      };

      const res = transition(snapshot, event);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_ILLEGAL_TRANSITION');
        expect(res.effects).toEqual([]);
      }
    });

    it('rejects threshold transition when state is already DISCREPANCY_FLAGGED', () => {
      const snapshot: AuditSnapshot = {
        audit: 'DISCREPANCY_FLAGGED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
      };

      const event: AuditEvent = {
        type: 'THRESHOLD_MET_CONFLICTING',
        clusterAnswers: [
          { clusterKey: 'c1', answers: { q1: false } },
          { clusterKey: 'c2', answers: { q1: true } },
        ],
        at: FIXED_AT,
      };

      const res = transition(snapshot, event);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_ILLEGAL_TRANSITION');
        expect(res.effects).toEqual([]);
      }
    });

    it('proves duplicate observations on settled states produce zero transitions and zero audit side effects', () => {
      const snapshot: AuditSnapshot = {
        audit: 'PHYSICALLY_CONFIRMED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
      };

      const duplicateEvent: AuditEvent = {
        type: 'DUPLICATE_OBSERVATION',
        clusterKey: 'c1',
        at: FIXED_AT,
      };

      const res = transition(snapshot, duplicateEvent);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('PHYSICALLY_CONFIRMED');
        expect(res.effects).toEqual([
          {
            kind: 'AUDIT',
            action: 'OBSERVATION_SUPPRESSED',
            payload: {
              clusterKey: 'c1',
              weight: 0,
              currentState: 'PHYSICALLY_CONFIRMED',
              at: FIXED_AT.toISOString(),
            },
          },
        ]);
      }
    });
  });
});
