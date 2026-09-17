// Pure Domain Logic for Statutory Rules, Divergence Calculation, and k-Anonymity Gating
// Authoritative sources:
// - docs/specs/03-data-model.md §5 (service, statutory_rule, visit_outcome, divergence_aggregate)
// - docs/specs/05-api-contracts.md §6 (GET /api/services/:serviceCode/card & /statutory)
// - docs/specs/07-trust-and-security.md §7 (k-anonymity gating: k >= 5 distinct clusters)
// - docs/specs/11-tasks.md T-25
//
// Invariants:
// 1. Zero I/O, zero external dependencies outside /src/domain.
// 2. Suppressed aggregates (distinctClusters < 5) NEVER leak report counts, percentages, or medians.
// 3. Alert active requires report_count >= 10 AND distinct_clusters >= 5 AND pct_additional_fee >= 60.

import type { Channel } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

export const K_MIN_CLUSTERS = 5;
export const DEFAULT_WINDOW_DAYS = 30;
export const ALERT_MIN_REPORTS = 10;
export const ALERT_MIN_CLUSTERS = 5;
export const ALERT_MIN_PCT_FEE = 60.0;
export const SUPPRESSION_NOTICE_KEY = 'divergence.not_enough_reports' as const;

export type OutcomeCode = 1 | 2 | 3 | 4 | 5;

export interface OutcomeCodeDefinition {
  code: OutcomeCode;
  labelKey: string;
  meaning: string;
}

export const OUTCOME_CODE_DEFINITIONS: Record<OutcomeCode, OutcomeCodeDefinition> = {
  1: {
    code: 1,
    labelKey: 'outcome.served_at_official_fee',
    meaning: 'Service received at the statutory fee',
  },
  2: {
    code: 2,
    labelKey: 'outcome.additional_payment_requested',
    meaning: 'An amount above the statutory ceiling was requested',
  },
  3: {
    code: 3,
    labelKey: 'outcome.receipt_not_provided',
    meaning: 'Payment made, no official receipt issued',
  },
  4: {
    code: 4,
    labelKey: 'outcome.undocumented_requirement',
    meaning: 'A requirement not on the statutory list was asked for',
  },
  5: {
    code: 5,
    labelKey: 'outcome.office_inaccessible',
    meaning: 'Office closed / service unavailable',
  },
};

export function isValidOutcomeCode(code: unknown): code is OutcomeCode {
  return typeof code === 'number' && Number.isInteger(code) && code >= 1 && code <= 5;
}

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export interface StatutoryDocumentItem {
  labelKey: string;
  audioKey?: string;
}

export type RequiredDocumentSpec = string | StatutoryDocumentItem;

export interface StatutoryRuleDomain {
  id: string;
  serviceId: string;
  feeCeilingMinor: number;
  currency: string;
  requiredDocuments: RequiredDocumentSpec[];
  expectedVisits: number;
  refusalScriptKey: string;
  appealRouteKey: string;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  reviewerInitials: string;
  reviewedAt: string;
  validFrom: string; // ISO date string YYYY-MM-DD or full ISO
  validTo?: string | null;
  createdAt?: string;
}

export interface ServiceDomain {
  id: string;
  wardId: string;
  code: string;
  officeCode: string;
  labelKey: string;
  createdAt?: string;
}

export interface VisitOutcomeDomain {
  id: string;
  serviceId: string;
  outcomeCode: OutcomeCode | number; // 1..5
  extraFeeMinor?: number | null;
  visitsReported?: number | null;
  respondentHash: string;
  clusterKey: string;
  channel: Channel | string;
  idempotencyKey: string;
  reportedAt: string;
}

export interface RecordVisitOutcomeInput {
  serviceCode: string;
  outcomeCode: OutcomeCode | number;
  extraFeeMinor?: number | null;
  visits?: number | null;
  phoneHash: string;
  channel: Channel | string;
  idempotencyKey?: string;
  geoCell?: string | null;
  msisdnPrefixBucket?: string;
  registeredAt?: Date | string | null;
}

export interface RecordVisitOutcomeResponseDto {
  accepted: true;
  thankYouKey: 'outcome.recorded';
}

export interface DivergenceAggregateDomain {
  serviceId: string;
  windowDays: number;
  computedAt: string;
  reportCount: number;
  distinctClusters: number;
  pctAdditionalFee: number | null;
  medianExtraMinor: number | null;
  avgVisits: number | null;
  kSatisfied: boolean;
  alertActive: boolean;
}

export interface StatutorySourceDto {
  title: string;
  page: number | null;
  reviewer: string;
  reviewedAt: string;
}

export interface StatutorySectionDto {
  feeCeilingMinor: number;
  currency: string;
  requiredDocuments: string[];
  expectedVisits: number;
  refusalScriptKey: string;
  appealRouteKey: string;
  source: StatutorySourceDto | null;
  documentsWithAudio?: StatutoryDocumentItem[];
}

export interface PublicDivergenceSatisfiedDto {
  kSatisfied: true;
  windowDays: number;
  reportCount: number;
  distinctClusters: number;
  pctAdditionalFee: number;
  medianExtraMinor: number;
  avgVisits: number;
  alertActive?: boolean;
}

export interface PublicDivergenceSuppressedDto {
  kSatisfied: false;
  windowDays: number;
  noticeKey: typeof SUPPRESSION_NOTICE_KEY;
  minimumRequired: number;
}

export type PublicObservedDivergenceDto =
  | PublicDivergenceSatisfiedDto
  | PublicDivergenceSuppressedDto;

export interface StatutoryCardResponseDto {
  serviceCode: string;
  officeCode: string;
  statutory: StatutorySectionDto;
  observed: PublicObservedDivergenceDto;
}

// ============================================================================
// PURE DOMAIN FUNCTIONS
// ============================================================================

/**
 * Evaluates whether k-anonymity is satisfied.
 * Per 07 §7: k_min = 5 distinct clusters — not 5 reports — before any aggregate is public.
 */
export function isKAnonymitySatisfied(
  distinctClusters: number,
  kMin: number = K_MIN_CLUSTERS
): boolean {
  return typeof distinctClusters === 'number' && distinctClusters >= kMin;
}

/**
 * Evaluates whether divergence triggers the active alert threshold.
 * Per 07 §7: alert_active requires report_count >= 10 AND distinct_clusters >= 5 AND pct_additional_fee >= 60.
 */
export function isDivergenceAlertActive(
  reportCount: number,
  distinctClusters: number,
  pctAdditionalFee: number | null
): boolean {
  if (!isKAnonymitySatisfied(distinctClusters, ALERT_MIN_CLUSTERS)) {
    return false;
  }
  if (reportCount < ALERT_MIN_REPORTS) {
    return false;
  }
  if (pctAdditionalFee === null || pctAdditionalFee === undefined) {
    return false;
  }
  return pctAdditionalFee >= ALERT_MIN_PCT_FEE;
}

/**
 * Calculates mathematical median for a non-empty numeric array.
 * Values are sorted ascending. Even lengths return the midpoint rounded to integer.
 */
export function calculateMedianMinor(values: number[]): number | null {
  if (!values || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Calculates divergence aggregates from raw visit outcomes over a fixed window.
 * If k-anonymity (distinct clusters < 5) is NOT met, sensitive aggregate metrics
 * (percentages, median extra fee, avg visits) are withheld (null).
 */
export function calculateDivergenceFromOutcomes(params: {
  serviceId: string;
  outcomes: VisitOutcomeDomain[];
  computedAt: string;
  windowDays?: number;
  kMin?: number;
}): DivergenceAggregateDomain {
  const {
    serviceId,
    outcomes,
    computedAt,
    windowDays = DEFAULT_WINDOW_DAYS,
    kMin = K_MIN_CLUSTERS,
  } = params;

  const reportCount = outcomes.length;
  const uniqueClusters = new Set(
    outcomes.map((o) => o.clusterKey).filter((c) => Boolean(c && c.trim()))
  );
  const distinctClusters = uniqueClusters.size;
  const kSatisfied = isKAnonymitySatisfied(distinctClusters, kMin);

  if (!kSatisfied || reportCount === 0) {
    return {
      serviceId,
      windowDays,
      computedAt,
      reportCount,
      distinctClusters,
      pctAdditionalFee: null,
      medianExtraMinor: null,
      avgVisits: null,
      kSatisfied: false,
      alertActive: false,
    };
  }

  // Count reports that indicate extra fee requested (outcome_code = 2 or extraFeeMinor > 0)
  const additionalFeeOutcomes = outcomes.filter((o) => {
    if (o.outcomeCode === 2) return true;
    if (typeof o.extraFeeMinor === 'number' && o.extraFeeMinor > 0) return true;
    return false;
  });

  const pctAdditionalFee =
    Math.round((additionalFeeOutcomes.length / reportCount) * 1000) / 10;

  // Extra fees for median computation
  const extraFees = outcomes
    .map((o) => o.extraFeeMinor)
    .filter((fee): fee is number => typeof fee === 'number' && fee > 0);

  const medianExtraMinor = calculateMedianMinor(extraFees);

  // Average visits calculation
  const visitsList = outcomes
    .map((o) => o.visitsReported)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const avgVisits =
    visitsList.length > 0
      ? Math.round(
          (visitsList.reduce((acc, curr) => acc + curr, 0) / visitsList.length) * 10
        ) / 10
      : 1.0;

  const alertActive = isDivergenceAlertActive(
    reportCount,
    distinctClusters,
    pctAdditionalFee
  );

  return {
    serviceId,
    windowDays,
    computedAt,
    reportCount,
    distinctClusters,
    pctAdditionalFee,
    medianExtraMinor,
    avgVisits,
    kSatisfied: true,
    alertActive,
  };
}

/**
 * Projects a divergence aggregate into public contract shape per 05 §6 and 07 §7.
 * Security Invariant: Below k, the returned object contains ONLY:
 * { kSatisfied: false, windowDays, noticeKey: "divergence.not_enough_reports", minimumRequired: 5 }
 * No report counts, no percentages, no medians.
 */
export function toPublicObservedDivergence(
  aggregate: DivergenceAggregateDomain | null | undefined,
  windowDays: number = DEFAULT_WINDOW_DAYS
): PublicObservedDivergenceDto {
  if (
    !aggregate ||
    !aggregate.kSatisfied ||
    !isKAnonymitySatisfied(aggregate.distinctClusters, K_MIN_CLUSTERS)
  ) {
    return {
      kSatisfied: false,
      windowDays: aggregate?.windowDays ?? windowDays,
      noticeKey: SUPPRESSION_NOTICE_KEY,
      minimumRequired: K_MIN_CLUSTERS,
    };
  }

  return {
    kSatisfied: true,
    windowDays: aggregate.windowDays,
    reportCount: aggregate.reportCount,
    distinctClusters: aggregate.distinctClusters,
    pctAdditionalFee: aggregate.pctAdditionalFee ?? 0,
    medianExtraMinor: aggregate.medianExtraMinor ?? 0,
    avgVisits: aggregate.avgVisits ?? 1.0,
    ...(aggregate.alertActive ? { alertActive: true } : {}),
  };
}

/**
 * Normalizes statutory document specifications to string array of label keys.
 */
export function normalizeRequiredDocuments(
  docs: RequiredDocumentSpec[]
): string[] {
  if (!Array.isArray(docs)) {
    return [];
  }
  return docs.map((d) => (typeof d === 'string' ? d : d.labelKey));
}

/**
 * Extracts structured documents with audio keys when available.
 */
export function extractDocumentsWithAudio(
  docs: RequiredDocumentSpec[]
): StatutoryDocumentItem[] {
  if (!Array.isArray(docs)) {
    return [];
  }
  return docs.map((d) =>
    typeof d === 'string' ? { labelKey: d } : { labelKey: d.labelKey, audioKey: d.audioKey }
  );
}

/**
 * Selects the active statutory rule for a service given an effective evaluation date.
 * Rules must satisfy: valid_from <= asOfDate AND (valid_to is null OR valid_to >= asOfDate).
 * Tie-break: highest valid_from (latest effective circular).
 */
export function findActiveStatutoryRule(
  rules: StatutoryRuleDomain[],
  asOf: Date | string
): StatutoryRuleDomain | null {
  const asOfDate = typeof asOf === 'string' ? new Date(asOf) : asOf;
  const asOfTime = asOfDate.getTime();

  const candidates = rules.filter((r) => {
    const fromTime = new Date(r.validFrom).getTime();
    if (isNaN(fromTime) || fromTime > asOfTime) {
      return false;
    }
    if (r.validTo) {
      const toTime = new Date(r.validTo).getTime();
      if (!isNaN(toTime) && toTime < asOfTime) {
        return false;
      }
    }
    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const timeA = new Date(a.validFrom).getTime();
    const timeB = new Date(b.validFrom).getTime();
    return timeB - timeA;
  });

  return candidates[0];
}

/**
 * Assembles the full StatutoryCardResponseDto per 05 §6.
 */
export function buildStatutoryCardResponse(params: {
  service: ServiceDomain;
  rule: StatutoryRuleDomain;
  sourceDoc?: {
    title: string;
    pageCount?: number;
  } | null;
  aggregate?: DivergenceAggregateDomain | null;
}): StatutoryCardResponseDto {
  const { service, rule, sourceDoc, aggregate } = params;

  const sourceDto: StatutorySourceDto | null = sourceDoc
    ? {
        title: sourceDoc.title,
        page: rule.sourcePage ?? null,
        reviewer: rule.reviewerInitials,
        reviewedAt: rule.reviewedAt,
      }
    : null;

  const statutorySection: StatutorySectionDto = {
    feeCeilingMinor: rule.feeCeilingMinor,
    currency: rule.currency,
    requiredDocuments: normalizeRequiredDocuments(rule.requiredDocuments),
    expectedVisits: rule.expectedVisits,
    refusalScriptKey: rule.refusalScriptKey,
    appealRouteKey: rule.appealRouteKey,
    source: sourceDto,
    documentsWithAudio: extractDocumentsWithAudio(rule.requiredDocuments),
  };

  return {
    serviceCode: service.code,
    officeCode: service.officeCode,
    statutory: statutorySection,
    observed: toPublicObservedDivergence(aggregate),
  };
}
