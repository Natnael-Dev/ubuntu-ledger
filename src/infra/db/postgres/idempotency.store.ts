// Real PostgreSQL Idempotency Store
// Authoritative sources: docs/specs/03-data-model.md §11, docs/specs/05-api-contracts.md §7

import type { PoolClient } from 'pg';
import type { IdempotencyRecord, NewIdempotencyRecord } from '../types';
import type { IdempotencyStore } from '../services/idempotency.store';

export class PostgresIdempotencyStore implements IdempotencyStore {
  constructor(private readonly client: PoolClient) {}

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    const res = await this.client.query(
      `SELECT key, endpoint, request_hash, response, created_at
       FROM idempotency_record
       WHERE key = $1`,
      [key]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      key: row.key,
      endpoint: row.endpoint,
      requestHash: row.request_hash,
      response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response,
      createdAt: new Date(row.created_at),
    };
  }

  async save(record: NewIdempotencyRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO idempotency_record (
         key, endpoint, request_hash, response, created_at
       ) VALUES (
         $1, $2, $3, $4::jsonb, COALESCE($5, now())
       )`,
      [
        record.key,
        record.endpoint,
        record.requestHash,
        JSON.stringify(record.response),
        record.createdAt ?? null,
      ]
    );
  }
}
