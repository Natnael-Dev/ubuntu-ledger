// Real PostgreSQL Append-Only Audit Log Service
// Authoritative sources: docs/specs/03-data-model.md §10, docs/specs/07-trust-and-security.md §8

import type { PoolClient } from 'pg';
import type { AuditEventRecord } from '@/domain/audit-chain';
import type { AuditLogService } from '../services/audit-log.service';

export class PostgresAuditLogService implements AuditLogService {
  constructor(private readonly client: PoolClient) {}

  async getLastEventForUpdate(): Promise<AuditEventRecord | null> {
    // Audit hash chain concurrency: globally serialize audit event creation across transactions
    await this.client.query("SELECT pg_advisory_xact_lock(hashtext('audit_event_chain'))");

    const res = await this.client.query(
      `SELECT seq, ward_id, actor_role, actor_ref, action, entity_type, entity_id,
              payload, payload_hash, prev_hash, hash, occurred_at
       FROM audit_event
       ORDER BY seq DESC
       LIMIT 1`
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      seq: Number(row.seq),
      ward_id: row.ward_id,
      actor_role: row.actor_role,
      actor_ref: row.actor_ref,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      payload_hash: row.payload_hash,
      prev_hash: row.prev_hash,
      hash: row.hash,
      occurred_at: new Date(row.occurred_at).toISOString(),
    };
  }

  async append(record: AuditEventRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO audit_event (
         seq, ward_id, actor_role, actor_ref, action, entity_type, entity_id,
         payload, payload_hash, prev_hash, hash, occurred_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12
       )`,
      [
        record.seq,
        record.ward_id ?? null,
        record.actor_role,
        record.actor_ref ?? null,
        record.action,
        record.entity_type,
        record.entity_id ?? null,
        JSON.stringify(record.payload),
        record.payload_hash,
        record.prev_hash,
        record.hash,
        record.occurred_at,
      ]
    );
  }
}
