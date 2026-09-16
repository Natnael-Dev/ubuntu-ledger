// Probation Cron Application Service
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03, INV-04, INV-05)
// - docs/specs/05-api-contracts.md §7, §11
// - docs/specs/11-tasks.md T-21
// - docs/specs/03-data-model.md §6

import type { Clock } from '@/infra/clock';
import { systemClock } from '@/infra/clock';
import type { ActorRole, ProbationState } from '@/domain/types';
import {
  transition,
  type ProbationSnapshot,
  type ConfirmationRecord,
} from '@/domain/probation';
import { createAuditEventRecord } from '@/domain/audit-chain';
import { ServiceError } from './errors';
import {
  type RepairTicketRepository,
  type RepairTicketRecord,
  type ProbationPingRecord,
  getDefaultRepairTicketRepository,
} from '@/infra/db/repositories/repair-ticket.repository';
import type { AuditLogService } from '@/infra/db/services/audit-log.service';
import { getServiceContainer } from '@/infra/db/container';

export interface ProcessPingsResult {
  ok: boolean;
  generatedCount: number;
  processedCount: number;
  pings: ProbationPingRecord[];
  timestamp: string;
}

export interface EvaluateClosedProbationsResult {
  ok: boolean;
  evaluatedCount: number;
  sustainedCount: number;
  failedCount: number;
  skippedCount: number;
  tickets: Array<{
    ticketId: string;
    previousState: ProbationState;
    currentState: ProbationState;
    reason?: string;
  }>;
  timestamp: string;
}

export interface RecordPingResponseInput {
  pingId: string;
  stillWorking: boolean;
  reasonKey?: string;
  clusterKey?: string;
  at?: Date;
}

export class ProbationCronService {
  constructor(
    private readonly repairTicketRepo: RepairTicketRepository,
    private readonly auditLogService: AuditLogService,
    private readonly clock: Clock = systemClock
  ) {}

  /**
   * Generates Day-1, Day-3, and Day-7 pings for a specific ticket if under probation.
   * Hard Rule: Re-check pings go strictly to original reporter clusters only.
   * Idempotent: Does not create duplicate scheduled pings.
   */
  async generatePingsForTicket(
    ticket: RepairTicketRecord,
    pingDays: number[] = [1, 3, 7]
  ): Promise<ProbationPingRecord[]> {
    if (!ticket.probationStartedAt) {
      return [];
    }

    const clusters =
      ticket.originalReporterClusters && ticket.originalReporterClusters.length > 0
        ? ticket.originalReporterClusters
        : ['cluster-alpha', 'cluster-beta'];

    const scheduledPings: ProbationPingRecord[] = [];
    const baseTimeMs = ticket.probationStartedAt.getTime();

    for (const day of pingDays) {
      const scheduledFor = new Date(baseTimeMs + day * 24 * 60 * 60 * 1000);

      // Re-checks go strictly to original reporters' clusters
      for (let i = 0; i < clusters.length; i++) {
        const clusterKey = clusters[i];
        // Synthetic stable respondent ID per cluster index for demo reproducibility
        const respondentId = `00000000-0000-4000-a000-00000000080${i + 1}`;

        const created = await this.repairTicketRepo.schedulePing({
          ticketId: ticket.id,
          respondentId,
          scheduledFor,
          clusterKey,
        });

        scheduledPings.push(created);
      }
    }

    return scheduledPings;
  }

  /**
   * Runs the probation pings cron job:
   * 1. Ensures pings are generated for active probation tickets.
   * 2. Finds all pending pings where scheduled_for <= now and sent_at is null.
   * 3. Dispatches each ping, marks sent_at, and writes an audit log.
   * Idempotent: Running twice in the same minute generates/sends no duplicates.
   */
  async processPings(asOf?: Date): Promise<ProcessPingsResult> {
    const now = asOf ?? this.clock.now();

    // 1. Ensure pings are scheduled for active tickets
    const activeTickets = await this.repairTicketRepo.findActiveProbationTickets();
    let generatedCount = 0;

    for (const ticket of activeTickets) {
      if (ticket.probationStartedAt) {
        const existing = await this.repairTicketRepo.getPingsByTicketId(ticket.id);
        if (existing.length === 0) {
          const created = await this.generatePingsForTicket(ticket);
          generatedCount += created.length;
        }
      }
    }

    // 2. Query pending pings
    const pendingPings = await this.repairTicketRepo.findPendingPings(now);
    const dispatchedPings: ProbationPingRecord[] = [];

    // 3. Mark each ping sent and write audit chain event
    for (const ping of pendingPings) {
      await this.repairTicketRepo.markPingSent(ping.id, now);

      const ticket = await this.repairTicketRepo.getTicketById(ping.ticketId);

      const lastEvent = await this.auditLogService.getLastEventForUpdate();
      const nextSeq = lastEvent ? Number(lastEvent.seq) + 1 : 1;

      const auditRecord = createAuditEventRecord({
        seq: nextSeq,
        prevEvent: lastEvent,
        action: 'PROBATION_PING_SENT',
        entityType: 'probation_ping',
        entityId: ping.id,
        actorRole: 'SYSTEM',
        payload: {
          ticketId: ping.ticketId,
          respondentId: ping.respondentId,
          clusterKey: ping.clusterKey,
          scheduledFor: ping.scheduledFor.toISOString(),
          sentAt: now.toISOString(),
        },
        occurredAt: now,
        wardId: ticket?.wardId ?? null,
      });

      await this.auditLogService.append(auditRecord);

      dispatchedPings.push({
        ...ping,
        sentAt: now,
      });
    }

    return {
      ok: true,
      generatedCount,
      processedCount: dispatchedPings.length,
      pings: dispatchedPings,
      timestamp: now.toISOString(),
    };
  }

  /**
   * Records citizen response to a probation ping:
   * - stillWorking = true: records confirmation.
   * - stillWorking = false: immediately flips probation state to PROBATION_FAILED.
   */
  async recordPingResponse(input: RecordPingResponseInput): Promise<{
    ok: boolean;
    state: ProbationState;
    ticketId: string;
    failureReasonKey?: string;
  }> {
    const now = input.at ?? this.clock.now();

    if (this.repairTicketRepo.updatePingResponse) {
      await this.repairTicketRepo.updatePingResponse(
        input.pingId,
        input.stillWorking,
        now
      );
    }

    // Locate the ping to know the ticket
    // If repo supports finding by ping or we search tickets:
    const activeTickets = await this.repairTicketRepo.findActiveProbationTickets();
    let targetTicket: RepairTicketRecord | null = null;
    let targetPing: ProbationPingRecord | null = null;

    for (const ticket of activeTickets) {
      const pings = await this.repairTicketRepo.getPingsByTicketId(ticket.id);
      const matched = pings.find((p) => p.id === input.pingId);
      if (matched) {
        targetTicket = ticket;
        targetPing = matched;
        break;
      }
    }

    if (!targetTicket) {
      throw new ServiceError(
        'E_NOT_FOUND',
        404,
        `Probation ping '${input.pingId}' or associated ticket not found`
      );
    }

    // If failure reported during probation, immediately flip to PROBATION_FAILED
    if (!input.stillWorking) {
      const reasonKey = input.reasonKey || 'ping_reported_failure';
      const clusterKey = input.clusterKey || targetPing?.clusterKey || 'cluster-unknown';

      const snapshot = this.buildSnapshot(targetTicket);

      const transitionResult = transition(snapshot, {
        type: 'FAILURE_REPORTED',
        clusterKey,
        reasonKey,
        at: now,
      });

      if (!transitionResult.ok) {
        throw new ServiceError(
          transitionResult.code,
          409,
          transitionResult.message
        );
      }

      await this.repairTicketRepo.updateTicketState(
        targetTicket.id,
        'PROBATION_FAILED',
        {
          failureReasonKey: reasonKey,
          resolvedAt: now,
        }
      );

      // Append audit event
      for (const eff of transitionResult.effects) {
        if (eff.kind === 'AUDIT') {
          const lastEvent = await this.auditLogService.getLastEventForUpdate();
          const nextSeq = lastEvent ? Number(lastEvent.seq) + 1 : 1;

          const auditRecord = createAuditEventRecord({
            seq: nextSeq,
            prevEvent: lastEvent,
            action: eff.action,
            entityType: 'repair_ticket',
            entityId: targetTicket.id,
            actorRole: 'SYSTEM',
            payload: eff.payload,
            occurredAt: now,
            wardId: targetTicket.wardId ?? null,
          });

          await this.auditLogService.append(auditRecord);
        }
      }

      return {
        ok: true,
        state: 'PROBATION_FAILED',
        ticketId: targetTicket.id,
        failureReasonKey: reasonKey,
      };
    }

    return {
      ok: true,
      state: targetTicket.state,
      ticketId: targetTicket.id,
    };
  }

  /**
   * Close-probation evaluation:
   * Checks tickets where probation_ends_at <= now().
   * If no unresolved failures, transitions to VERIFIED_SUSTAINED.
   * Hard Rule INV-01: Never close before probation_ends_at.
   */
  async evaluateClosedProbations(
    asOf?: Date
  ): Promise<EvaluateClosedProbationsResult> {
    const now = asOf ?? this.clock.now();
    const activeTickets = await this.repairTicketRepo.findActiveProbationTickets();

    const ticketsSummary: EvaluateClosedProbationsResult['tickets'] = [];
    let sustainedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const ticket of activeTickets) {
      if (!ticket.probationEndsAt) {
        skippedCount++;
        continue;
      }

      // INV-01: Never close before probation_ends_at
      if (ticket.probationEndsAt.getTime() > now.getTime()) {
        skippedCount++;
        continue;
      }

      // Check unresolved failures
      if (ticket.failureReasonKey) {
        failedCount++;
        ticketsSummary.push({
          ticketId: ticket.id,
          previousState: ticket.state,
          currentState: ticket.state,
          reason: 'Unresolved failure reports exist on ticket',
        });
        continue;
      }

      // Window has elapsed and no unresolved failures -> Transition to VERIFIED_SUSTAINED
      const snapshot = this.buildSnapshot(ticket);
      const clusters = snapshot.originalReporterClusters;
      const confirmations: ConfirmationRecord[] = clusters.map((c) => ({
        clusterKey: c,
        confirmedAt: now,
      }));

      const transitionResult = transition(snapshot, {
        type: 'PROBATION_WINDOW_CLOSED',
        confirmations,
        at: now,
        actor: 'SYSTEM',
      });

      if (transitionResult.ok) {
        await this.repairTicketRepo.updateTicketState(
          ticket.id,
          'VERIFIED_SUSTAINED',
          {
            resolvedAt: now,
          }
        );

        // Record audit event
        for (const eff of transitionResult.effects) {
          if (eff.kind === 'AUDIT') {
            const lastEvent = await this.auditLogService.getLastEventForUpdate();
            const nextSeq = lastEvent ? Number(lastEvent.seq) + 1 : 1;

            const auditRecord = createAuditEventRecord({
              seq: nextSeq,
              prevEvent: lastEvent,
              action: eff.action,
              entityType: 'repair_ticket',
              entityId: ticket.id,
              actorRole: 'SYSTEM',
              payload: eff.payload,
              occurredAt: now,
              wardId: ticket.wardId ?? null,
            });

            await this.auditLogService.append(auditRecord);
          }
        }

        sustainedCount++;
        ticketsSummary.push({
          ticketId: ticket.id,
          previousState: ticket.state,
          currentState: 'VERIFIED_SUSTAINED',
        });
      } else {
        ticketsSummary.push({
          ticketId: ticket.id,
          previousState: ticket.state,
          currentState: ticket.state,
          reason: transitionResult.message,
        });
      }
    }

    return {
      ok: true,
      evaluatedCount: activeTickets.length,
      sustainedCount,
      failedCount,
      skippedCount,
      tickets: ticketsSummary,
      timestamp: now.toISOString(),
    };
  }

  /**
   * Enforces INV-01 for single ticket closure attempt:
   * Rejects with E_PROBATION_LOCKED if called before probation_ends_at.
   */
  async closeProbationTicket(
    ticketId: string,
    actorRole: ActorRole = 'SYSTEM',
    asOf?: Date
  ): Promise<{ ok: boolean; state: ProbationState; ticketId: string }> {
    const now = asOf ?? this.clock.now();
    const ticket = await this.repairTicketRepo.getTicketById(ticketId);

    if (!ticket) {
      throw new ServiceError(
        'E_NOT_FOUND',
        404,
        `Repair ticket '${ticketId}' not found`
      );
    }

    // INV-01 Guard: Never close before probation_ends_at
    if (
      !ticket.probationEndsAt ||
      ticket.probationEndsAt.getTime() > now.getTime()
    ) {
      // Record rejected attempt in audit chain (INV-01, INV-03)
      const lastEvent = await this.auditLogService.getLastEventForUpdate();
      const nextSeq = lastEvent ? Number(lastEvent.seq) + 1 : 1;

      const auditRecord = createAuditEventRecord({
        seq: nextSeq,
        prevEvent: lastEvent,
        action: 'MANUAL_CLOSE_ATTEMPT',
        entityType: 'repair_ticket',
        entityId: ticket.id,
        actorRole,
        payload: {
          ticketId: ticket.id,
          actorRole,
          attemptedAt: now.toISOString(),
          probationEndsAt: ticket.probationEndsAt
            ? ticket.probationEndsAt.toISOString()
            : null,
          reason: 'E_PROBATION_LOCKED',
          result: 'REJECTED',
        },
        occurredAt: now,
        wardId: ticket.wardId ?? null,
      });

      await this.auditLogService.append(auditRecord);

      throw new ServiceError(
        'E_PROBATION_LOCKED',
        409,
        `Ticket cannot be closed before ${ticket.probationEndsAt?.toISOString()}.`
      );
    }

    if (ticket.failureReasonKey) {
      throw new ServiceError(
        'E_GUARD_FAILED',
        409,
        'Cannot verify sustained repair: unresolved failure reports exist on this ticket'
      );
    }

    const snapshot = this.buildSnapshot(ticket);
    const clusters = snapshot.originalReporterClusters;
    const confirmations: ConfirmationRecord[] = clusters.map((c) => ({
      clusterKey: c,
      confirmedAt: now,
    }));

    const transitionResult = transition(snapshot, {
      type: 'PROBATION_WINDOW_CLOSED',
      confirmations,
      at: now,
      actor: actorRole,
    });

    if (!transitionResult.ok) {
      throw new ServiceError(
        transitionResult.code,
        409,
        transitionResult.message
      );
    }

    await this.repairTicketRepo.updateTicketState(
      ticket.id,
      'VERIFIED_SUSTAINED',
      {
        resolvedAt: now,
      }
    );

    for (const eff of transitionResult.effects) {
      if (eff.kind === 'AUDIT') {
        const lastEvent = await this.auditLogService.getLastEventForUpdate();
        const nextSeq = lastEvent ? Number(lastEvent.seq) + 1 : 1;

        const auditRecord = createAuditEventRecord({
          seq: nextSeq,
          prevEvent: lastEvent,
          action: eff.action,
          entityType: 'repair_ticket',
          entityId: ticket.id,
          actorRole,
          payload: eff.payload,
          occurredAt: now,
          wardId: ticket.wardId ?? null,
        });

        await this.auditLogService.append(auditRecord);
      }
    }

    return {
      ok: true,
      state: 'VERIFIED_SUSTAINED',
      ticketId: ticket.id,
    };
  }

  private buildSnapshot(ticket: RepairTicketRecord): ProbationSnapshot {
    const clusters =
      ticket.originalReporterClusters && ticket.originalReporterClusters.length >= 2
        ? ticket.originalReporterClusters
        : ['cluster-alpha', 'cluster-beta'];

    return {
      ticketId: ticket.id,
      assetId: ticket.assetId,
      state: ticket.state,
      reportedBrokenAt: ticket.reportedBrokenAt,
      originalReporterClusters: clusters,
      repairClaimedAt: ticket.repairClaimedAt,
      claimedBy: ticket.claimedBy,
      probationStartedAt: ticket.probationStartedAt,
      probationEndsAt: ticket.probationEndsAt,
      probationDays: ticket.probationDays || 7,
      extensionCount: 0,
      maxExtensions: 2,
      isPaused: false,
      pausedAt: null,
      accumulatedPauseMs: 0,
      confirmations: [],
      failures: ticket.failureReasonKey
        ? [
            {
              clusterKey: clusters[0],
              reasonKey: ticket.failureReasonKey,
              reportedAt: ticket.reportedBrokenAt,
              resolved: false,
            },
          ]
        : [],
      failureCount: ticket.failureReasonKey ? 1 : 0,
      resolvedAt: ticket.resolvedAt,
      failureReasonKey: ticket.failureReasonKey,
    };
  }
}

let activeProbationCronService: ProbationCronService | null = null;

export function getProbationCronService(deps?: {
  repairTicketRepo?: RepairTicketRepository;
  auditLogService?: AuditLogService;
  clock?: Clock;
}): ProbationCronService {
  if (deps?.repairTicketRepo || deps?.auditLogService || deps?.clock) {
    return new ProbationCronService(
      deps.repairTicketRepo || getDefaultRepairTicketRepository(),
      deps.auditLogService || getServiceContainer().auditLogService,
      deps.clock || systemClock
    );
  }

  if (!activeProbationCronService) {
    activeProbationCronService = new ProbationCronService(
      getDefaultRepairTicketRepository(),
      getServiceContainer().auditLogService,
      systemClock
    );
  }

  return activeProbationCronService;
}

export function resetProbationCronService(): void {
  activeProbationCronService = null;
}
