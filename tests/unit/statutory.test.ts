// Unit Tests for T-25: Statutory Rule Card, Pure Divergence Domain, and StatutoryService
// Authoritative sources:
// - docs/specs/03-data-model.md §5
// - docs/specs/05-api-contracts.md §6
// - docs/specs/07-trust-and-security.md §7
// - docs/specs/11-tasks.md T-25

import { describe, it, expect } from 'vitest';
import {
  isKAnonymitySatisfied,
  isDivergenceAlertActive,
  calculateMedianMinor,
  calculateDivergenceFromOutcomes,
  toPublicObservedDivergence,
  findActiveStatutoryRule,
  normalizeRequiredDocuments,
  extractDocumentsWithAudio,
  buildStatutoryCardResponse,
  SUPPRESSION_NOTICE_KEY,
  type StatutoryRuleDomain,
  type ServiceDomain,
  type VisitOutcomeDomain,
  type DivergenceAggregateDomain,
} from '@/domain/divergence';
import {
  StatutoryService,
  type StatutoryRepository,
} from '@/app-services/statutory.service';
import { ServiceError } from '@/app-services/errors';
import { reduceUssdSession } from '@/domain/ussd/session';

describe('T-25: Statutory Rule Card & Pure Divergence Domain Logic', () => {
  // ==========================================================================
  // 1. PURE DOMAIN: K-ANONYMITY GATING (07 §7)
  // ==========================================================================
  describe('1. Pure Domain: k-Anonymity Gating (07 §7)', () => {
    it('requires k >= 5 distinct clusters before k-anonymity is satisfied', () => {
      expect(isKAnonymitySatisfied(0)).toBe(false);
      expect(isKAnonymitySatisfied(1)).toBe(false);
      expect(isKAnonymitySatisfied(4)).toBe(false);
      expect(isKAnonymitySatisfied(5)).toBe(true);
      expect(isKAnonymitySatisfied(6)).toBe(true);
      expect(isKAnonymitySatisfied(100)).toBe(true);
    });

    it('toPublicObservedDivergence strictly returns suppression notice when k < 5', () => {
      const belowKAggregate: DivergenceAggregateDomain = {
        serviceId: 'svc-01',
        windowDays: 30,
        computedAt: '2026-09-17T00:00:00Z',
        reportCount: 4,
        distinctClusters: 3, // k = 3 < 5
        pctAdditionalFee: 75.0,
        medianExtraMinor: 15000,
        avgVisits: 2.0,
        kSatisfied: false,
        alertActive: false,
      };

      const publicDto = toPublicObservedDivergence(belowKAggregate);

      expect(publicDto.kSatisfied).toBe(false);
      if (!publicDto.kSatisfied) {
        expect(publicDto.windowDays).toBe(30);
        expect(publicDto.noticeKey).toBe(SUPPRESSION_NOTICE_KEY);
        expect(publicDto.minimumRequired).toBe(5);
      }

      // SECURITY INVARIANT: No counts, no percentages, no medians in suppressed payload
      expect((publicDto as unknown as Record<string, unknown>).reportCount).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).distinctClusters).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).pctAdditionalFee).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).medianExtraMinor).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).avgVisits).toBeUndefined();
    });

    it('toPublicObservedDivergence returns full public aggregate when k >= 5', () => {
      const satisfiedAggregate: DivergenceAggregateDomain = {
        serviceId: 'svc-01',
        windowDays: 30,
        computedAt: '2026-09-17T00:00:00Z',
        reportCount: 14,
        distinctClusters: 6, // k = 6 >= 5
        pctAdditionalFee: 78.6,
        medianExtraMinor: 20000,
        avgVisits: 2.1,
        kSatisfied: true,
        alertActive: true,
      };

      const publicDto = toPublicObservedDivergence(satisfiedAggregate);

      expect(publicDto.kSatisfied).toBe(true);
      if (publicDto.kSatisfied) {
        expect(publicDto.windowDays).toBe(30);
        expect(publicDto.reportCount).toBe(14);
        expect(publicDto.distinctClusters).toBe(6);
        expect(publicDto.pctAdditionalFee).toBe(78.6);
        expect(publicDto.medianExtraMinor).toBe(20000);
        expect(publicDto.avgVisits).toBe(2.1);
        expect(publicDto.alertActive).toBe(true);
      }
    });

    it('suppresses aggregate when distinctClusters < 5 even if flag kSatisfied was incorrectly true', () => {
      // Defensive test: distinctClusters takes precedence over boolean flag
      const rogueAggregate: DivergenceAggregateDomain = {
        serviceId: 'svc-01',
        windowDays: 30,
        computedAt: '2026-09-17T00:00:00Z',
        reportCount: 20,
        distinctClusters: 3, // k < 5
        pctAdditionalFee: 80.0,
        medianExtraMinor: 10000,
        avgVisits: 1.5,
        kSatisfied: true, // Inconsistent with distinctClusters < 5
        alertActive: false,
      };

      const publicDto = toPublicObservedDivergence(rogueAggregate);
      expect(publicDto.kSatisfied).toBe(false);
      if (!publicDto.kSatisfied) {
        expect(publicDto.noticeKey).toBe('divergence.not_enough_reports');
      }
    });

    it('handles null or undefined aggregates by returning suppression notice', () => {
      const dto1 = toPublicObservedDivergence(null);
      expect(dto1.kSatisfied).toBe(false);
      if (!dto1.kSatisfied) {
        expect(dto1.noticeKey).toBe(SUPPRESSION_NOTICE_KEY);
      }

      const dto2 = toPublicObservedDivergence(undefined);
      expect(dto2.kSatisfied).toBe(false);
      if (!dto2.kSatisfied) {
        expect(dto2.noticeKey).toBe(SUPPRESSION_NOTICE_KEY);
      }
    });
  });

  // ==========================================================================
  // 2. PURE DOMAIN: DIVERGENCE CALCULATION & SYBIL RESISTANCE (03 §5, 07 §3)
  // ==========================================================================
  describe('2. Pure Domain: Divergence Calculation & Sybil Resistance', () => {
    it('collapses sybil flood from the same cluster into 1 cluster (fails k-anonymity)', () => {
      // 10 reports, but all from the exact same cluster key
      const sybilOutcomes: VisitOutcomeDomain[] = Array.from({ length: 10 }, (_, i) => ({
        id: `out-${i}`,
        serviceId: 'svc-01',
        outcomeCode: 2,
        extraFeeMinor: 5000,
        visitsReported: 2,
        respondentHash: `hash-${i}`,
        clusterKey: 'cluster-sybil-same', // all same cluster
        channel: 'USSD',
        idempotencyKey: `idem-${i}`,
        reportedAt: '2026-09-15T10:00:00Z',
      }));

      const agg = calculateDivergenceFromOutcomes({
        serviceId: 'svc-01',
        outcomes: sybilOutcomes,
        computedAt: '2026-09-17T00:00:00.000Z',
      });

      expect(agg.reportCount).toBe(10);
      expect(agg.distinctClusters).toBe(1); // collapsed to 1!
      expect(agg.kSatisfied).toBe(false); // 1 < 5 -> suppressed!
      expect(agg.pctAdditionalFee).toBeNull();
      expect(agg.medianExtraMinor).toBeNull();
    });

    it('computes accurate percentage and median when k >= 5', () => {
      // 10 reports across 5 distinct clusters
      // 6 reports overcharge (outcome 2): fees [10000, 20000, 20000, 30000, 40000, 50000]
      // 4 reports normal (outcome 1)
      const outcomes: VisitOutcomeDomain[] = [
        // 6 overcharged
        { id: '1', serviceId: 's', outcomeCode: 2, extraFeeMinor: 10000, visitsReported: 2, respondentHash: 'h1', clusterKey: 'c1', channel: 'USSD', idempotencyKey: 'k1', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '2', serviceId: 's', outcomeCode: 2, extraFeeMinor: 20000, visitsReported: 3, respondentHash: 'h2', clusterKey: 'c2', channel: 'USSD', idempotencyKey: 'k2', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '3', serviceId: 's', outcomeCode: 2, extraFeeMinor: 20000, visitsReported: 2, respondentHash: 'h3', clusterKey: 'c3', channel: 'USSD', idempotencyKey: 'k3', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '4', serviceId: 's', outcomeCode: 2, extraFeeMinor: 30000, visitsReported: 2, respondentHash: 'h4', clusterKey: 'c4', channel: 'USSD', idempotencyKey: 'k4', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '5', serviceId: 's', outcomeCode: 2, extraFeeMinor: 40000, visitsReported: 4, respondentHash: 'h5', clusterKey: 'c5', channel: 'USSD', idempotencyKey: 'k5', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '6', serviceId: 's', outcomeCode: 2, extraFeeMinor: 50000, visitsReported: 1, respondentHash: 'h6', clusterKey: 'c1', channel: 'USSD', idempotencyKey: 'k6', reportedAt: '2026-09-15T10:00:00Z' },
        // 4 normal
        { id: '7', serviceId: 's', outcomeCode: 1, extraFeeMinor: null, visitsReported: 1, respondentHash: 'h7', clusterKey: 'c2', channel: 'USSD', idempotencyKey: 'k7', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '8', serviceId: 's', outcomeCode: 1, extraFeeMinor: null, visitsReported: 1, respondentHash: 'h8', clusterKey: 'c3', channel: 'USSD', idempotencyKey: 'k8', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '9', serviceId: 's', outcomeCode: 1, extraFeeMinor: null, visitsReported: 2, respondentHash: 'h9', clusterKey: 'c4', channel: 'USSD', idempotencyKey: 'k9', reportedAt: '2026-09-15T10:00:00Z' },
        { id: '10', serviceId: 's', outcomeCode: 1, extraFeeMinor: null, visitsReported: 1, respondentHash: 'h10', clusterKey: 'c5', channel: 'USSD', idempotencyKey: 'k10', reportedAt: '2026-09-15T10:00:00Z' },
      ];

      const agg = calculateDivergenceFromOutcomes({
        serviceId: 's',
        outcomes,
        computedAt: '2026-09-17T00:00:00.000Z',
      });

      expect(agg.reportCount).toBe(10);
      expect(agg.distinctClusters).toBe(5);
      expect(agg.kSatisfied).toBe(true);
      expect(agg.pctAdditionalFee).toBe(60); // 6 / 10 = 60.0%
      // Median of [10000, 20000, 20000, 30000, 40000, 50000] = (20000 + 30000)/2 = 25000
      expect(agg.medianExtraMinor).toBe(25000);
      // Avg visits: (2+3+2+2+4+1+1+1+2+1)/10 = 19/10 = 1.9
      expect(agg.avgVisits).toBe(1.9);
      // Alert threshold: 10 reports, 5 clusters, 60% fee -> alertActive = true
      expect(agg.alertActive).toBe(true);
    });

    it('evaluates alert_active threshold rules accurately per 07 §7', () => {
      // Case 1: All met (>=10 reports, >=5 clusters, >=60% extra fee) -> true
      expect(isDivergenceAlertActive(10, 5, 60.0)).toBe(true);
      expect(isDivergenceAlertActive(14, 6, 78.6)).toBe(true);

      // Case 2: Below report threshold (<10) -> false
      expect(isDivergenceAlertActive(9, 5, 80.0)).toBe(false);

      // Case 3: Below cluster threshold (<5) -> false
      expect(isDivergenceAlertActive(15, 4, 80.0)).toBe(false);

      // Case 4: Below pct threshold (<60) -> false
      expect(isDivergenceAlertActive(20, 6, 59.9)).toBe(false);

      // Case 5: Null percentage -> false
      expect(isDivergenceAlertActive(15, 6, null)).toBe(false);
    });

    it('calculateMedianMinor handles odd, even, and empty arrays', () => {
      expect(calculateMedianMinor([])).toBeNull();
      expect(calculateMedianMinor([5000])).toBe(5000);
      expect(calculateMedianMinor([1000, 3000, 2000])).toBe(2000); // odd
      expect(calculateMedianMinor([1000, 4000, 2000, 3000])).toBe(2500); // even
    });
  });

  // ==========================================================================
  // 3. PURE DOMAIN: RULE MATCHING & STATUTORY CARD BUILDER (03 §5)
  // ==========================================================================
  describe('3. Pure Domain: Rule Matching & Card Builder', () => {
    const rules: StatutoryRuleDomain[] = [
      {
        id: 'rule-old',
        serviceId: 'svc-01',
        feeCeilingMinor: 4000,
        currency: 'ETB',
        requiredDocuments: ['doc.birth_cert'],
        expectedVisits: 1,
        refusalScriptKey: 'script.old',
        appealRouteKey: 'appeal.ombuds',
        reviewerInitials: 'A.B.',
        reviewedAt: '2025-01-01T00:00:00Z',
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
      },
      {
        id: 'rule-active',
        serviceId: 'svc-01',
        feeCeilingMinor: 5000,
        currency: 'ETB',
        requiredDocuments: [
          { labelKey: 'doc.birth_certificate_copy', audioKey: 'prompt.doc_birth_cert' },
          { labelKey: 'doc.two_witnesses_id', audioKey: 'prompt.doc_witness_id' },
        ],
        expectedVisits: 1,
        refusalScriptKey: 'script.request_official_receipt',
        appealRouteKey: 'appeal.woreda_ombuds',
        sourcePage: 3,
        reviewerInitials: 'H.T.',
        reviewedAt: '2026-09-11T00:00:00Z',
        validFrom: '2026-01-01',
        validTo: null,
      },
      {
        id: 'rule-future',
        serviceId: 'svc-01',
        feeCeilingMinor: 6000,
        currency: 'ETB',
        requiredDocuments: ['doc.digital_id'],
        expectedVisits: 1,
        refusalScriptKey: 'script.future',
        appealRouteKey: 'appeal.future',
        reviewerInitials: 'H.T.',
        reviewedAt: '2026-09-11T00:00:00Z',
        validFrom: '2027-01-01',
        validTo: null,
      },
    ];

    it('selects currently active rule as of evaluation date', () => {
      const active2026 = findActiveStatutoryRule(rules, '2026-09-17');
      expect(active2026?.id).toBe('rule-active');

      const active2025 = findActiveStatutoryRule(rules, '2025-06-15');
      expect(active2025?.id).toBe('rule-old');

      const active2024 = findActiveStatutoryRule(rules, '2024-01-01');
      expect(active2024).toBeNull();
    });

    it('normalizes document specifications and extracts audio metadata', () => {
      const mixedDocs = [
        'doc.plain_string',
        { labelKey: 'doc.with_audio', audioKey: 'prompt.doc_audio' },
      ];

      const stringKeys = normalizeRequiredDocuments(mixedDocs);
      expect(stringKeys).toEqual(['doc.plain_string', 'doc.with_audio']);

      const detailedDocs = extractDocumentsWithAudio(mixedDocs);
      expect(detailedDocs).toEqual([
        { labelKey: 'doc.plain_string' },
        { labelKey: 'doc.with_audio', audioKey: 'prompt.doc_audio' },
      ]);
    });

    it('buildStatutoryCardResponse compiles complete canonical response', () => {
      const service: ServiceDomain = {
        id: 'svc-01',
        wardId: 'ward-01',
        code: 'ET-ID-REPLACE',
        officeCode: 'W09-CIVIL-01',
        labelKey: 'service.id_replacement',
      };

      const card = buildStatutoryCardResponse({
        service,
        rule: rules[1],
        sourceDoc: { title: 'Circular 14/2026' },
        aggregate: {
          serviceId: 'svc-01',
          windowDays: 30,
          computedAt: '2026-09-17T00:00:00Z',
          reportCount: 14,
          distinctClusters: 6,
          pctAdditionalFee: 78.6,
          medianExtraMinor: 20000,
          avgVisits: 2.4,
          kSatisfied: true,
          alertActive: true,
        },
      });

      expect(card.serviceCode).toBe('ET-ID-REPLACE');
      expect(card.officeCode).toBe('W09-CIVIL-01');
      expect(card.statutory.feeCeilingMinor).toBe(5000);
      expect(card.statutory.currency).toBe('ETB');
      expect(card.statutory.requiredDocuments).toEqual([
        'doc.birth_certificate_copy',
        'doc.two_witnesses_id',
      ]);
      expect(card.statutory.refusalScriptKey).toBe('script.request_official_receipt');
      expect(card.statutory.source?.title).toBe('Circular 14/2026');
      expect(card.statutory.source?.page).toBe(3);
      expect(card.statutory.source?.reviewer).toBe('H.T.');
      expect(card.observed.kSatisfied).toBe(true);
      if (card.observed.kSatisfied) {
        expect(card.observed.reportCount).toBe(14);
        expect(card.observed.distinctClusters).toBe(6);
        expect(card.observed.pctAdditionalFee).toBe(78.6);
        expect(card.observed.medianExtraMinor).toBe(20000);
      }
    });
  });

  // ==========================================================================
  // 4. APPLICATION SERVICE: STATUTORY SERVICE (05 §6)
  // ==========================================================================
  describe('4. Application Service: StatutoryService', () => {
    const service = new StatutoryService();

    it('retrieves statutory rule card for ET-ID-REPLACE with k-satisfied aggregate', async () => {
      const card = await service.getStatutoryCard('ET-ID-REPLACE');

      expect(card.serviceCode).toBe('ET-ID-REPLACE');
      expect(card.officeCode).toBe('W09-CIVIL-01');
      expect(card.statutory.feeCeilingMinor).toBe(5000);
      expect(card.statutory.currency).toBe('ETB');
      expect(card.statutory.expectedVisits).toBe(1);
      expect(card.statutory.requiredDocuments).toContain('doc.birth_certificate_copy');
      expect(card.statutory.source).not.toBeNull();
      expect(card.statutory.source?.title).toContain('Circular 14/2026');

      // k >= 5 aggregate is visible
      expect(card.observed.kSatisfied).toBe(true);
      if (card.observed.kSatisfied) {
        expect(card.observed.distinctClusters).toBe(6);
        expect(card.observed.reportCount).toBe(14);
        expect(card.observed.pctAdditionalFee).toBe(78.6);
        expect(card.observed.medianExtraMinor).toBe(20000);
      }
    });

    it('retrieves statutory rule card for ET-CLINIC-INTAKE with suppressed aggregate (k < 5)', async () => {
      const card = await service.getStatutoryCard('ET-CLINIC-INTAKE');

      expect(card.serviceCode).toBe('ET-CLINIC-INTAKE');
      expect(card.officeCode).toBe('W09-HLTH-01');
      expect(card.statutory.feeCeilingMinor).toBe(0); // Free clinic intake
      expect(card.statutory.currency).toBe('ETB');
      expect(card.statutory.requiredDocuments).toContain('doc.kebele_resident_id');

      // k < 5 aggregate MUST be suppressed
      expect(card.observed.kSatisfied).toBe(false);
      if (!card.observed.kSatisfied) {
        expect(card.observed.noticeKey).toBe('divergence.not_enough_reports');
        expect(card.observed.minimumRequired).toBe(5);
      }

      // SECURITY INVARIANT: No counts leaked
      expect((card.observed as unknown as Record<string, unknown>).reportCount).toBeUndefined();
      expect((card.observed as unknown as Record<string, unknown>).pctAdditionalFee).toBeUndefined();
    });

    it('throws ServiceError 404 E_UNKNOWN_CODE for unknown service code', async () => {
      await expect(service.getStatutoryCard('UNKNOWN-CODE')).rejects.toThrow(ServiceError);
      try {
        await service.getStatutoryCard('UNKNOWN-CODE');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        const svcErr = err as ServiceError;
        expect(svcErr.code).toBe('E_UNKNOWN_CODE');
        expect(svcErr.statusCode).toBe(404);
      }
    });

    it('supports custom repository injection', async () => {
      const mockRepo: StatutoryRepository = {
        async getServiceByCode(code) {
          if (code === 'TEST-SVC') {
            return {
              id: 'test-id',
              wardId: 'w1',
              code: 'TEST-SVC',
              officeCode: 'OFF-01',
              labelKey: 'svc.test',
            };
          }
          return null;
        },
        async getRulesForService() {
          return [
            {
              id: 'r1',
              serviceId: 'test-id',
              feeCeilingMinor: 1000,
              currency: 'KES',
              requiredDocuments: ['doc.id'],
              expectedVisits: 1,
              refusalScriptKey: 'script.test',
              appealRouteKey: 'appeal.test',
              reviewerInitials: 'T.E.',
              reviewedAt: '2026-09-01T00:00:00Z',
              validFrom: '2026-01-01',
              validTo: null,
            },
          ];
        },
        async getSourceDocument() {
          return { title: 'Test Gazette' };
        },
        async getDivergenceAggregate() {
          return null; // Will trigger calculateDivergenceFromOutcomes
        },
        async getVisitOutcomes() {
          return []; // 0 outcomes -> suppressed k=0 < 5
        },
        async saveVisitOutcome() {},
        async getVisitOutcomeByIdempotencyKey() {
          return null;
        },
        async countVisitOutcomesByReporterAndDay() {
          return 0;
        },
      };

      const customService = new StatutoryService(mockRepo);
      const card = await customService.getStatutoryCard('TEST-SVC');
      expect(card.serviceCode).toBe('TEST-SVC');
      expect(card.statutory.currency).toBe('KES');
      expect(card.observed.kSatisfied).toBe(false);
    });
  });

  // ==========================================================================
  // 5. USSD INTEGRATION: STATUTORY SERVICE FLOW (06 §2, §4)
  // ==========================================================================
  describe('5. USSD Path: Querying Statutory Rules via USSD', () => {
    it('allows navigating to statutory card via menu: 2 -> 1', () => {
      // Step 1: Root menu, choose 2 (Service fees)
      const res1 = reduceUssdSession('2');
      expect(res1.action).toBe('CON');
      expect(res1.nodeId).toBe('SERVICES_SELECT');
      expect(res1.text).toContain('ID replacement');

      // Step 2: Choose 1 (ID replacement) -> Statutory card
      const res2 = reduceUssdSession('2*1');
      expect(res2.action).toBe('CON');
      expect(res2.nodeId).toBe('SERVICE_CARD');
      expect(res2.text).toContain('50'); // Fee: 50 ETB

      // Step 3: Choose 1 (Refusal script)
      const resRefusal = reduceUssdSession('2*1*1');
      expect(resRefusal.action).toBe('END');
      expect(resRefusal.nodeId).toBe('SERVICE_REFUSAL_SCRIPT');
      expect(resRefusal.text).toContain('Circular 14/2026');

      // Step 4: Choose 2 (Divergence summary)
      const resDiv = reduceUssdSession('2*1*2');
      expect(resDiv.action).toBe('END');
      expect(resDiv.nodeId).toBe('SERVICE_DIVERGENCE');
      expect(resDiv.text).toContain('78%');
    });

    it('supports direct service code input in SERVICES_SELECT: 2*ET-ID-REPLACE', () => {
      const res = reduceUssdSession('2*ET-ID-REPLACE');
      expect(res.action).toBe('CON');
      expect(res.nodeId).toBe('SERVICE_CARD');
      expect(res.text).toContain('50');
    });

    it('shows suppression notice for ET-CLINIC-INTAKE (k < 5)', () => {
      const resDivClinic = reduceUssdSession('2*2*2');
      expect(resDivClinic.action).toBe('END');
      expect(resDivClinic.nodeId).toBe('SERVICE_DIVERGENCE');
      // Should show 'Not enough reports yet'
      expect(resDivClinic.text).toContain('Not enough reports yet');
    });
  });
});
