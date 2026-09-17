// Real PostgreSQL Repair Ticket Repository
// Authoritative sources: docs/specs/03-data-model.md §6, docs/specs/04-state-machine.md §3, docs/specs/11-tasks.md T-20, T-21

import type { PoolClient } from 'pg';
import type { ProbationState } from '@/domain/types';
import type {
  RepairTicketRecord,
  ProbationPingRecord,
  RepairTicketRepository,
  UpdateTicketExtra,
} from '../repositories/repair-ticket.repository';
import { systemClock } from '@/infra/clock';

export class PostgresRepairTicketRepository implements RepairTicketRepository {
  constructor(private readonly client: PoolClient) {}

  async getTicketById(id: string): Promise<RepairTicketRecord | null> {
    const res = await this.client.query(
      `SELECT rt.id, rt.asset_id, rt.project_id, rt.state, rt.reported_broken_at,
              rt.repair_claimed_at, rt.claimed_by, rt.probation_started_at,
              rt.probation_ends_at, rt.probation_days, rt.resolved_at,
              rt.failure_reason_key, rt.created_at,
              p.ward_id
       FROM repair_ticket rt
       LEFT JOIN project p ON rt.project_id = p.id
       WHERE rt.id = $1`,
      [id]
    );

    if (res.rows.length === 0) {
      return null;
    }

    return this.mapRowToRecord(res.rows[0]);
  }

  async updateTicketState(
    id: string,
    state: ProbationState,
    extra?: UpdateTicketExtra
  ): Promise<void> {
    const sets: string[] = ['state = $2'];
    const values: unknown[] = [id, state];
    let idx = 3;

    if (extra?.claimedBy !== undefined) {
      sets.push(`claimed_by = $${idx++}`);
      values.push(extra.claimedBy);
    }
    if (extra?.repairClaimedAt !== undefined) {
      sets.push(`repair_claimed_at = $${idx++}`);
      values.push(extra.repairClaimedAt);
    }
    if (extra?.probationStartedAt !== undefined) {
      sets.push(`probation_started_at = $${idx++}`);
      values.push(extra.probationStartedAt);
    }
    if (extra?.probationEndsAt !== undefined) {
      sets.push(`probation_ends_at = $${idx++}`);
      values.push(extra.probationEndsAt);
    }
    if (extra?.probationDays !== undefined) {
      sets.push(`probation_days = $${idx++}`);
      values.push(extra.probationDays);
    }
    if (extra?.resolvedAt !== undefined) {
      sets.push(`resolved_at = $${idx++}`);
      values.push(extra.resolvedAt);
    }
    if (extra?.failureReasonKey !== undefined) {
      sets.push(`failure_reason_key = $${idx++}`);
      values.push(extra.failureReasonKey);
    }

    const query = `UPDATE repair_ticket SET ${sets.join(', ')} WHERE id = $1`;
    const res = await this.client.query(query, values);

    if (res.rowCount === 0) {
      throw new Error(`Repair ticket '${id}' not found`);
    }
  }

  async findActiveProbationTickets(): Promise<RepairTicketRecord[]> {
    const res = await this.client.query(
      `SELECT rt.id, rt.asset_id, rt.project_id, rt.state, rt.reported_broken_at,
              rt.repair_claimed_at, rt.claimed_by, rt.probation_started_at,
              rt.probation_ends_at, rt.probation_days, rt.resolved_at,
              rt.failure_reason_key, rt.created_at,
              p.ward_id
       FROM repair_ticket rt
       LEFT JOIN project p ON rt.project_id = p.id
       WHERE rt.state IN ('PROBATION_ACTIVE', 'PROBATION_DAY_0')
          OR (rt.state = 'REPAIR_CLAIMED' AND rt.probation_started_at IS NOT NULL)
       ORDER BY rt.probation_started_at ASC NULLS LAST`
    );

    return res.rows.map((row) => this.mapRowToRecord(row));
  }

  async findPendingPings(asOf?: Date): Promise<ProbationPingRecord[]> {
    const threshold = asOf ?? systemClock.now();
    const res = await this.client.query(
      `SELECT id, ticket_id, respondent_id, scheduled_for, sent_at, responded_at, still_working, cluster_key
       FROM probation_ping
       WHERE scheduled_for <= $1 AND sent_at IS NULL
       ORDER BY scheduled_for ASC`,
      [threshold]
    );

    return res.rows.map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      respondentId: row.respondent_id,
      scheduledFor: new Date(row.scheduled_for),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      respondedAt: row.responded_at ? new Date(row.responded_at) : null,
      stillWorking: row.still_working !== null ? Boolean(row.still_working) : null,
      clusterKey: row.cluster_key ?? null,
    }));
  }

  async listTicketsByWard(wardId: string): Promise<RepairTicketRecord[]> {
    const res = await this.client.query(
      `SELECT rt.id, rt.asset_id, rt.project_id, rt.state, rt.reported_broken_at,
              rt.repair_claimed_at, rt.claimed_by, rt.probation_started_at,
              rt.probation_ends_at, rt.probation_days, rt.resolved_at,
              rt.failure_reason_key, rt.created_at,
              p.ward_id
       FROM repair_ticket rt
       JOIN project p ON rt.project_id = p.id
       WHERE p.ward_id = $1
       ORDER BY rt.reported_broken_at DESC`,
      [wardId]
    );

    return res.rows.map((row) => this.mapRowToRecord(row));
  }

  async schedulePing(
    ping: Omit<ProbationPingRecord, 'id'> & { id?: string }
  ): Promise<ProbationPingRecord> {
    const res = await this.client.query(
      `INSERT INTO probation_ping (
         id, ticket_id, respondent_id, scheduled_for, sent_at, responded_at, still_working, cluster_key
       ) VALUES (
         COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8
       )
       ON CONFLICT (ticket_id, respondent_id, scheduled_for) DO UPDATE
       SET cluster_key = EXCLUDED.cluster_key
       RETURNING id, ticket_id, respondent_id, scheduled_for, sent_at, responded_at, still_working, cluster_key`,
      [
        ping.id ?? null,
        ping.ticketId,
        ping.respondentId,
        ping.scheduledFor,
        ping.sentAt ?? null,
        ping.respondedAt ?? null,
        ping.stillWorking ?? null,
        ping.clusterKey ?? null,
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      ticketId: row.ticket_id,
      respondentId: row.respondent_id,
      scheduledFor: new Date(row.scheduled_for),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      respondedAt: row.responded_at ? new Date(row.responded_at) : null,
      stillWorking: row.still_working !== null ? Boolean(row.still_working) : null,
      clusterKey: row.cluster_key ?? null,
    };
  }

  async markPingSent(pingId: string, sentAt?: Date): Promise<void> {
    const timestamp = sentAt ?? systemClock.now();
    const res = await this.client.query(
      `UPDATE probation_ping
       SET sent_at = $2
       WHERE id = $1`,
      [pingId, timestamp]
    );

    if (res.rowCount === 0) {
      throw new Error(`Probation ping '${pingId}' not found`);
    }
  }

  async getPingsByTicketId(ticketId: string): Promise<ProbationPingRecord[]> {
    const res = await this.client.query(
      `SELECT id, ticket_id, respondent_id, scheduled_for, sent_at, responded_at, still_working, cluster_key
       FROM probation_ping
       WHERE ticket_id = $1
       ORDER BY scheduled_for ASC`,
      [ticketId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      respondentId: row.respondent_id,
      scheduledFor: new Date(row.scheduled_for),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      respondedAt: row.responded_at ? new Date(row.responded_at) : null,
      stillWorking: row.still_working !== null ? Boolean(row.still_working) : null,
      clusterKey: row.cluster_key ?? null,
    }));
  }

  async updatePingResponse(
    pingId: string,
    stillWorking: boolean,
    respondedAt?: Date
  ): Promise<void> {
    const timestamp = respondedAt ?? systemClock.now();
    const res = await this.client.query(
      `UPDATE probation_ping
       SET still_working = $2, responded_at = $3
       WHERE id = $1`,
      [pingId, stillWorking, timestamp]
    );

    if (res.rowCount === 0) {
      throw new Error(`Probation ping '${pingId}' not found`);
    }
  }

  private mapRowToRecord(row: Record<string, unknown>): RepairTicketRecord {
    return {
      id: String(row.id),
      assetId: String(row.asset_id),
      projectId: row.project_id ? String(row.project_id) : null,
      wardId: row.ward_id ? String(row.ward_id) : null,
      state: row.state as ProbationState,
      reportedBrokenAt: new Date(String(row.reported_broken_at)),
      repairClaimedAt: row.repair_claimed_at ? new Date(String(row.repair_claimed_at)) : null,
      claimedBy: row.claimed_by ? String(row.claimed_by) : null,
      probationStartedAt: row.probation_started_at ? new Date(String(row.probation_started_at)) : null,
      probationEndsAt: row.probation_ends_at ? new Date(String(row.probation_ends_at)) : null,
      probationDays: Number(row.probation_days),
      resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)) : null,
      failureReasonKey: row.failure_reason_key ? String(row.failure_reason_key) : null,
      createdAt: row.created_at ? new Date(String(row.created_at)) : undefined,
    };
  }
}
