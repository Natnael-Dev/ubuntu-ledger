// Statutory Application Service
// Authoritative sources:
// - docs/specs/03-data-model.md §5
// - docs/specs/05-api-contracts.md §6
// - docs/specs/07-trust-and-security.md §7
// - docs/specs/11-tasks.md T-25

import type { Clock } from '@/infra/clock';
import { systemClock } from '@/infra/clock';
import { ServiceError } from './errors';
import {
  type StatutoryRuleDomain,
  type ServiceDomain,
  type VisitOutcomeDomain,
  type DivergenceAggregateDomain,
  type StatutoryCardResponseDto,
  type PublicObservedDivergenceDto,
  type RecordVisitOutcomeInput,
  type RecordVisitOutcomeResponseDto,
  isValidOutcomeCode,
  findActiveStatutoryRule,
  buildStatutoryCardResponse,
  calculateDivergenceFromOutcomes,
  DEFAULT_WINDOW_DAYS,
} from '@/domain/divergence';
import {
  DEMO_SERVICES,
  DEMO_STATUTORY_RULES,
  DEMO_SOURCE_DOCUMENTS,
  DEMO_DIVERGENCE_AGGREGATES,
  DEMO_VISIT_OUTCOMES_ID_REPLACE,
  DEMO_VISIT_OUTCOMES_CLINIC,
} from '@/fixtures/demo-scenario';

export interface StatutoryRepository {
  getServiceByCode(code: string): Promise<ServiceDomain | null>;
  getRulesForService(serviceId: string): Promise<StatutoryRuleDomain[]>;
  getSourceDocument(documentId: string): Promise<{ title: string; pageCount?: number } | null>;
  getDivergenceAggregate(
    serviceId: string,
    windowDays?: number
  ): Promise<DivergenceAggregateDomain | null>;
  getVisitOutcomes(serviceId: string): Promise<VisitOutcomeDomain[]>;
  saveVisitOutcome(outcome: VisitOutcomeDomain): Promise<void>;
  getVisitOutcomeByIdempotencyKey(key: string): Promise<VisitOutcomeDomain | null>;
  countVisitOutcomesByReporterAndDay(
    phoneHash: string,
    serviceId: string,
    dayDate: string
  ): Promise<number>;
}

/**
 * Default in-memory / fixture-backed repository for Statutory domain entities.
 */
export class FixtureStatutoryRepository implements StatutoryRepository {
  private services: ServiceDomain[] = DEMO_SERVICES.map((s) => ({
    id: s.id,
    wardId: s.wardId,
    code: s.code,
    officeCode: s.officeCode,
    labelKey: s.labelKey,
  }));

  private rules: StatutoryRuleDomain[] = DEMO_STATUTORY_RULES.map((r) => ({
    id: r.id,
    serviceId: r.serviceId,
    feeCeilingMinor: r.feeCeilingMinor,
    currency: r.currency,
    requiredDocuments: r.requiredDocuments,
    expectedVisits: r.expectedVisits,
    refusalScriptKey: r.refusalScriptKey,
    appealRouteKey: r.appealRouteKey,
    sourceDocumentId: r.sourceDocumentId,
    sourcePage: r.sourcePage,
    reviewerInitials: r.reviewerInitials,
    reviewedAt: r.reviewedAt,
    validFrom: r.validFrom,
    validTo: r.validTo,
  }));

  private sourceDocs = new Map(
    DEMO_SOURCE_DOCUMENTS.map((d) => [
      d.id,
      { title: d.title, pageCount: d.pageCount },
    ])
  );

  private aggregates: DivergenceAggregateDomain[] = DEMO_DIVERGENCE_AGGREGATES.map(
    (agg) => ({
      serviceId: agg.serviceId,
      windowDays: agg.windowDays,
      computedAt: agg.computedAt,
      reportCount: agg.reportCount,
      distinctClusters: agg.distinctClusters,
      pctAdditionalFee: agg.pctAdditionalFee,
      medianExtraMinor: agg.medianExtraMinor,
      avgVisits: agg.avgVisits,
      kSatisfied: agg.kSatisfied,
      alertActive: agg.alertActive,
    })
  );

  private visitOutcomes: VisitOutcomeDomain[] = [
    ...DEMO_VISIT_OUTCOMES_ID_REPLACE,
    ...DEMO_VISIT_OUTCOMES_CLINIC,
  ].map((vo) => ({
    id: vo.id,
    serviceId: vo.serviceId,
    outcomeCode: vo.outcomeCode,
    extraFeeMinor: vo.extraFeeMinor,
    visitsReported: vo.visitsReported,
    respondentHash: vo.respondentHash,
    clusterKey: vo.clusterKey,
    channel: vo.channel,
    idempotencyKey: vo.idempotencyKey,
    reportedAt: vo.reportedAt,
  }));

  async getServiceByCode(code: string): Promise<ServiceDomain | null> {
    const normalized = code.trim().toUpperCase();
    const svc = this.services.find(
      (s) => s.code.toUpperCase() === normalized
    );
    return svc || null;
  }

  async getRulesForService(serviceId: string): Promise<StatutoryRuleDomain[]> {
    return this.rules.filter((r) => r.serviceId === serviceId);
  }

  async getSourceDocument(
    documentId: string
  ): Promise<{ title: string; pageCount?: number } | null> {
    return this.sourceDocs.get(documentId) || null;
  }

  async getDivergenceAggregate(
    serviceId: string,
    windowDays: number = DEFAULT_WINDOW_DAYS
  ): Promise<DivergenceAggregateDomain | null> {
    const agg = this.aggregates.find(
      (a) => a.serviceId === serviceId && a.windowDays === windowDays
    );
    return agg || null;
  }

  async getVisitOutcomes(serviceId: string): Promise<VisitOutcomeDomain[]> {
    return this.visitOutcomes.filter((vo) => vo.serviceId === serviceId);
  }

  async saveVisitOutcome(outcome: VisitOutcomeDomain): Promise<void> {
    this.visitOutcomes.push(outcome);
  }

  async getVisitOutcomeByIdempotencyKey(
    key: string
  ): Promise<VisitOutcomeDomain | null> {
    const found = this.visitOutcomes.find((vo) => vo.idempotencyKey === key);
    return found || null;
  }

  async countVisitOutcomesByReporterAndDay(
    phoneHash: string,
    serviceId: string,
    dayDate: string
  ): Promise<number> {
    return this.visitOutcomes.filter(
      (vo) =>
        vo.respondentHash === phoneHash &&
        vo.serviceId === serviceId &&
        vo.reportedAt.startsWith(dayDate)
    ).length;
  }
}

export class StatutoryService {
  constructor(
    private readonly repo: StatutoryRepository = new FixtureStatutoryRepository(),
    private readonly clock: Clock = systemClock
  ) {}

  /**
   * Retrieves the statutory rule card and k-anonymous divergence aggregate for a service.
   * Throws 404 E_UNKNOWN_CODE if the service code is not registered.
   */
  async getStatutoryCard(
    serviceCode: string,
    options?: { asOf?: Date | string; windowDays?: number }
  ): Promise<StatutoryCardResponseDto> {
    if (!serviceCode || !serviceCode.trim()) {
      throw new ServiceError(
        'E_UNKNOWN_CODE',
        404,
        'Service code is required'
      );
    }

    const code = serviceCode.trim();
    const service = await this.repo.getServiceByCode(code);
    if (!service) {
      throw new ServiceError(
        'E_UNKNOWN_CODE',
        404,
        `Service '${code}' not found`
      );
    }

    // 1. Resolve active statutory rule
    const asOf = options?.asOf ?? this.clock.now();
    const rules = await this.repo.getRulesForService(service.id);
    const activeRule = findActiveStatutoryRule(rules, asOf);

    if (!activeRule) {
      throw new ServiceError(
        'E_NOT_FOUND',
        404,
        `No active statutory rule found for service '${code}'`
      );
    }

    // 2. Resolve source document citation if available
    const sourceDoc = activeRule.sourceDocumentId
      ? await this.repo.getSourceDocument(activeRule.sourceDocumentId)
      : null;

    // 3. Resolve divergence aggregate (or derive from outcomes)
    const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
    let aggregate = await this.repo.getDivergenceAggregate(
      service.id,
      windowDays
    );

    if (!aggregate) {
      // If not precomputed in aggregate table, compute on the fly from visit outcomes
      const outcomes = await this.repo.getVisitOutcomes(service.id);
      aggregate = calculateDivergenceFromOutcomes({
        serviceId: service.id,
        outcomes,
        windowDays,
        computedAt: this.clock.nowIso(),
      });
    }

    return buildStatutoryCardResponse({
      service,
      rule: activeRule,
      sourceDoc,
      aggregate,
    });
  }

  /**
   * Retrieves observed divergence with strict k-anonymity suppression.
   */
  async getObservedDivergence(
    serviceCode: string,
    windowDays: number = DEFAULT_WINDOW_DAYS
  ): Promise<PublicObservedDivergenceDto> {
    const card = await this.getStatutoryCard(serviceCode, { windowDays });
    return card.observed;
  }

  /**
   * Records a citizen visit outcome (T-26).
   * Enforces:
   * 1. Service code existence (404 E_UNKNOWN_CODE)
   * 2. Outcome code validity 1..5 (400 E_INVALID_OUTCOME_CODE)
   * 3. Extra fee non-negative & visits (1..20) validation (400 E_INVALID_INPUT)
   * 4. Idempotency by idempotencyKey: returns cached success without re-inserting
   * 5. Rate limit: max 3 reports per phoneHash per service per day (429 E_RATE_LIMITED)
   * 6. Silent response: NEVER echoes aggregate metrics (INV-07 / 05 §7)
   */
  async recordVisitOutcome(
    input: RecordVisitOutcomeInput
  ): Promise<RecordVisitOutcomeResponseDto> {
    const {
      serviceCode,
      outcomeCode,
      extraFeeMinor,
      visits,
      phoneHash,
      channel,
      idempotencyKey,
      clusterKey,
    } = input;

    if (!serviceCode || !serviceCode.trim()) {
      throw new ServiceError('E_UNKNOWN_CODE', 404, 'Service code is required');
    }

    const service = await this.repo.getServiceByCode(serviceCode.trim());
    if (!service) {
      throw new ServiceError(
        'E_UNKNOWN_CODE',
        404,
        `Service '${serviceCode}' not found`
      );
    }

    if (!isValidOutcomeCode(outcomeCode)) {
      throw new ServiceError(
        'E_INVALID_OUTCOME_CODE',
        400,
        `Invalid outcome code: ${outcomeCode}. Must be an integer between 1 and 5.`
      );
    }

    if (
      extraFeeMinor !== undefined &&
      extraFeeMinor !== null &&
      (!Number.isInteger(extraFeeMinor) || extraFeeMinor < 0)
    ) {
      throw new ServiceError(
        'E_INVALID_INPUT',
        400,
        'extraFeeMinor must be a non-negative integer'
      );
    }

    if (
      visits !== undefined &&
      visits !== null &&
      (!Number.isInteger(visits) || visits < 1 || visits > 20)
    ) {
      throw new ServiceError(
        'E_INVALID_INPUT',
        400,
        'visits must be an integer between 1 and 20'
      );
    }

    if (!phoneHash || !phoneHash.trim()) {
      throw new ServiceError('E_INVALID_INPUT', 400, 'phoneHash is required');
    }

    const effectiveIdempotencyKey =
      idempotencyKey?.trim() ||
      `outcome_${phoneHash.trim()}_${service.id}_${outcomeCode}_${this.clock.nowIso()}`;

    // 1. Check idempotency
    const existing = await this.repo.getVisitOutcomeByIdempotencyKey(
      effectiveIdempotencyKey
    );
    if (existing) {
      return { accepted: true, thankYouKey: 'outcome.recorded' };
    }

    // 2. Enforce rate limit (3 / phone_hash / service / day per 05 §12)
    const nowIso = this.clock.nowIso();
    const todayUtc = nowIso.slice(0, 10);
    const countToday = await this.repo.countVisitOutcomesByReporterAndDay(
      phoneHash.trim(),
      service.id,
      todayUtc
    );
    if (countToday >= 3) {
      throw new ServiceError(
        'E_RATE_LIMITED',
        429,
        'Daily submission limit reached: maximum 3 outcomes per service per day'
      );
    }

    // 3. Save outcome
    const effectiveClusterKey =
      clusterKey?.trim() || `cluster_${phoneHash.trim().slice(0, 8)}`;

    const outcomeRecord: VisitOutcomeDomain = {
      id: `vo_${Math.random().toString(36).substring(2, 11)}`,
      serviceId: service.id,
      outcomeCode,
      extraFeeMinor: extraFeeMinor ?? null,
      visitsReported: visits ?? null,
      respondentHash: phoneHash.trim(),
      clusterKey: effectiveClusterKey,
      channel: channel || 'USSD',
      idempotencyKey: effectiveIdempotencyKey,
      reportedAt: nowIso,
    };

    await this.repo.saveVisitOutcome(outcomeRecord);

    // Invariant: NEVER echo aggregate state
    return {
      accepted: true,
      thankYouKey: 'outcome.recorded',
    };
  }
}

let _statutoryServiceSingleton: StatutoryService | null = null;

/**
 * Returns a shared singleton StatutoryService instance.
 * Matches the factory pattern used by cron route handlers.
 */
export function getStatutoryService(): StatutoryService {
  if (!_statutoryServiceSingleton) {
    _statutoryServiceSingleton = new StatutoryService();
  }
  return _statutoryServiceSingleton;
}
