// Unit tests for Repair Probation HTTP Routes & Governance Refusal
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03, INV-05)
// - docs/specs/05-api-contracts.md §0, §8
// - docs/specs/11-tasks.md T-20
// - docs/specs/14-testing-and-edge-cases.md ADV-08

import { describe, it, expect, beforeEach } from 'vitest';
import { POST as claimRoute } from '@/app/api/repairs/[id]/claim/route';
import { POST as closeRoute } from '@/app/api/repairs/[id]/close/route';
import { ProbationService } from '@/app-services/probation.service';
import {
  InMemoryRepairTicketRepository,
  type RepairTicketRecord,
} from '@/infra/db/repositories/repair-ticket.repository';
import { InMemoryAuditLogService } from '@/infra/db/services/audit-log.service';
import { TestClock } from '@/infra/clock';
import { DEMO_IDS, DEMO_TIMELINE } from '@/fixtures/demo-scenario';
import type { ActorRole } from '@/domain/types';

describe('T-20: Probation Endpoints and the Refusal (05-api-contracts.md §8, ADV-08)', () => {
  let repairTicketRepo: InMemoryRepairTicketRepository;
  let auditLogService: InMemoryAuditLogService;
  let clock: TestClock;
  let probationService: ProbationService;

  // Canonical Day 3 timestamp for demo ticket (Started 2026-09-15, Ends 2026-09-22)
  const DAY_3_TIME = new Date('2026-09-17T12:00:00.000Z');

  beforeEach(() => {
    clock = new TestClock(DAY_3_TIME);
    repairTicketRepo = new InMemoryRepairTicketRepository();
    auditLogService = new InMemoryAuditLogService();
    probationService = new ProbationService(
      repairTicketRepo,
      auditLogService,
      clock
    );
  });

  describe('1. POST /api/repairs/[id]/claim', () => {
    it('successfully claims repair, returns refusal flag (closureAvailable: false) and schema', async () => {
      const ticketId = '00000000-0000-4000-a000-000000000999';
      const brokenTicket: RepairTicketRecord = {
        id: ticketId,
        assetId: '00000000-0000-4000-a000-000000000888',
        projectId: '00000000-0000-4000-a000-000000000777',
        state: 'REPORTED_BROKEN',
        reportedBrokenAt: new Date('2026-09-10T10:00:00.000Z'),
        repairClaimedAt: null,
        claimedBy: null,
        probationStartedAt: null,
        probationEndsAt: null,
        probationDays: 7,
        resolvedAt: null,
        failureReasonKey: null,
      };
      repairTicketRepo.seed(brokenTicket);

      const req = new Request(
        `http://localhost/api/repairs/${ticketId}/claim`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-role': 'INGEST_REVIEWER',
          },
          body: JSON.stringify({
            claimedBy: 'AfroTech Infra',
            claimedAt: '2026-09-15T08:00:00.000Z',
            evidenceNote: 'Generator stator replaced and tested under load',
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await claimRoute(req, {
        params: Promise.resolve({ id: ticketId }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const body = await response.json();
      expect(body).toEqual({
        state: 'REPAIR_CLAIMED',
        closureAvailable: false,
        reasonKey: 'probation.claim_does_not_close',
        probationDays: 7,
      });

      // Assert repository state mutated to REPAIR_CLAIMED
      const updated = await repairTicketRepo.getTicketById(ticketId);
      expect(updated?.state).toBe('REPAIR_CLAIMED');
      expect(updated?.claimedBy).toBe('AfroTech Infra');

      // Assert audit log recorded state transition with proper actorRole
      const events = auditLogService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('AUDIT_STATE_CHANGED');
      expect(events[0].actor_role).toBe('INGEST_REVIEWER');
      expect(events[0].entity_type).toBe('repair_ticket');
      expect(events[0].entity_id).toBe(ticketId);
      expect(events[0].payload).toMatchObject({
        from: 'REPORTED_BROKEN',
        to: 'REPAIR_CLAIMED',
        claimedBy: 'AfroTech Infra',
        evidenceNote: 'Generator stator replaced and tested under load',
      });
    });

    it('handles idempotent claim on already claimed demo ticket', async () => {
      const ticketId = DEMO_IDS.TICKET_4412;
      const req = new Request(
        `http://localhost/api/repairs/${ticketId}/claim`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-role': 'INGEST_REVIEWER',
          },
          body: JSON.stringify({
            claimedBy: 'AfroTech Infra',
            claimedAt: DEMO_TIMELINE.REPAIR_CLAIMED_AT,
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await claimRoute(req, {
        params: Promise.resolve({ id: ticketId }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        state: 'REPAIR_CLAIMED',
        closureAvailable: false,
        reasonKey: 'probation.claim_does_not_close',
        probationDays: 7,
      });
    });

    it('rejects unauthenticated claim requests with 401 E_UNAUTHORIZED', async () => {
      const ticketId = DEMO_IDS.TICKET_4412;
      const req = new Request(
        `http://localhost/api/repairs/${ticketId}/claim`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            claimedBy: 'AfroTech Infra',
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await claimRoute(req, {
        params: Promise.resolve({ id: ticketId }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('E_UNAUTHORIZED');
      expect(body.title).toBe('Unauthorized');
    });

    it('rejects claim requests with unauthorized role (e.g. CITIZEN) with 403 E_FORBIDDEN_ROLE', async () => {
      const ticketId = DEMO_IDS.TICKET_4412;
      const req = new Request(
        `http://localhost/api/repairs/${ticketId}/claim`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-role': 'CITIZEN',
          },
          body: JSON.stringify({
            claimedBy: 'AfroTech Infra',
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await claimRoute(req, {
        params: Promise.resolve({ id: ticketId }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe('E_FORBIDDEN_ROLE');
    });

    it('records actual claiming actor role in audit event chain instead of hardcoding false audit actor', async () => {
      const ticketId = '00000000-0000-4000-a000-000000000998';
      const brokenTicket: RepairTicketRecord = {
        id: ticketId,
        assetId: '00000000-0000-4000-a000-000000000888',
        projectId: '00000000-0000-4000-a000-000000000777',
        state: 'REPORTED_BROKEN',
        reportedBrokenAt: new Date('2026-09-10T10:00:00.000Z'),
        repairClaimedAt: null,
        claimedBy: null,
        probationStartedAt: null,
        probationEndsAt: null,
        probationDays: 7,
        resolvedAt: null,
        failureReasonKey: null,
      };
      repairTicketRepo.seed(brokenTicket);

      const req = new Request(
        `http://localhost/api/repairs/${ticketId}/claim`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-role': 'ADMIN',
            'x-actor-ref': 'admin-usr-123',
          },
          body: JSON.stringify({
            claimedBy: 'City Administration Direct Works',
            claimedAt: '2026-09-15T08:00:00.000Z',
            evidenceNote: 'Inspected and certified by municipal engineering directorate',
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await claimRoute(req, {
        params: Promise.resolve({ id: ticketId }),
      });

      expect(response.status).toBe(200);

      const events = auditLogService.getEvents();
      expect(events.length).toBe(1);
      // Confirms audit record has genuine ADMIN actor instead of hardcoded INGEST_REVIEWER
      expect(events[0].actor_role).toBe('ADMIN');
      expect(events[0].actor_ref).toBe('admin-usr-123');
    });

    it('rejects claim with empty organisation name (422 E_VALIDATION)', async () => {
      const ticketId = DEMO_IDS.TICKET_4412;
      const req = new Request(
        `http://localhost/api/repairs/${ticketId}/claim`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-role': 'INGEST_REVIEWER',
          },
          body: JSON.stringify({
            claimedBy: '   ',
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await claimRoute(req, {
        params: Promise.resolve({ id: ticketId }),
      });

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.code).toBe('E_VALIDATION');
    });

    it('returns 404 for non-existent ticket claim', async () => {
      const req = new Request(
        'http://localhost/api/repairs/non-existent-ticket-id/claim',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-role': 'INGEST_REVIEWER',
          },
          body: JSON.stringify({
            claimedBy: 'AfroTech Infra',
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await claimRoute(req, {
        params: Promise.resolve({ id: 'non-existent-ticket-id' }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe('E_NOT_FOUND');
    });
  });

  describe('2. POST /api/repairs/[id]/close (The Refusal & ADV-08)', () => {
    it('rejects early manual close on Day 3 with 409 E_PROBATION_LOCKED for ADMIN', async () => {
      const ticketId = DEMO_IDS.TICKET_4412;

      const req = new Request(
        `http://localhost/api/repairs/${ticketId}/close`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-actor-role': 'ADMIN',
          },
          body: JSON.stringify({
            actorRole: 'ADMIN',
          }),
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await closeRoute(req, {
        params: Promise.resolve({ id: ticketId }),
      });

      expect(response.status).toBe(409);
      expect(response.headers.get('Content-Type')).toBe(
        'application/problem+json'
      );

      const problem = await response.json();
      expect(problem).toMatchObject({
        type: 'https://wardproofline.dev/errors/probation_locked',
        title: 'Probation window is still open',
        status: 409,
        code: 'E_PROBATION_LOCKED',
        detail: `Ticket cannot be closed before ${DEMO_TIMELINE.PROBATION_ENDS_AT}.`,
        instance: `/api/repairs/${ticketId}/close`,
      });

      // Assert that MANUAL_CLOSE_ATTEMPT is recorded in the audit event chain (INV-01, INV-03)
      const events = auditLogService.getEvents();
      expect(events.length).toBe(1);
      const closeAttemptEvent = events[0];

      expect(closeAttemptEvent.action).toBe('MANUAL_CLOSE_ATTEMPT');
      expect(closeAttemptEvent.actor_role).toBe('ADMIN');
      expect(closeAttemptEvent.entity_type).toBe('repair_ticket');
      expect(closeAttemptEvent.entity_id).toBe(ticketId);
      expect(closeAttemptEvent.payload).toMatchObject({
        ticketId,
        actorRole: 'ADMIN',
        attemptedAt: DAY_3_TIME.toISOString(),
        probationEndsAt: DEMO_TIMELINE.PROBATION_ENDS_AT,
        reason: 'E_PROBATION_LOCKED',
        result: 'REJECTED',
      });
    });

    const roles: ActorRole[] = [
      'ADMIN',
      'MODERATOR',
      'CITIZEN',
      'MONITOR',
      'INGEST_REVIEWER',
      'SYSTEM',
    ];

    it.each(roles)(
      'INV-01: ALWAYS returns 409 E_PROBATION_LOCKED for role %s and writes to audit log',
      async (role) => {
        const ticketId = DEMO_IDS.TICKET_4412;

        const req = new Request(
          `http://localhost/api/repairs/${ticketId}/close`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-actor-role': role,
            },
            body: JSON.stringify({
              actorRole: role,
            }),
          }
        );
        (req as unknown as { deps: unknown }).deps = {
          probationService,
          repairTicketRepo,
          auditLogService,
          clock,
        };

        const response = await closeRoute(req, {
          params: Promise.resolve({ id: ticketId }),
        });

        expect(response.status).toBe(409);
        const problem = await response.json();
        expect(problem.code).toBe('E_PROBATION_LOCKED');

        const events = auditLogService.getEvents();
        const lastEvent = events[events.length - 1];
        expect(lastEvent.action).toBe('MANUAL_CLOSE_ATTEMPT');
        expect(lastEvent.actor_role).toBe(role);
        expect(lastEvent.payload).toMatchObject({
          ticketId,
          actorRole: role,
          reason: 'E_PROBATION_LOCKED',
        });
      }
    );

    it('returns 404 for non-existent ticket close attempt', async () => {
      const req = new Request(
        'http://localhost/api/repairs/unknown-ticket/close',
        {
          method: 'POST',
        }
      );
      (req as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };

      const response = await closeRoute(req, {
        params: Promise.resolve({ id: 'unknown-ticket' }),
      });

      expect(response.status).toBe(404);
      const problem = await response.json();
      expect(problem.code).toBe('E_NOT_FOUND');
    });
  });

  describe('3. Audit Chain Cryptographic Integrity across Attempts', () => {
    it('maintains strict sequential hashes and unalterable chain during refusal events', async () => {
      const ticketId = DEMO_IDS.TICKET_4412;

      // First close attempt by CITIZEN
      const req1 = new Request(
        `http://localhost/api/repairs/${ticketId}/close`,
        {
          method: 'POST',
          body: JSON.stringify({ actorRole: 'CITIZEN' }),
        }
      );
      (req1 as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };
      await closeRoute(req1, { params: Promise.resolve({ id: ticketId }) });

      // Second close attempt by ADMIN
      clock.travel(1000 * 60); // 1 minute later
      const req2 = new Request(
        `http://localhost/api/repairs/${ticketId}/close`,
        {
          method: 'POST',
          body: JSON.stringify({ actorRole: 'ADMIN' }),
        }
      );
      (req2 as unknown as { deps: unknown }).deps = {
        probationService,
        repairTicketRepo,
        auditLogService,
        clock,
      };
      await closeRoute(req2, { params: Promise.resolve({ id: ticketId }) });

      const events = auditLogService.getEvents();
      expect(events.length).toBe(2);

      expect(Number(events[0].seq)).toBe(1);
      expect(Number(events[1].seq)).toBe(2);
      expect(events[1].prev_hash).toBe(events[0].hash);

      expect(events[0].actor_role).toBe('CITIZEN');
      expect(events[1].actor_role).toBe('ADMIN');
      expect(events[0].action).toBe('MANUAL_CLOSE_ATTEMPT');
      expect(events[1].action).toBe('MANUAL_CLOSE_ATTEMPT');
    });
  });
});
