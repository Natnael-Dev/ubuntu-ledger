// Real PostgreSQL Respondent Repository
// Authoritative sources: docs/specs/03-data-model.md §4, §10, docs/specs/05-api-contracts.md §5, docs/specs/11-tasks.md T-16

import type { Pool, PoolClient } from 'pg';
import type { RespondentRecord } from '../types';
import type { RespondentRepository } from '../repositories/respondent.repository';

export class PostgresRespondentRepository implements RespondentRepository {
  constructor(private readonly clientOrPool: PoolClient | Pool) {}

  async findByPhoneHash(phoneHash: string): Promise<RespondentRecord | null> {
    const res = await this.clientOrPool.query(
      `SELECT id, ward_id, phone_hash, phone_enc, msisdn_prefix, registered_at, locale
       FROM respondent
       WHERE phone_hash = $1
       LIMIT 1`,
      [phoneHash]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      wardId: row.ward_id,
      phoneHash: row.phone_hash.trim(),
      phoneEnc: row.phone_enc,
      msisdnPrefix: row.msisdn_prefix,
      registeredAt: new Date(row.registered_at),
      locale: row.locale,
    };
  }

  async findById(id: string): Promise<RespondentRecord | null> {
    const res = await this.clientOrPool.query(
      `SELECT id, ward_id, phone_hash, phone_enc, msisdn_prefix, registered_at, locale
       FROM respondent
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      wardId: row.ward_id,
      phoneHash: row.phone_hash.trim(),
      phoneEnc: row.phone_enc,
      msisdnPrefix: row.msisdn_prefix,
      registeredAt: new Date(row.registered_at),
      locale: row.locale,
    };
  }
}
