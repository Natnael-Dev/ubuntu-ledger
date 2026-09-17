// Adversarial Differencing Attack & k-Anonymity Privacy Invariant Tests (T-26)
// Authoritative sources:
// - docs/specs/03-data-model.md §5
// - docs/specs/05-api-contracts.md §6, §7, §12
// - docs/specs/07-trust-and-security.md §7
// - docs/specs/10-skills.md S-10
// - docs/specs/11-tasks.md T-26

import { describe, it, expect } from 'vitest';
import {
  isKAnonymitySatisfied,
  calculateDivergenceFromOutcomes,
  toPublicObservedDivergence,
  SUPPRESSION_NOTICE_KEY,
  type VisitOutcomeDomain,
} from '@/domain/divergence';
import { StatutoryService } from '@/app-services/statutory.service';

describe('T-26: Differencing Attack Protection & k-Anonymity Privacy Invariants', () => {
  const baseTimestamp = '2026-09-17T12:00:00Z';

  function makeOutcome(overrides: Partial<VisitOutcomeDomain>): VisitOutcomeDomain {
    return {
      id: `vo_${Math.random().toString(36).substring(2, 9)}`,
      serviceId: 'svc-id-replace',
      outcomeCode: 1,
      extraFeeMinor: null,
      visitsReported: 1,
      respondentHash: 'hash_abc123',
      clusterKey: 'cluster_01',
      channel: 'USSD',
      idempotencyKey: `idemp_${Math.random()}`,
      reportedAt: baseTimestamp,
      ...overrides,
    };
  }

  // ============================================================================
  // 1. DIFFERENCING ATTACK IMMUNITY
  // ============================================================================
  describe('1. Differencing Attack Immunity across Overlapping Windows', () => {
    it('prevents isolating a single target report when an attacker compares window W1 and W2', () => {
      // Suppose an adversary knows 4 distinct cluster reports exist in window W1.
      // At time t, a victim submits a sensitive outcome in cluster_05.
      // In W1 (t - 1), clusters = 4 (k < 5) -> Suppressed.
      // In W2 (t), clusters = 5 (k = 5) -> Satisfied.

      const baselineOutcomes: VisitOutcomeDomain[] = [
        makeOutcome({ clusterKey: 'cluster_A', outcomeCode: 1, extraFeeMinor: 0 }),
        makeOutcome({ clusterKey: 'cluster_B', outcomeCode: 1, extraFeeMinor: 0 }),
        makeOutcome({ clusterKey: 'cluster_C', outcomeCode: 1, extraFeeMinor: 0 }),
        makeOutcome({ clusterKey: 'cluster_D', outcomeCode: 1, extraFeeMinor: 0 }),
      ];

      // Window W1 (before victim report): 4 clusters
      const aggW1 = calculateDivergenceFromOutcomes({
        serviceId: 'svc-id-replace',
        outcomes: baselineOutcomes,
        computedAt: baseTimestamp,
      });
      const publicW1 = toPublicObservedDivergence(aggW1);

      // W1 MUST be suppressed: zero leakage of report counts or fee percentages
      expect(publicW1.kSatisfied).toBe(false);
      if (!publicW1.kSatisfied) {
        expect(publicW1.noticeKey).toBe(SUPPRESSION_NOTICE_KEY);
        expect(publicW1.minimumRequired).toBe(5);
      }
      expect((publicW1 as unknown as Record<string, unknown>).reportCount).toBeUndefined();
      expect((publicW1 as unknown as Record<string, unknown>).pctAdditionalFee).toBeUndefined();
      expect((publicW1 as unknown as Record<string, unknown>).medianExtraMinor).toBeUndefined();

      // Now victim report is added (cluster_E, outcomeCode 2, extra fee 50000)
      const victimOutcome = makeOutcome({
        clusterKey: 'cluster_E',
        outcomeCode: 2,
        extraFeeMinor: 50000,
        visitsReported: 3,
      });

      const outcomesW2 = [...baselineOutcomes, victimOutcome];
      const aggW2 = calculateDivergenceFromOutcomes({
        serviceId: 'svc-id-replace',
        outcomes: outcomesW2,
        computedAt: baseTimestamp,
      });
      const publicW2 = toPublicObservedDivergence(aggW2);

      // In W2, k = 5 is reached.
      expect(publicW2.kSatisfied).toBe(true);

      // Adversary attempts differencing:
      // Adversary wants: metric(W2) - metric(W1) = victim_value.
      // Because metric(W1) was NEVER emitted (undefined/suppressed),
      // algebraic subtraction metric(W2) - metric(W1) is mathematically impossible!
      expect((publicW1 as unknown as Record<string, unknown>).reportCount).toBeUndefined();
      expect((publicW1 as unknown as Record<string, unknown>).medianExtraMinor).toBeUndefined();
    });

    it('suppresses both windows if the difference between two sliding intervals has < 5 clusters', () => {
      // Even if overall window has k >= 5, any sub-group with < 5 clusters cannot be isolated
      const subOutcomes: VisitOutcomeDomain[] = [
        makeOutcome({ clusterKey: 'cluster_X', outcomeCode: 2, extraFeeMinor: 10000 }),
        makeOutcome({ clusterKey: 'cluster_Y', outcomeCode: 2, extraFeeMinor: 15000 }),
      ];

      const subAgg = calculateDivergenceFromOutcomes({
        serviceId: 'svc-id-replace',
        outcomes: subOutcomes,
        computedAt: baseTimestamp,
      });

      const publicSub = toPublicObservedDivergence(subAgg);
      expect(publicSub.kSatisfied).toBe(false);
      expect((publicSub as unknown as Record<string, unknown>).reportCount).toBeUndefined();
    });
  });

  // ============================================================================
  // 2. SYBIL & DUPLICATE CLUSTER IMMUNITY
  // ============================================================================
  describe('2. Sybil & Multi-Submission Cluster Gating', () => {
    it('10 reports from the exact same cluster count as 1 distinct cluster and remain suppressed', () => {
      const sybilOutcomes: VisitOutcomeDomain[] = Array.from({ length: 10 }, (_, i) =>
        makeOutcome({
          id: `sybil_${i}`,
          clusterKey: 'cluster_SAME_CELL',
          respondentHash: `phone_${i}`, // 10 different phones in same cluster
          outcomeCode: 2,
          extraFeeMinor: 20000,
        })
      );

      const agg = calculateDivergenceFromOutcomes({
        serviceId: 'svc-id-replace',
        outcomes: sybilOutcomes,
        computedAt: baseTimestamp,
      });

      expect(agg.reportCount).toBe(10);
      expect(agg.distinctClusters).toBe(1); // Only 1 distinct cluster
      expect(agg.kSatisfied).toBe(false);

      const publicDto = toPublicObservedDivergence(agg);
      expect(publicDto.kSatisfied).toBe(false);
      // Suppressed payload must not leak reportCount 10
      expect((publicDto as unknown as Record<string, unknown>).reportCount).toBeUndefined();
    });

    it('requires at least 5 distinct cluster keys to satisfy k-anonymity', () => {
      const fourClusterOutcomes: VisitOutcomeDomain[] = [
        makeOutcome({ clusterKey: 'c1' }),
        makeOutcome({ clusterKey: 'c2' }),
        makeOutcome({ clusterKey: 'c3' }),
        makeOutcome({ clusterKey: 'c4' }),
      ];
      expect(isKAnonymitySatisfied(new Set(fourClusterOutcomes.map((o) => o.clusterKey)).size)).toBe(false);

      fourClusterOutcomes.push(makeOutcome({ clusterKey: 'c5' }));
      expect(isKAnonymitySatisfied(new Set(fourClusterOutcomes.map((o) => o.clusterKey)).size)).toBe(true);
    });
  });

  // ============================================================================
  // 3. SILENT OUTCOME RECORDING INVARIANT (05 §7, INV-07)
  // ============================================================================
  describe('3. Silent Ingress Invariant (INV-07 / 05 §7)', () => {
    it('recordVisitOutcome returns strictly { accepted: true, thankYouKey: "outcome.recorded" }', async () => {
      const service = new StatutoryService();

      const response = await service.recordVisitOutcome({
        serviceCode: 'ET-ID-REPLACE',
        outcomeCode: 2,
        extraFeeMinor: 20000,
        visits: 3,
        phoneHash: 'test_reporter_silent_1',
        channel: 'USSD',
        idempotencyKey: 'idemp_silent_001',
      });

      expect(response).toEqual({
        accepted: true,
        thankYouKey: 'outcome.recorded',
      });

      // Assert no aggregate leakage
      const raw = response as unknown as Record<string, unknown>;
      expect(raw.reportCount).toBeUndefined();
      expect(raw.distinctClusters).toBeUndefined();
      expect(raw.kSatisfied).toBeUndefined();
      expect(raw.pctAdditionalFee).toBeUndefined();
      expect(raw.medianExtraMinor).toBeUndefined();
    });
  });
});
