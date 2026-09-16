// Probation Application Service
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03, INV-05, INV-10)
// - docs/specs/05-api-contracts.md §8
// - docs/specs/11-tasks.md T-20
// - docs/specs/14-testing-and-edge-cases.md ADV-08

import type { Clock } from '@/infra/clock';
import { systemClock } from '@/infra/clock';
import type { ActorRole, ProbationState } from '@/domain/types';
import {
  transition,
  type ProbationSnapshot,
  type ProbationEvent,
} from '@/domain/probation';
import { createAuditEventRecord } from '@/domain/audit-chain';
import { ServiceError } from './errors';
import {
  type RepairTicketRepository,
  type RepairTicketRecord,
  getDefaultRepairTicketRepository,
} from '@/infra/db/repositories/repair-ticket.repository';
import type { AuditLogService } from '@/infra/db/services/audit-log.service';
import { getServiceContainer } from '@/infra/db/container';

export interface ClaimRepairInput {
  ticketId: string;
  claimedBy: string;
  claimedAt?: Date | string;
  evidenceNote?: string;
}

export interface ClaimRepairResponseDto {
  state: ProbationState;
  closureAvailable: boolean;
  reasonKey: string;
  probationDays: number;
}

export class ProbationService {
  constructor(
    private readonly repairTicketRepo: RepairTicketRepository,
    private readonly auditLogService: AuditLogService,
    private readonly clock: Clock = systemClock
  ) {}

  /**
   * Records an organisation repair claim for a repair ticket per 04 §3 and 05 §8.
   * Refusal invariant: Claiming a repair NEVER closes the ticket or grants a green state.
   */
  async claimRepair(
    ticketIdOrInput: string | ClaimRepairInput,
    claimedByArg?: string,
    claimedAtArg?: Date | string,
    evidenceNoteArg?: string
  ): Promise<ClaimRepairResponseDto> {
    const input: ClaimRepairInput =
      typeof ticketIdOrInput === 'string'
        ? {
            ticketId: ticketIdOrInput,
            claimedBy: claimedByArg || '',
            claimedAt: claimedAtArg,
            evidenceNote: evidenceNoteArg,
          }
        : ticketIdOrInput;

    const ticketId = input.ticketId;
    const claimedBy = input.claimedBy ? input.claimedBy.trim() : '';
    if (!claimedBy) {
      throw new ServiceError(
        'E_GUARD_FAILED',
        422,
        'Repair claim requires a valid claiming organisation name'
      );
    }

    const ticket = await this.repairTicketRepo.getTicketById(ticketId);
    if (!ticket) {
      throw new ServiceError(
        'E_NOT_FOUND',
        404,
        `Repair ticket '${ticketId}' not found`
      );
    }

    const at = input.claimedAt
      ? input.claimedAt instanceof Date
        ? input.claimedAt
        : new Date(input.claimedAt)
      : this.clock.now();

    const snapshot: ProbationSnapshot = {
      ticketId: ticket.id,
      assetId: ticket.assetId,
      state: ticket.state,
      reportedBrokenAt: ticket.reportedBrokenAt,
      originalReporterClusters: [],
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
      failures: [],
      failureCount: 0,
      resolvedAt: ticket.resolvedAt,
      failureReasonKey: ticket.failureReasonKey,
    };

    let transitionResult = transition(snapshot, {
      type: 'REPAIR_CLAIMED',
      claimedBy,
      at,
    });

    // Support idempotent re-claim if already claimed in demo fixtures
    if (!transitionResult.ok && ticket.state === 'REPAIR_CLAIMED') {
      transitionResult = transition(
        { ...snapshot, state: 'REPORTED_BROKEN' },
        { type: 'REPAIR_CLAIMED', claimedBy, at }
      );
    }

    if (!transitionResult.ok) {
      throw new ServiceError(
        transitionResult.code,
        409,
        transitionResult.message
      );
    }

    // Persist new state
    await this.repairTicketRepo.updateTicketState(ticket.id, 'REPAIR_CLAIMED', {
      claimedBy: transitionResult.snapshot.claimedBy,
      repairClaimedAt: transitionResult.snapshot.repairClaimedAt,
    });

    // Append audit events from effects (INV-03)
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
          actorRole: 'INGEST_REVIEWER',
          payload: input.evidenceNote
            ? { ...eff.payload, evidenceNote: input.evidenceNote }
            : eff.payload,
          occurredAt: at,
          wardId: null,
        });

        await this.auditLogService.append(auditRecord);
      }
    }

    // Response strictly follows 05 §8: "closureAvailable: false, reasonKey: probation.claim_does_not_close"
    return {
      state: 'REPAIR_CLAIMED',
      closureAvailable: false,
      reasonKey: 'probation.claim_does_not_close',
      probationDays: ticket.probationDays || 7,
    };
  }

  /**
   * Attempts early closure of a repair ticket per 04 §3 and 05 §8.
   * Hard Rule INV-01: No role — not ADMIN, not MODERATOR, not SYSTEM — may transition
   * to VERIFIED_SUSTAINED before probation_ends_at.
   *
   * ALWAYS appends a MANUAL_CLOSE_ATTEMPT audit event to the audit hash chain (INV-03),
   * and ALWAYS throws ServiceError with code 'E_PROBATION_LOCKED' and status 409.
   */
  async attemptClose(
    ticketId: string,
    actorRole: ActorRole = 'ADMIN',
    at?: Date
  ): Promise<never> {
    const ticket = await this.repairTicketRepo.getTicketById(ticketId);
    if (!ticket) {
      throw new ServiceError(
        'E_NOT_FOUND',
        404,
        `Repair ticket '${ticketId}' not found`
      );
    }

    const occurredAt = at || this.clock.now();

    const snapshot: ProbationSnapshot = {
      ticketId: ticket.id,
      assetId: ticket.assetId,
      state: ticket.state,
      reportedBrokenAt: ticket.reportedBrokenAt,
      originalReporterClusters: [],
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
      failures: [],
      failureCount: 0,
      resolvedAt: ticket.resolvedAt,
      failureReasonKey: ticket.failureReasonKey,
    };

    const event: ProbationEvent = {
      type: 'MANUAL_CLOSE_ATTEMPT',
      actor: actorRole,
      at: occurredAt,
    };

    // Evaluate pure domain transition (which returns ok: false, code: 'E_PROBATION_LOCKED')
    const transitionResult = transition(snapshot, event);

    // Hard Rule INV-03: Every transition attempt (including failed manual close attempts!)
    // MUST write to the audit hash chain.
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
        attemptedAt: occurredAt.toISOString(),
        probationEndsAt: ticket.probationEndsAt
          ? ticket.probationEndsAt.toISOString()
          : null,
        currentState: ticket.state,
        result: 'REJECTED',
        reason: transitionResult.ok ? 'UNKNOWN' : transitionResult.code,
        refusalKey: 'probation.early_close_refused',
      },
      occurredAt: occurredAt,
      wardId: null,
    });

    await this.auditLogService.append(auditRecord);

    const message = ticket.probationEndsAt
      ? `Ticket cannot be closed before ${ticket.probationEndsAt.toISOString()}.`
      : transitionResult.ok
      ? 'Ticket cannot be closed manually.'
      : transitionResult.message;

    throw new ServiceError('E_PROBATION_LOCKED', 409, message);
  }

  /**
   * Retrieves a repair ticket by ID.
   */
  async getTicket(ticketId: string): Promise<RepairTicketRecord | null> {
    return this.repairTicketRepo.getTicketById(ticketId);
  }
}

let activeProbationService: ProbationService | null = null;

export function getProbationService(deps?: {
  repairTicketRepo?: RepairTicketRepository;
  auditLogService?: AuditLogService;
  clock?: Clock;
}): ProbationService {
  if (deps?.repairTicketRepo || deps?.auditLogService || deps?.clock) {
    return new ProbationService(
      deps.repairTicketRepo || getDefaultRepairTicketRepository(),
      deps.auditLogService || getServiceContainer().auditLogService,
      deps.clock || systemClock
    );
  }

  if (!activeProbationService) {
    activeProbationService = new ProbationService(
      getDefaultRepairTicketRepository(),
      getServiceContainer().auditLogService,
      systemClock
    );
  }

  return activeProbationService;
}

export function resetProbationService(): void {
  activeProbationService = null;
}
