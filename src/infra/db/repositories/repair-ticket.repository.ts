// Repair Ticket Repository
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03, INV-05)
// - docs/specs/05-api-contracts.md §8
// - docs/specs/11-tasks.md T-20
// - docs/specs/03-data-model.md §6

import type { ProbationState } from '@/domain/types';
import { DEMO_REPAIR_TICKETS, DEMO_IDS } from '@/fixtures/demo-scenario';

export interface RepairTicketRecord {
  id: string;
  assetId: string;
  projectId?: string | null;
  state: ProbationState;
  reportedBrokenAt: Date;
  repairClaimedAt?: Date | null;
  claimedBy?: string | null;
  probationStartedAt?: Date | null;
  probationEndsAt?: Date | null;
  probationDays: number;
  resolvedAt?: Date | null;
  failureReasonKey?: string | null;
  createdAt?: Date;
}

export interface UpdateTicketExtra {
  repairClaimedAt?: Date | null;
  claimedBy?: string | null;
  probationStartedAt?: Date | null;
  probationEndsAt?: Date | null;
  probationDays?: number;
  resolvedAt?: Date | null;
  failureReasonKey?: string | null;
}

export interface RepairTicketRepository {
  /**
   * Retrieves a repair ticket by ID.
   */
  getTicketById(id: string): Promise<RepairTicketRecord | null>;

  /**
   * Updates the probation lifecycle state and optional extra metadata of a repair ticket.
   */
  updateTicketState(
    id: string,
    state: ProbationState,
    extra?: UpdateTicketExtra
  ): Promise<void>;

  /**
   * Optional helper to seed a ticket record directly.
   */
  seed?(ticket: RepairTicketRecord): void;
}

/**
 * In-memory repository implementation primed with canonical demo fixtures.
 */
export class InMemoryRepairTicketRepository implements RepairTicketRepository {
  private tickets: Map<string, RepairTicketRecord> = new Map();

  constructor(initialTickets?: RepairTicketRecord[]) {
    if (initialTickets && initialTickets.length > 0) {
      for (const t of initialTickets) {
        this.seed(t);
      }
    } else {
      this.seedDemo();
    }
  }

  /**
   * Seeds the in-memory store from DEMO_REPAIR_TICKETS.
   */
  seedDemo(): void {
    for (const t of DEMO_REPAIR_TICKETS) {
      const record: RepairTicketRecord = {
        id: t.id,
        assetId: t.assetId,
        projectId: t.projectId ?? null,
        state: t.state,
        reportedBrokenAt: new Date(t.reportedBrokenAt),
        repairClaimedAt: t.repairClaimedAt ? new Date(t.repairClaimedAt) : null,
        claimedBy: t.claimedBy ?? null,
        probationStartedAt: t.probationStartedAt
          ? new Date(t.probationStartedAt)
          : null,
        probationEndsAt: t.probationEndsAt
          ? new Date(t.probationEndsAt)
          : null,
        probationDays: t.probationDays,
        resolvedAt: t.resolvedAt ? new Date(t.resolvedAt) : null,
        failureReasonKey: t.failureReasonKey ?? null,
      };

      this.seed(record);

      // Support canonical short aliases
      if (t.id === DEMO_IDS.TICKET_4412) {
        this.tickets.set('ticket-4412', { ...record, id: 'ticket-4412' });
      }
      if (t.id === DEMO_IDS.TICKET_4413) {
        this.tickets.set('ticket-4413', { ...record, id: 'ticket-4413' });
      }
    }
  }

  seed(ticket: RepairTicketRecord): void {
    this.tickets.set(ticket.id, { ...ticket });
  }

  async getTicketById(id: string): Promise<RepairTicketRecord | null> {
    const ticket = this.tickets.get(id);
    return ticket ? { ...ticket } : null;
  }

  async updateTicketState(
    id: string,
    state: ProbationState,
    extra?: UpdateTicketExtra
  ): Promise<void> {
    const existing = this.tickets.get(id);
    if (!existing) {
      throw new Error(`Repair ticket '${id}' not found`);
    }

    const updated: RepairTicketRecord = {
      ...existing,
      state,
      claimedBy:
        extra?.claimedBy !== undefined ? extra.claimedBy : existing.claimedBy,
      repairClaimedAt:
        extra?.repairClaimedAt !== undefined
          ? extra.repairClaimedAt
          : existing.repairClaimedAt,
      probationStartedAt:
        extra?.probationStartedAt !== undefined
          ? extra.probationStartedAt
          : existing.probationStartedAt,
      probationEndsAt:
        extra?.probationEndsAt !== undefined
          ? extra.probationEndsAt
          : existing.probationEndsAt,
      probationDays:
        extra?.probationDays !== undefined
          ? extra.probationDays
          : existing.probationDays,
      resolvedAt:
        extra?.resolvedAt !== undefined
          ? extra.resolvedAt
          : existing.resolvedAt,
      failureReasonKey:
        extra?.failureReasonKey !== undefined
          ? extra.failureReasonKey
          : existing.failureReasonKey,
    };

    this.tickets.set(id, updated);

    // Keep aliases synchronized
    if (id === DEMO_IDS.TICKET_4412) {
      this.tickets.set('ticket-4412', { ...updated, id: 'ticket-4412' });
    } else if (id === 'ticket-4412') {
      this.tickets.set(DEMO_IDS.TICKET_4412, {
        ...updated,
        id: DEMO_IDS.TICKET_4412,
      });
    }

    if (id === DEMO_IDS.TICKET_4413) {
      this.tickets.set('ticket-4413', { ...updated, id: 'ticket-4413' });
    } else if (id === 'ticket-4413') {
      this.tickets.set(DEMO_IDS.TICKET_4413, {
        ...updated,
        id: DEMO_IDS.TICKET_4413,
      });
    }
  }

  clear(): void {
    this.tickets.clear();
  }
}

let defaultRepo: InMemoryRepairTicketRepository | null = null;

export function getDefaultRepairTicketRepository(): InMemoryRepairTicketRepository {
  if (!defaultRepo) {
    defaultRepo = new InMemoryRepairTicketRepository();
  }
  return defaultRepo;
}

export function resetDefaultRepairTicketRepository(): void {
  defaultRepo = null;
}
