// Unit tests for Probation Cron HTTP Routes (T-21)
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01)
// - docs/specs/05-api-contracts.md §7, §11
// - docs/specs/11-tasks.md T-21

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET as pingsRoute, POST as pingsPostRoute } from '@/app/api/cron/probation/pings/route';
import { GET as closeRoute } from '@/app/api/cron/probation/close/route';
import { ProbationCronService } from '@/app-services/probation-cron.service';
import {
  InMemoryRepairTicketRepository,
  type RepairTicketRecord,
} from '@/infra/db/repositories/repair-ticket.repository';
import { InMemoryAuditLogService } from '@/infra/db/services/audit-log.service';
import { TestClock } from '@/infra/clock';
import { DEMO_IDS } from '@/fixtures/demo-scenario';

describe('T-21: Probation Cron Endpoints (05-api-contracts.md §11, 11-tasks.md T-21)', () => {
  let repairTicketRepo: InMemoryRepairTicketRepository;
  let auditLogService: InMemoryAuditLogService;
  let clock: TestClock;
  let probationCronService: ProbationCronService;

  const CRON_SECRET = 'test-secret-4412-xyz';
  const ORIGINAL_ENV = process.env.CRON_SECRET;

  const BASE_TIME = new Date('2026-09-10T08:00:00.000Z');
  const DAY_7_TIME = new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    clock = new TestClock(BASE_TIME);
    repairTicketRepo = new InMemoryRepairTicketRepository([]);
    auditLogService = new InMemoryAuditLogService();
    probationCronService = new ProbationCronService(
      repairTicketRepo,
      auditLogService,
      clock
    );
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_ENV;
  });

  function createRequest(
    url: string,
    options?: {
      headers?: Record<string, string>;
      method?: string;
    }
  ): Request {
    const req = new Request(url, {
      method: options?.method || 'GET',
      headers: options?.headers || {},
    });

    (req as unknown as { deps: unknown }).deps = {
      probationCronService,
    };

    return req;
  }

  describe('1. Authentication via CRON_SECRET (05 §11)', () => {
    it('rejects /api/cron/probation/pings without auth header (401 E_UNAUTHORIZED)', async () => {
      const req = createRequest('http://localhost/api/cron/probation/pings');
      const res = await pingsRoute(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('E_UNAUTHORIZED');
    });

    it('rejects /api/cron/probation/pings with invalid bearer token (401 E_UNAUTHORIZED)', async () => {
      const req = createRequest('http://localhost/api/cron/probation/pings', {
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      });
      const res = await pingsRoute(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('E_UNAUTHORIZED');
    });

    it('accepts /api/cron/probation/pings with valid Authorization: Bearer <CRON_SECRET>', async () => {
      const req = createRequest('http://localhost/api/cron/probation/pings', {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
      });
      const res = await pingsRoute(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it('accepts /api/cron/probation/pings with valid x-cron-secret header', async () => {
      const req = createRequest('http://localhost/api/cron/probation/pings', {
        headers: {
          'x-cron-secret': CRON_SECRET,
        },
      });
      const res = await pingsRoute(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it('rejects /api/cron/probation/close without auth header (401 E_UNAUTHORIZED)', async () => {
      const req = createRequest('http://localhost/api/cron/probation/close');
      const res = await closeRoute(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('E_UNAUTHORIZED');
    });

    it('accepts /api/cron/probation/close with valid Bearer auth', async () => {
      const req = createRequest('http://localhost/api/cron/probation/close', {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
      });
      const res = await closeRoute(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('2. GET /api/cron/probation/pings', () => {
    it('processes due pings and dispatches notifications', async () => {
      const ticket: RepairTicketRecord = {
        id: '00000000-0000-4000-a000-000000000777',
        assetId: '00000000-0000-4000-a000-000000000888',
        projectId: DEMO_IDS.PROJECT_4412,
        wardId: DEMO_IDS.WARD_W09,
        state: 'PROBATION_ACTIVE',
        reportedBrokenAt: BASE_TIME,
        repairClaimedAt: BASE_TIME,
        claimedBy: 'AfroTech Infra',
        probationStartedAt: BASE_TIME,
        probationEndsAt: DAY_7_TIME,
        probationDays: 7,
        resolvedAt: null,
        failureReasonKey: null,
        originalReporterClusters: ['cluster-alpha', 'cluster-beta'],
      };
      repairTicketRepo.seed(ticket);

      // Advance clock to Day 3
      clock.travel(3 * 24 * 60 * 60 * 1000);

      const req = createRequest('http://localhost/api/cron/probation/pings', {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });

      const res = await pingsRoute(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.processedCount).toBe(4); // Day 1 (2 clusters) + Day 3 (2 clusters)
      expect(body.pings.length).toBe(4);

      // Calling POST route also succeeds
      const postReq = createRequest('http://localhost/api/cron/probation/pings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      const postRes = await pingsPostRoute(postReq);
      expect(postRes.status).toBe(200);
      const postBody = await postRes.json();
      // Already sent, so 0 processed
      expect(postBody.processedCount).toBe(0);
    });
  });

  describe('3. GET /api/cron/probation/close', () => {
    it('evaluates and closes tickets whose probation window has elapsed', async () => {
      const ticket: RepairTicketRecord = {
        id: '00000000-0000-4000-a000-000000000555',
        assetId: '00000000-0000-4000-a000-000000000666',
        projectId: DEMO_IDS.PROJECT_4412,
        wardId: DEMO_IDS.WARD_W09,
        state: 'PROBATION_ACTIVE',
        reportedBrokenAt: BASE_TIME,
        repairClaimedAt: BASE_TIME,
        claimedBy: 'AfroTech Infra',
        probationStartedAt: BASE_TIME,
        probationEndsAt: DAY_7_TIME,
        probationDays: 7,
        resolvedAt: null,
        failureReasonKey: null,
        originalReporterClusters: ['cluster-alpha', 'cluster-beta'],
      };
      repairTicketRepo.seed(ticket);

      // Advance clock past Day 7
      clock.travel(8 * 24 * 60 * 60 * 1000);

      const req = createRequest('http://localhost/api/cron/probation/close', {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });

      const res = await closeRoute(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.sustainedCount).toBe(1);
      expect(body.tickets[0]).toMatchObject({
        ticketId: ticket.id,
        previousState: 'PROBATION_ACTIVE',
        currentState: 'VERIFIED_SUSTAINED',
      });

      const updated = await repairTicketRepo.getTicketById(ticket.id);
      expect(updated?.state).toBe('VERIFIED_SUSTAINED');
    });

    it('INV-01: Does not close immature tickets before probation_ends_at', async () => {
      const ticket: RepairTicketRecord = {
        id: '00000000-0000-4000-a000-000000000333',
        assetId: '00000000-0000-4000-a000-000000000444',
        projectId: DEMO_IDS.PROJECT_4412,
        wardId: DEMO_IDS.WARD_W09,
        state: 'PROBATION_ACTIVE',
        reportedBrokenAt: BASE_TIME,
        repairClaimedAt: BASE_TIME,
        claimedBy: 'AfroTech Infra',
        probationStartedAt: BASE_TIME,
        probationEndsAt: DAY_7_TIME,
        probationDays: 7,
        resolvedAt: null,
        failureReasonKey: null,
        originalReporterClusters: ['cluster-alpha', 'cluster-beta'],
      };
      repairTicketRepo.seed(ticket);

      // Clock at Day 3 (not Day 7 yet)
      clock.travel(3 * 24 * 60 * 60 * 1000);

      const req = createRequest('http://localhost/api/cron/probation/close', {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });

      const res = await closeRoute(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.sustainedCount).toBe(0);
      expect(body.skippedCount).toBe(1);

      const ticketAfter = await repairTicketRepo.getTicketById(ticket.id);
      expect(ticketAfter?.state).toBe('PROBATION_ACTIVE');
    });
  });
});
