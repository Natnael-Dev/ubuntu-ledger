// Unit tests for Probation Cron Service (T-21)
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03, INV-04, INV-05)
// - docs/specs/05-api-contracts.md §7, §11
// - docs/specs/11-tasks.md T-21
// - docs/specs/03-data-model.md §6

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProbationCronService,
  type ProcessPingsResult,
  type EvaluateClosedProbationsResult,
} from '@/app-services/probation-cron.service';
import {
  InMemoryRepairTicketRepository,
  type RepairTicketRecord,
} from '@/infra/db/repositories/repair-ticket.repository';
import { InMemoryAuditLogService } from '@/infra/db/services/audit-log.service';
import { TestClock } from '@/infra/clock';
import { DEMO_IDS } from '@/fixtures/demo-scenario';

describe('T-21: Probation Cron Service (04-state-machine.md §3, 11-tasks.md T-21)', () => {
  let repairTicketRepo: InMemoryRepairTicketRepository;
  let auditLogService: InMemoryAuditLogService;
  let clock: TestClock;
  let cronService: ProbationCronService;

  const START_TIME = new Date('2026-09-10T10:00:00.000Z');
  const DAY_1_TIME = new Date(START_TIME.getTime() + 1 * 24 * 60 * 60 * 1000);
  const DAY_3_TIME = new Date(START_TIME.getTime() + 3 * 24 * 60 * 60 * 1000);
  const DAY_7_TIME = new Date(START_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);
  const DAY_8_TIME = new Date(START_TIME.getTime() + 8 * 24 * 60 * 60 * 1000);

  function createActiveTicket(overrides?: Partial<RepairTicketRecord>): RepairTicketRecord {
    return {
      id: '00000000-0000-4000-a000-000000000111',
      assetId: '00000000-0000-4000-a000-000000000222',
      projectId: DEMO_IDS.PROJECT_4412,
      wardId: DEMO_IDS.WARD_W09,
      state: 'PROBATION_ACTIVE',
      reportedBrokenAt: new Date(START_TIME.getTime() - 24 * 60 * 60 * 1000),
      repairClaimedAt: START_TIME,
      claimedBy: 'AfroTech Infra',
      probationStartedAt: START_TIME,
      probationEndsAt: DAY_7_TIME,
      probationDays: 7,
      resolvedAt: null,
      failureReasonKey: null,
      originalReporterClusters: ['cluster-alpha', 'cluster-beta'],
      ...overrides,
    };
  }

  beforeEach(() => {
    clock = new TestClock(START_TIME);
    repairTicketRepo = new InMemoryRepairTicketRepository([]);
    auditLogService = new InMemoryAuditLogService();
    cronService = new ProbationCronService(repairTicketRepo, auditLogService, clock);
  });

  describe('1. Ping Generation & Idempotency', () => {
    it('generates Day-1, Day-3, and Day-7 pings targeting original reporter clusters only', async () => {
      const ticket = createActiveTicket();
      repairTicketRepo.seed(ticket);

      const pings = await cronService.generatePingsForTicket(ticket, [1, 3, 7]);

      // 3 days * 2 original reporter clusters = 6 pings
      expect(pings.length).toBe(6);

      const day1Pings = pings.filter((p) => p.scheduledFor.getTime() === DAY_1_TIME.getTime());
      expect(day1Pings.length).toBe(2);
      expect(day1Pings.map((p) => p.clusterKey).sort()).toEqual(['cluster-alpha', 'cluster-beta']);

      const day3Pings = pings.filter((p) => p.scheduledFor.getTime() === DAY_3_TIME.getTime());
      expect(day3Pings.length).toBe(2);
      expect(day3Pings.map((p) => p.clusterKey).sort()).toEqual(['cluster-alpha', 'cluster-beta']);

      const day7Pings = pings.filter((p) => p.scheduledFor.getTime() === DAY_7_TIME.getTime());
      expect(day7Pings.length).toBe(2);
      expect(day7Pings.map((p) => p.clusterKey).sort()).toEqual(['cluster-alpha', 'cluster-beta']);
    });

    it('is idempotent: generating pings twice creates no duplicate pings', async () => {
      const ticket = createActiveTicket();
      repairTicketRepo.seed(ticket);

      const firstRun = await cronService.generatePingsForTicket(ticket);
      expect(firstRun.length).toBe(6);

      const secondRun = await cronService.generatePingsForTicket(ticket);
      expect(secondRun.length).toBe(6);

      const allPings = await repairTicketRepo.getPingsByTicketId(ticket.id);
      expect(allPings.length).toBe(6);
    });
  });

  describe('2. Ping Processing & Hourly Cron Run (T-21 Acceptance)', () => {
    it('dispatches due pings and marks them sent with immutable audit logs', async () => {
      const ticket = createActiveTicket();
      repairTicketRepo.seed(ticket);
      await cronService.generatePingsForTicket(ticket);

      // Advance clock to Day 3
      clock.travel(3 * 24 * 60 * 60 * 1000);

      const result: ProcessPingsResult = await cronService.processPings();
      expect(result.ok).toBe(true);

      // Day 1 (2 pings) and Day 3 (2 pings) are due, Day 7 (2 pings) is not due
      expect(result.processedCount).toBe(4);
      expect(result.pings.length).toBe(4);

      for (const ping of result.pings) {
        expect(ping.sentAt).toEqual(clock.now());
      }

      // Assert audit log records PROBATION_PING_SENT
      const events = auditLogService.getEvents();
      expect(events.length).toBe(4);
      expect(events[0].action).toBe('PROBATION_PING_SENT');
      expect(events[0].entity_type).toBe('probation_ping');
      expect(events[0].actor_role).toBe('SYSTEM');
    });

    it('T-21 acceptance: running the cron twice in a minute produces zero duplicate pings', async () => {
      const ticket = createActiveTicket();
      repairTicketRepo.seed(ticket);
      await cronService.generatePingsForTicket(ticket);

      clock.travel(3 * 24 * 60 * 60 * 1000); // Day 3

      // First run in the minute
      const run1 = await cronService.processPings();
      expect(run1.processedCount).toBe(4);

      // Second run 30 seconds later in the same minute
      clock.travel(30 * 1000);
      const run2 = await cronService.processPings();
      expect(run2.processedCount).toBe(0);
      expect(run2.pings.length).toBe(0);

      // Total audit events remains 4, no duplicates
      const events = auditLogService.getEvents();
      expect(events.length).toBe(4);
    });
  });

  describe('3. Citizen Verification Response & Immediate Failure (04-state-machine.md §3, T-21)', () => {
    it('positive recheck response records confirmation and maintains state', async () => {
      const ticket = createActiveTicket();
      repairTicketRepo.seed(ticket);
      const [ping] = await cronService.generatePingsForTicket(ticket);

      const res = await cronService.recordPingResponse({
        pingId: ping.id,
        stillWorking: true,
      });

      expect(res.ok).toBe(true);
      expect(res.state).toBe('PROBATION_ACTIVE');

      const ticketAfter = await repairTicketRepo.getTicketById(ticket.id);
      expect(ticketAfter?.state).toBe('PROBATION_ACTIVE');
    });

    it('T-21 acceptance: failure report during probation immediately flips ticket to PROBATION_FAILED', async () => {
      const ticket = createActiveTicket();
      repairTicketRepo.seed(ticket);
      const [ping] = await cronService.generatePingsForTicket(ticket);

      const failTime = new Date(START_TIME.getTime() + 2 * 24 * 60 * 60 * 1000);
      clock.travel(2 * 24 * 60 * 60 * 1000);

      const res = await cronService.recordPingResponse({
        pingId: ping.id,
        stillWorking: false,
        reasonKey: 'pump_leakage_reoccurred',
        at: failTime,
      });

      expect(res.ok).toBe(true);
      expect(res.state).toBe('PROBATION_FAILED');
      expect(res.failureReasonKey).toBe('pump_leakage_reoccurred');

      // Verify ticket state mutated in repository
      const updatedTicket = await repairTicketRepo.getTicketById(ticket.id);
      expect(updatedTicket?.state).toBe('PROBATION_FAILED');
      expect(updatedTicket?.failureReasonKey).toBe('pump_leakage_reoccurred');

      // Verify audit trail recorded state transition
      const events = auditLogService.getEvents();
      const lastEvent = events[events.length - 1];
      expect(lastEvent.action).toBe('AUDIT_STATE_CHANGED');
      expect(lastEvent.payload).toMatchObject({
        from: 'PROBATION_ACTIVE',
        to: 'PROBATION_FAILED',
        failureReasonKey: 'pump_leakage_reoccurred',
      });
    });
  });

  describe('4. Close-Probation Evaluation & INV-01 Enforcement', () => {
    it('evaluates closed probation: transitions to VERIFIED_SUSTAINED when probation_ends_at <= now and no failures', async () => {
      const ticket = createActiveTicket({
        state: 'PROBATION_ACTIVE',
        probationEndsAt: DAY_7_TIME,
        failureReasonKey: null,
      });
      repairTicketRepo.seed(ticket);

      // Advance clock past Day 7
      clock.travel(8 * 24 * 60 * 60 * 1000);

      const result: EvaluateClosedProbationsResult = await cronService.evaluateClosedProbations();

      expect(result.ok).toBe(true);
      expect(result.sustainedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const updated = await repairTicketRepo.getTicketById(ticket.id);
      expect(updated?.state).toBe('VERIFIED_SUSTAINED');
      expect(updated?.resolvedAt).toEqual(clock.now());

      // Assert audit log written for state transition
      const events = auditLogService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('AUDIT_STATE_CHANGED');
      expect(events[0].payload).toMatchObject({
        from: 'PROBATION_ACTIVE',
        to: 'VERIFIED_SUSTAINED',
      });
    });

    it('INV-01: NEVER transitions to VERIFIED_SUSTAINED before probation_ends_at', async () => {
      const ticket = createActiveTicket({
        state: 'PROBATION_ACTIVE',
        probationEndsAt: DAY_7_TIME,
      });
      repairTicketRepo.seed(ticket);

      // Travel to Day 3 (early)
      clock.travel(3 * 24 * 60 * 60 * 1000);

      const evalResult = await cronService.evaluateClosedProbations();
      expect(evalResult.sustainedCount).toBe(0);
      expect(evalResult.skippedCount).toBe(1);

      // Verify ticket state is completely unchanged
      const ticketAfter = await repairTicketRepo.getTicketById(ticket.id);
      expect(ticketAfter?.state).toBe('PROBATION_ACTIVE');
      expect(ticketAfter?.resolvedAt).toBeNull();

      // Direct closure attempt throws E_PROBATION_LOCKED and writes audit attempt
      await expect(
        cronService.closeProbationTicket(ticket.id, 'SYSTEM')
      ).rejects.toThrow('Ticket cannot be closed before');

      const events = auditLogService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('MANUAL_CLOSE_ATTEMPT');
      expect(events[0].payload).toMatchObject({
        reason: 'E_PROBATION_LOCKED',
        result: 'REJECTED',
      });
    });

    it('does not transition ticket if unresolved failures exist', async () => {
      const ticket = createActiveTicket({
        state: 'PROBATION_ACTIVE',
        probationEndsAt: DAY_7_TIME,
        failureReasonKey: 'motor_overheating',
      });
      repairTicketRepo.seed(ticket);

      clock.travel(8 * 24 * 60 * 60 * 1000);

      const evalResult = await cronService.evaluateClosedProbations();
      expect(evalResult.sustainedCount).toBe(0);
      expect(evalResult.failedCount).toBe(1);

      const ticketAfter = await repairTicketRepo.getTicketById(ticket.id);
      expect(ticketAfter?.state).not.toBe('VERIFIED_SUSTAINED');
    });
  });

  describe('5. Stable Repository Query Methods for T-22 Console Board', () => {
    it('listTicketsByWard returns all tickets for the specified ward', async () => {
      const ticket1 = createActiveTicket({
        id: 't-1',
        wardId: DEMO_IDS.WARD_W09,
      });
      const ticket2 = createActiveTicket({
        id: 't-2',
        wardId: 'other-ward-uuid',
      });
      repairTicketRepo.seed(ticket1);
      repairTicketRepo.seed(ticket2);

      const wardTickets = await repairTicketRepo.listTicketsByWard(DEMO_IDS.WARD_W09);
      expect(wardTickets.length).toBe(1);
      expect(wardTickets[0].id).toBe('t-1');
    });

    it('findActiveProbationTickets returns tickets in active probation states', async () => {
      const activeTicket = createActiveTicket({
        id: 't-active',
        state: 'PROBATION_ACTIVE',
      });
      const sustainedTicket = createActiveTicket({
        id: 't-sustained',
        state: 'VERIFIED_SUSTAINED',
      });
      repairTicketRepo.seed(activeTicket);
      repairTicketRepo.seed(sustainedTicket);

      const activeTickets = await repairTicketRepo.findActiveProbationTickets();
      const ids = activeTickets.map((t) => t.id);
      expect(ids).toContain('t-active');
      expect(ids).not.toContain('t-sustained');
    });

    it('findPendingPings filters by asOf timestamp and unsent status', async () => {
      const ping1 = await repairTicketRepo.schedulePing({
        ticketId: 't-1',
        respondentId: 'r-1',
        scheduledFor: DAY_1_TIME,
      });
      const ping2 = await repairTicketRepo.schedulePing({
        ticketId: 't-1',
        respondentId: 'r-2',
        scheduledFor: DAY_7_TIME,
      });

      const pendingAtDay3 = await repairTicketRepo.findPendingPings(DAY_3_TIME);
      expect(pendingAtDay3.length).toBe(1);
      expect(pendingAtDay3[0].id).toBe(ping1.id);

      await repairTicketRepo.markPingSent(ping1.id, DAY_3_TIME);
      const pendingAfterSent = await repairTicketRepo.findPendingPings(DAY_3_TIME);
      expect(pendingAfterSent.length).toBe(0);
    });
  });
});
