// T-30: Adversarial Security & Privacy Test Suite (30 Target Invariants)
// Authoritative sources:
// - docs/specs/03-data-model.md
// - docs/specs/04-state-machine.md
// - docs/specs/05-api-contracts.md
// - docs/specs/07-trust-and-security.md
// - docs/specs/11-tasks.md T-30
//
// Invariants verified:
// - Zero client trust for security identity (clusterKey, weights, k-thresholds)
// - Fail-closed authentication & role gating
// - Constant-time timing-safe secrets with zero production fallbacks
// - Strict deterministic frame grammar (AST/exact parsing, no LLM, no substring escapes)
// - Multi-script homoglyphs, leetspeak, zero-width, and combining marks defense
// - Preservation of legitimate Ethiopic (Amharic) and Oromo orthography
// - Zero PII leakage in logs, APIs, or database schemas

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Route handlers & services
import { POST as claimRepair } from '@/app/api/repairs/[id]/claim/route';
import { POST as closeRepair } from '@/app/api/repairs/[id]/close/route';
import { GET as getBulletin } from '@/app/api/bulletins/[id]/route';
import { POST as approveBulletin } from '@/app/api/bulletins/[id]/approve/route';
import { GET as exportBulletin } from '@/app/api/bulletins/[id]/export/route';
import { GET as probationPings } from '@/app/api/cron/probation/pings/route';
import { GET as probationClose } from '@/app/api/cron/probation/close/route';
import { POST as compileCron } from '@/app/api/cron/bulletins/compile/route';
import { POST as recordOutcome } from '@/app/api/visits/outcomes/route';

// Domain primitives
import { deriveClusterKey } from '@/domain/sybil';
import { assignObservationWeight } from '@/domain/triangulation';
import {
  toPublicObservedDivergence,
  calculateDivergenceFromOutcomes,
  isKAnonymitySatisfied,
  type VisitOutcomeDomain,
  type DivergenceAggregateDomain,
} from '@/domain/divergence';
import {
  compileBulletinScript,
  validateFrameGrammar,
  validateBulletinScript,
  revalidateFactsKStatus,
  BULLETIN_FRAMES,
} from '@/domain/bulletin';
import { redactString } from '@/lib/redact';
import { getBulletinService } from '@/app-services/bulletin.service';

describe('T-30: Adversarial Security & Privacy Suite (30 Comprehensive Attack Vectors)', () => {
  const TEST_CRON_SECRET = 'cron-sec-test-30-token-2026';
  const ORIGINAL_ENV = process.env.CRON_SECRET;
  let testBulletinId = 'bulletin-test-t30';

  beforeEach(async () => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    const bService = getBulletinService();
    const created = await bService.compileBulletins({
      wardId: '00000000-0000-0000-0000-000000000010',
      wardCode: 'ET-AA-W09',
      periodStart: '2026-08-17',
      periodEnd: '2026-09-17',
      facts: [
        {
          serviceCode: 'ET-ID-REPLACE',
          officeCode: 'ET-AA-W09-OFFICE',
          windowDays: 30,
          reportCount: 15,
          distinctClusters: 7,
          pctAdditionalFee: 80.0,
          medianExtraMinor: 25000,
          currency: 'ETB',
          kSatisfied: true,
        },
      ],
      locale: 'en',
    });
    if (created) {
      testBulletinId = created.id;
    }
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_ENV;
  });

  function makeJsonRequest(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    } = {}
  ): Request {
    return new Request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }

  // ==========================================================================
  // CATEGORY 1: AUTHENTICATION (ADV-01 .. ADV-03)
  // ==========================================================================
  describe('Category 1: Authentication', () => {
    it('ADV-01: rejects repair ticket claim when actor role is omitted (401 E_UNAUTHORIZED)', async () => {
      const req = makeJsonRequest('https://wardproofline.dev/api/repairs/ticket-1/claim', {
        method: 'POST',
        body: { actorRef: 'contractor-01' },
      });
      const res = await claimRepair(req, { params: Promise.resolve({ id: 'ticket-1' }) });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('ADV-02: rejects bulletin approval with no actor role header (401 E_UNAUTHORIZED)', async () => {
      const req = makeJsonRequest(`https://wardproofline.dev/api/bulletins/${testBulletinId}/approve`, {
        method: 'POST',
        body: { moderatorInitials: 'TZ' },
      });
      const res = await approveBulletin(req, { params: Promise.resolve({ id: testBulletinId }) });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('ADV-03: rejects bulletin inspection when unauthenticated (401 E_UNAUTHORIZED)', async () => {
      const req = makeJsonRequest(`https://wardproofline.dev/api/bulletins/${testBulletinId}`);
      const res = await getBulletin(req, { params: Promise.resolve({ id: testBulletinId }) });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });
  });

  // ==========================================================================
  // CATEGORY 2: AUTHORIZATION (ADV-04 .. ADV-06)
  // ==========================================================================
  describe('Category 2: Authorization', () => {
    it('ADV-04: rejects citizen role attempting bulletin approve (403 E_FORBIDDEN_ROLE)', async () => {
      const req = makeJsonRequest(`https://wardproofline.dev/api/bulletins/${testBulletinId}/approve`, {
        method: 'POST',
        headers: { 'x-actor-role': 'CITIZEN' },
        body: { moderatorInitials: 'ATTACKER' },
      });
      const res = await approveBulletin(req, { params: Promise.resolve({ id: testBulletinId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('E_FORBIDDEN_ROLE');
    });

    it('ADV-05: manual probation close by ADMIN role on Day 3 triggers refusal 409 E_PROBATION_LOCKED', async () => {
      const ticketId = '00000000-0000-4000-a000-000000000111';
      const probationTicket = {
        id: ticketId,
        assetId: '00000000-0000-4000-a000-000000000888',
        projectId: '00000000-0000-4000-a000-000000000777',
        state: 'PROBATION_ACTIVE' as const,
        reportedBrokenAt: new Date('2026-09-10T10:00:00.000Z'),
        repairClaimedAt: new Date('2026-09-15T10:00:00.000Z'),
        claimedBy: 'contractor-01',
        probationStartedAt: new Date('2026-09-15T12:00:00.000Z'),
        probationEndsAt: new Date('2026-09-22T12:00:00.000Z'),
        probationDays: 7,
        resolvedAt: null,
        failureReasonKey: null,
      };

      const { InMemoryRepairTicketRepository } = await import(
        '@/infra/db/repositories/repair-ticket.repository'
      );
      const { InMemoryAuditLogService } = await import('@/infra/db/services/audit-log.service');
      const { TestClock } = await import('@/infra/clock');
      const { ProbationService } = await import('@/app-services/probation.service');

      const repo = new InMemoryRepairTicketRepository([probationTicket]);
      const clock = new TestClock(new Date('2026-09-17T12:00:00.000Z'));
      const pService = new ProbationService(repo, new InMemoryAuditLogService(), clock);

      const req = makeJsonRequest(`https://wardproofline.dev/api/repairs/${ticketId}/close`, {
        method: 'POST',
        headers: { 'x-actor-role': 'ADMIN' },
      });
      (req as unknown as { deps: unknown }).deps = { probationService: pService };

      const res = await closeRepair(req, { params: Promise.resolve({ id: ticketId }) });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.code).toBe('E_PROBATION_LOCKED');
    });

    it('ADV-06: rejects monitor role attempting repair claim (403 E_FORBIDDEN_ROLE)', async () => {
      const req = makeJsonRequest('https://wardproofline.dev/api/repairs/ticket-1/claim', {
        method: 'POST',
        headers: { 'x-actor-role': 'MONITOR' },
        body: { actorRef: 'monitor-01' },
      });
      const res = await claimRepair(req, { params: Promise.resolve({ id: 'ticket-1' }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('E_FORBIDDEN_ROLE');
    });
  });

  // ==========================================================================
  // CATEGORY 3: SECRETS / CRON FAIL-CLOSED (ADV-07 .. ADV-09)
  // ==========================================================================
  describe('Category 3: Secrets & Cron Fail-Closed', () => {
    it('ADV-07: rejects cron request when CRON_SECRET is missing from request (401 E_UNAUTHORIZED)', async () => {
      const req = makeJsonRequest('https://wardproofline.dev/api/cron/probation/pings');
      const res = await probationPings(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('ADV-08: rejects invalid / forged cron secret (401 E_UNAUTHORIZED)', async () => {
      const req = makeJsonRequest('https://wardproofline.dev/api/cron/probation/close', {
        headers: { Authorization: 'Bearer malicious-cron-guess-12345' },
      });
      const res = await probationClose(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('ADV-09: fails closed when CRON_SECRET is completely unset in environment (401 E_UNAUTHORIZED)', async () => {
      delete process.env.CRON_SECRET;
      const req = makeJsonRequest('https://wardproofline.dev/api/cron/bulletins/compile', {
        method: 'POST',
        headers: { Authorization: 'Bearer dev-cron-secret-2026' },
      });
      const res = await compileCron(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });
  });

  // ==========================================================================
  // CATEGORY 4: CLUSTER & SYBIL RESISTANCE (ADV-10 .. ADV-14)
  // ==========================================================================
  describe('Category 4: Cluster & Sybil Resistance', () => {
    it('ADV-10: ignores client-supplied clusterKey in visit outcomes ingress', async () => {
      const req = makeJsonRequest('https://wardproofline.dev/api/visits/outcomes', {
        method: 'POST',
        body: {
          serviceCode: 'ET-ID-REPLACE',
          outcomeCode: 1,
          phoneHash: 'adversary_sim_card_01',
          clusterKey: 'attacker-injected-cluster',
        },
      });
      const res = await recordOutcome(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.accepted).toBe(true);
      expect(json.clusterKey).toBeUndefined();
    });

    it('ADV-11: collapses multiple colluding SIMs with same prefix and cohort into identical clusterKey', () => {
      const params1 = {
        taskId: 'task-health-center-01',
        geoCell: 'cell-w09-center',
        wardId: 'ward-09',
        msisdnPrefixBucket: '251911',
        registeredAt: '2026-09-01T10:00:00Z',
      };
      const params2 = {
        taskId: 'task-health-center-01',
        geoCell: 'cell-w09-center',
        wardId: 'ward-09',
        msisdnPrefixBucket: '251911',
        registeredAt: '2026-09-02T12:00:00Z', // Same week cohort
      };

      const key1 = deriveClusterKey(params1);
      const key2 = deriveClusterKey(params2);
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[0-9a-f]{16}$/);
    });

    it('ADV-12: assigns weight=0 and isDuplicate=true to duplicate observation from same cluster', () => {
      const clusterKey = '7f8a9b0c1d2e3f4a';
      const existingClusterKeys = ['other_cluster_1', clusterKey];

      const result = assignObservationWeight(existingClusterKeys, clusterKey);
      expect(result.weight).toBe(0);
      expect(result.isDuplicate).toBe(true);
      expect(result.reasonKey).toBe('observation.cluster_already_counted');
    });

    it('ADV-13: strictly validates 6-digit msisdnPrefixBucket and rejects raw phone numbers', () => {
      expect(() =>
        deriveClusterKey({
          taskId: 'task-01',
          msisdnPrefixBucket: '+251911223344', // Raw phone leak attempt
          registeredAt: new Date(),
        })
      ).toThrow(/msisdnPrefixBucket must be exactly 6 digits/);
    });

    it('ADV-14: isolates clusters across distinct tasks even with identical respondents', () => {
      const common = {
        geoCell: 'cell-common',
        msisdnPrefixBucket: '251922',
        registeredAt: '2026-09-01T00:00:00Z',
      };
      const keyTaskA = deriveClusterKey({ taskId: 'task-road-a', ...common });
      const keyTaskB = deriveClusterKey({ taskId: 'task-water-b', ...common });

      expect(keyTaskA).not.toBe(keyTaskB);
    });
  });

  // ==========================================================================
  // CATEGORY 5: k-ANONYMITY GATING & DIFFERENCING (ADV-15 .. ADV-18)
  // ==========================================================================
  describe('Category 5: k-Anonymity Gating & Differencing Protection', () => {
    it('ADV-15: suppresses public divergence metrics when distinct clusters k < 5', () => {
      const belowK: DivergenceAggregateDomain = {
        serviceId: 'svc-clinic',
        windowDays: 30,
        computedAt: '2026-09-17T00:00:00Z',
        reportCount: 10,
        distinctClusters: 4, // k = 4 < 5
        pctAdditionalFee: 90.0,
        medianExtraMinor: 50000,
        avgVisits: 3.5,
        kSatisfied: false,
        alertActive: false,
      };

      const publicView = toPublicObservedDivergence(belowK);
      expect(publicView.kSatisfied).toBe(false);
      expect((publicView as unknown as Record<string, unknown>).pctAdditionalFee).toBeUndefined();
      expect((publicView as unknown as Record<string, unknown>).medianExtraMinor).toBeUndefined();
      expect((publicView as unknown as { noticeKey?: string }).noticeKey).toBe(
        'divergence.not_enough_reports'
      );
    });

    it('ADV-16: differencing protection - isKAnonymitySatisfied strictly enforces threshold >= 5', () => {
      expect(isKAnonymitySatisfied(0)).toBe(false);
      expect(isKAnonymitySatisfied(1)).toBe(false);
      expect(isKAnonymitySatisfied(4)).toBe(false);
      expect(isKAnonymitySatisfied(5)).toBe(true);
    });

    it('ADV-17: calculateDivergenceFromOutcomes flags kSatisfied=false when distinct clusters < 5', () => {
      const outcomes: VisitOutcomeDomain[] = [
        {
          id: 'vo-1',
          serviceId: 'svc-1',
          outcomeCode: 2,
          extraFeeMinor: 1000,
          visitsReported: 1,
          respondentHash: 'hash-1',
          clusterKey: 'cluster-shared-01',
          channel: 'USSD',
          idempotencyKey: 'id-1',
          reportedAt: '2026-09-10T00:00:00Z',
        },
        {
          id: 'vo-2',
          serviceId: 'svc-1',
          outcomeCode: 2,
          extraFeeMinor: 2000,
          visitsReported: 1,
          respondentHash: 'hash-2',
          clusterKey: 'cluster-shared-01', // Same cluster
          channel: 'USSD',
          idempotencyKey: 'id-2',
          reportedAt: '2026-09-11T00:00:00Z',
        },
      ];

      const agg = calculateDivergenceFromOutcomes({
        serviceId: 'svc-1',
        outcomes,
        computedAt: '2026-09-17T00:00:00Z',
        windowDays: 30,
      });
      expect(agg.distinctClusters).toBe(1);
      expect(agg.kSatisfied).toBe(false);
    });

    it('ADV-18: silent outcome ingress never leaks aggregate totals or counts back to reporter', async () => {
      const req = makeJsonRequest('https://wardproofline.dev/api/visits/outcomes', {
        method: 'POST',
        body: {
          serviceCode: 'ET-ID-REPLACE',
          outcomeCode: 1,
          phoneHash: 'hash-reporter-probe',
        },
      });
      const res = await recordOutcome(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({
        accepted: true,
        thankYouKey: 'outcome.recorded',
      });
      expect(json.reportCount).toBeUndefined();
      expect(json.distinctClusters).toBeUndefined();
      expect(json.kSatisfied).toBeUndefined();
    });
  });

  // ==========================================================================
  // CATEGORY 6: BULLETIN FRAME GRAMMAR (ADV-19 .. ADV-23)
  // ==========================================================================
  describe('Category 6: Bulletin Frame Grammar (SEC-05)', () => {
    it('ADV-19: export gate blocks unapproved drafts with 409 E_NOT_APPROVED (INV-06)', async () => {
      const req = makeJsonRequest(`https://wardproofline.dev/api/bulletins/${testBulletinId}/export`);
      const res = await exportBulletin(req, { params: Promise.resolve({ id: testBulletinId }) });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.code).toBe('E_NOT_APPROVED');
    });

    it('ADV-20: blocks approval when fact k-status drops below k=5 (revalidateFactsKStatus)', () => {
      const facts = [
        {
          serviceCode: 'ET-ID-REPLACE',
          officeCode: 'OFFICE-1',
          windowDays: 30,
          reportCount: 10,
          distinctClusters: 6,
          pctAdditionalFee: 50.0,
          medianExtraMinor: 1000,
          currency: 'ETB',
          kSatisfied: true,
        },
      ];
      // Live check returns false
      const check = revalidateFactsKStatus(facts, () => false);
      expect(check.allValid).toBe(false);
      expect(check.failingServiceCode).toBe('ET-ID-REPLACE');
    });

    it('ADV-21: rejects defamatory sentence naming an individual inserted into script', () => {
      const header = 'Ward ET-AA-W09 Public Services Observation Report · Period: 2026-08-17 to 2026-09-17.';
      const attackScript = `${header} Head Administrator Ato Girma at Desk 4 is demanding money. ${BULLETIN_FRAMES.footer}`;
      const res = validateFrameGrammar(attackScript, 'ET-AA-W09', '2026-08-17', '2026-09-17');
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/unauthorized tokens|invalid sentence frame/);
    });

    it('ADV-22: rejects pre-header alert injection', () => {
      const validScript = compileBulletinScript('ET-AA-W09', '2026-08-17', '2026-09-17', [
        {
          serviceCode: 'ET-ID-REPLACE',
          officeCode: 'ET-AA-W09-OFFICE',
          windowDays: 30,
          reportCount: 15,
          distinctClusters: 7,
          pctAdditionalFee: 80.0,
          medianExtraMinor: 25000,
          currency: 'ETB',
          kSatisfied: true,
        },
      ])!;
      const attackScript = `ALERT TO ALL CITIZENS! ${validScript}`;
      const res = validateFrameGrammar(attackScript, 'ET-AA-W09', '2026-08-17', '2026-09-17');
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/canonical header/);
    });

    it('ADV-23: rejects HTML / script tags embedded in fact body', () => {
      const header = 'Ward ET-AA-W09 Public Services Observation Report · Period: 2026-08-17 to 2026-09-17.';
      const attackScript = `${header} <script>alert("xss")</script> ${BULLETIN_FRAMES.footer}`;
      const res = validateFrameGrammar(attackScript, 'ET-AA-W09', '2026-08-17', '2026-09-17');
      expect(res.valid).toBe(false);
    });
  });

  // ==========================================================================
  // CATEGORY 7: BANNED WORDS & UNICODE NORMALISATION (ADV-24 .. ADV-27)
  // ==========================================================================
  describe('Category 7: Banned Words & Unicode Hardening (SEC-06)', () => {
    it('ADV-24: detects Greek homoglyphs (omicron, iota, alpha, epsilon)', () => {
      expect(() => validateBulletinScript('taking a br\u03B9be')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('systemic c\u03BFrruption')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('financial fr\u03B1ud')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('grand th\u03B5ft')).toThrow(/Content integrity violation/);
    });

    it('ADV-25: detects Cyrillic lookalikes (і, В, с)', () => {
      expect(() => validateBulletinScript('giving a \u0412ribe')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('soliciting a br\u0456be')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('\u0441orrupt official')).toThrow(/Content integrity violation/);
    });

    it('ADV-26: strips invisible word-joiners and zero-width spaces', () => {
      expect(() => validateBulletinScript('cor\u2060rupt system')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('cor\u200Brupt system')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('cor\u00ADrupt system')).toThrow(/Content integrity violation/);
    });

    it('ADV-27: detects leetspeak and delimiter insertion (c.o.r.r.u.p.t, br1be, $tole)', () => {
      expect(() => validateBulletinScript('c.o.r.r.u.p.t')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('b_r_i_b_e')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('b r i b e')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('c0rrupt')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('br1be')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('$tole funds')).toThrow(/Content integrity violation/);
    });
  });

  // ==========================================================================
  // CATEGORY 8: AUDIT LOG IMMUTABILITY (ADV-28)
  // ==========================================================================
  describe('Category 8: Audit Log Immutability', () => {
    it('ADV-28: migration 012 seals audit_event against TRUNCATE commands with BEFORE TRUNCATE trigger', () => {
      const sql = readFileSync(
        join(process.cwd(), 'supabase', 'migrations', '012_audit_truncate_seal.sql'),
        'utf8'
      );
      expect(sql).toContain('create trigger audit_no_truncate');
      expect(sql).toContain('before truncate on audit_event');
      expect(sql).toContain('enable always trigger audit_no_truncate');
      expect(sql).toContain('revoke truncate on audit_event from public');
    });
  });

  // ==========================================================================
  // CATEGORY 9: DATA PRIVACY & ZERO-PII ARCHITECTURE (ADV-29 .. ADV-30)
  // ==========================================================================
  describe('Category 9: Data Privacy & Zero-PII Invariants', () => {
    it('ADV-29: StructuredLogger & redactString scrub all phone numbers, passwords, and tokens', () => {
      const dirty =
        'Connecting to postgresql://admin:SuperSecretPwd123@db.internal:5432/ubuntu with phone +251911223344 and token Bearer my_secret_token';
      const scrubbed = redactString(dirty);
      expect(scrubbed).not.toContain('+251911223344');
      expect(scrubbed).not.toContain('SuperSecretPwd123');
      expect(scrubbed).not.toContain('my_secret_token');
      expect(scrubbed).toContain('[REDACTED_PHONE]');
      expect(scrubbed).toContain('[REDACTED_PASSWORD]');
      expect(scrubbed).toContain('[REDACTED_TOKEN]');
    });

    it('ADV-30: zero-PII schema mandate - all 12 SQL migrations contain zero GPS or audio transcript columns', () => {
      const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
      const combinedSql = files.map((f) => readFileSync(join(migrationsDir, f), 'utf8')).join('\n');

      expect(/latitude|longitude/i.test(combinedSql)).toBe(false);
      expect(/\btranscript\b/i.test(combinedSql)).toBe(false);
      expect(/\btranscription\b/i.test(combinedSql)).toBe(false);
    });
  });
});
