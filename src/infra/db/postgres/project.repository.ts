// Real PostgreSQL Project Repository
// Authoritative sources: docs/specs/03-data-model.md §3, docs/specs/02-architecture.md §2, §4

import type { PoolClient } from 'pg';
import type { AuditState } from '@/domain/types';
import type { ProjectRecord } from '../types';
import type { ProjectRepository } from '../repositories/project.repository';

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly client: PoolClient) {}

  async getProjectForUpdate(id: string): Promise<ProjectRecord | null> {
    const res = await this.client.query(
      `SELECT id, ward_id, project_code, fiscal, audit, confidence, updated_at
       FROM project
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      wardId: row.ward_id,
      projectCode: row.project_code,
      fiscal: row.fiscal,
      audit: row.audit,
      confidence: row.confidence,
    };
  }

  async updateAuditState(id: string, state: AuditState): Promise<void> {
    const res = await this.client.query(
      `UPDATE project
       SET audit = $2, updated_at = now()
       WHERE id = $1`,
      [id, state]
    );

    if (res.rowCount === 0) {
      throw new Error(`Project '${id}' not found`);
    }
  }
}
