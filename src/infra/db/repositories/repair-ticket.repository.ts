// Repair Ticket Repository
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03, INV-05)
// - docs/specs/05-api-contracts.md §8
// - docs/specs/11-tasks.md T-20
// - docs/specs/03-data-model.md §6

import type { ProbationState } from '@/domain/types';
import { DEMO_REPAIR_TICKETS, DEMO_IDS } from '@/fixtures/demo-scenario';
import { systemClock } from '@/infra/clock';

export interface RepairTicketRecord {
  id: string;
  assetId: string;
  projectId?: string | null;
  wardId?: string | null;
  state: ProbationState;
  reportedBrokenAt: Date;
  repairClaimedAt?: Date | null;
  claimedBy?: string | null;
  probationStartedAt?: Date | null;
  probationEndsAt?: Date | null;
  probationDays: number;
  resolvedAt?: Date | null;
  failureReasonKey?: string | null;
  originalReporterClusters?: string[];
  createdAt?: Date;
}

export interface ProbationPingRecord {
  id: string;
  ticketId: string;
  respondentId: string;
  scheduledFor: Date;
  sentAt?: Date | null;
  respondedAt?: Date | null;
  stillWorking?: boolean | null;
  clusterKey?: string | null;
}

export interface UpdateTicketExtra {
  repairClaimedAt?: Date | null;
  claimedBy?: string | null;
  probationStartedAt?: Date | null;
  probationEndsAt?: Date | null;
  probationDays?: number;
  resolvedAt?: Date | null;
  failureReasonKey?: string | null;
  originalReporterClusters?: string[];
  wardId?: string | null;
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
   * Finds all tickets currently in active probation (e.g. PROBATION_ACTIVE, PROBATION_DAY_0, or claimed with active window).
   */
  findActiveProbationTickets(): Promise<RepairTicketRecord[]>;

  /**
   * Finds all probation pings scheduled on or before `asOf` that have not yet been sent.
   */
  findPendingPings(asOf?: Date): Promise<ProbationPingRecord[]>;

  /**
   * Lists all repair tickets for a given ward (clean method for T-22 Console Board).
   */
  listTicketsByWard(wardId: string): Promise<RepairTicketRecord[]>;

  /**
   * Schedules a new probation ping. Idempotent on (ticketId, respondentId, scheduledFor).
   */
  schedulePing(
    ping: Omit<ProbationPingRecord, 'id'> & { id?: string }
  ): Promise<ProbationPingRecord>;

  /**
   * Marks a probation ping as sent.
   */
  markPingSent(pingId: string, sentAt?: Date): Promise<void>;

  /**
   * Gets all probation pings for a given repair ticket.
   */
  getPingsByTicketId(ticketId: string): Promise<ProbationPingRecord[]>;

  /**
   * Updates a ping's citizen verification response.
   */
  updatePingResponse?(
    pingId: string,
    stillWorking: boolean,
    respondedAt?: Date
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
  private pings: Map<string, ProbationPingRecord> = new Map();

  constructor(initialTickets?: RepairTicketRecord[]) {
    if (initialTickets !== undefined) {
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
      const wardId =
        t.id === DEMO_IDS.TICKET_4412 || t.id === DEMO_IDS.TICKET_4413
          ? DEMO_IDS.WARD_W09
          : null;

      const clusters =
        t.id === DEMO_IDS.TICKET_4412
          ? ['cluster-alpha', 'cluster-beta']
          : ['cluster-gamma'];

      const record: RepairTicketRecord = {
        id: t.id,
        assetId: t.assetId,
        projectId: t.projectId ?? null,
        wardId,
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
        originalReporterClusters: clusters,
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
      originalReporterClusters:
        extra?.originalReporterClusters !== undefined
          ? extra.originalReporterClusters
          : existing.originalReporterClusters,
      wardId: extra?.wardId !== undefined ? extra.wardId : existing.wardId,
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

  async findActiveProbationTickets(): Promise<RepairTicketRecord[]> {
    const results: RepairTicketRecord[] = [];
    const seenIds = new Set<string>();

    for (const ticket of this.tickets.values()) {
      // Avoid duplicates from alias keys ('ticket-4412')
      if (seenIds.has(ticket.id)) continue;
      seenIds.add(ticket.id);

      if (
        ticket.state === 'PROBATION_ACTIVE' ||
        ticket.state === 'PROBATION_DAY_0' ||
        (ticket.state === 'REPAIR_CLAIMED' && ticket.probationStartedAt != null)
      ) {
        results.push({ ...ticket });
      }
    }
    return results;
  }

  async findPendingPings(asOf?: Date): Promise<ProbationPingRecord[]> {
    const threshold = asOf ? asOf.getTime() : systemClock.now().getTime();
    const results: ProbationPingRecord[] = [];

    for (const ping of this.pings.values()) {
      if (
        ping.scheduledFor.getTime() <= threshold &&
        (ping.sentAt === null || ping.sentAt === undefined)
      ) {
        results.push({ ...ping });
      }
    }

    return results.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  async listTicketsByWard(wardId: string): Promise<RepairTicketRecord[]> {
    const results: RepairTicketRecord[] = [];
    const seenIds = new Set<string>();

    for (const ticket of this.tickets.values()) {
      if (seenIds.has(ticket.id)) continue;

      const isWardMatch =
        ticket.wardId === wardId ||
        ((ticket.id === DEMO_IDS.TICKET_4412 || ticket.id === DEMO_IDS.TICKET_4413) &&
          wardId === DEMO_IDS.WARD_W09);

      if (isWardMatch) {
        seenIds.add(ticket.id);
        results.push({ ...ticket });
      }
    }

    return results.sort(
      (a, b) => b.reportedBrokenAt.getTime() - a.reportedBrokenAt.getTime()
    );
  }

  async schedulePing(
    ping: Omit<ProbationPingRecord, 'id'> & { id?: string }
  ): Promise<ProbationPingRecord> {
    // Idempotency check: unique (ticket_id, respondent_id, scheduled_for)
    for (const existing of this.pings.values()) {
      if (
        existing.ticketId === ping.ticketId &&
        existing.respondentId === ping.respondentId &&
        existing.scheduledFor.getTime() === ping.scheduledFor.getTime()
      ) {
        return { ...existing };
      }
    }

    const id =
      ping.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `ping-${systemClock.now().getTime()}-${Math.floor(Math.random() * 100000)}`);

    const record: ProbationPingRecord = {
      id,
      ticketId: ping.ticketId,
      respondentId: ping.respondentId,
      scheduledFor: ping.scheduledFor,
      sentAt: ping.sentAt ?? null,
      respondedAt: ping.respondedAt ?? null,
      stillWorking: ping.stillWorking ?? null,
      clusterKey: ping.clusterKey ?? null,
    };

    this.pings.set(id, record);
    return { ...record };
  }

  async markPingSent(pingId: string, sentAt?: Date): Promise<void> {
    const ping = this.pings.get(pingId);
    if (!ping) {
      throw new Error(`Probation ping '${pingId}' not found`);
    }

    this.pings.set(pingId, {
      ...ping,
      sentAt: sentAt ?? systemClock.now(),
    });
  }

  async getPingsByTicketId(ticketId: string): Promise<ProbationPingRecord[]> {
    const results: ProbationPingRecord[] = [];
    for (const ping of this.pings.values()) {
      if (ping.ticketId === ticketId) {
        results.push({ ...ping });
      }
    }
    return results.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  async updatePingResponse(
    pingId: string,
    stillWorking: boolean,
    respondedAt?: Date
  ): Promise<void> {
    const ping = this.pings.get(pingId);
    if (!ping) {
      throw new Error(`Probation ping '${pingId}' not found`);
    }

    this.pings.set(pingId, {
      ...ping,
      stillWorking,
      respondedAt: respondedAt ?? systemClock.now(),
    });
  }

  clear(): void {
    this.tickets.clear();
    this.pings.clear();
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
