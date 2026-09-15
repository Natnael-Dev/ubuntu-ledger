// Real PostgreSQL Task Repository
// Authoritative sources: docs/specs/03-data-model.md §4, docs/specs/02-architecture.md §2, §4

import type { PoolClient } from 'pg';
import type { InspectionTaskRecord, NewObservationRecord, ObservationRecord } from '../types';
import type { TaskRepository } from '../repositories/task.repository';

export class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly client: PoolClient) {}

  async getTaskForUpdate(id: string): Promise<InspectionTaskRecord | null> {
    const res = await this.client.query(
      `SELECT id, project_id, asset_id, dispatched_at, expires_at, witness_target, witness_count, closed_at
       FROM inspection_task
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
      projectId: row.project_id,
      assetId: row.asset_id,
      dispatchedAt: new Date(row.dispatched_at),
      expiresAt: new Date(row.expires_at),
      witnessTarget: Number(row.witness_target),
      witnessCount: Number(row.witness_count),
      closedAt: row.closed_at ? new Date(row.closed_at) : null,
    };
  }

  async updateWitnessCount(id: string, witnessCount: number): Promise<void> {
    const res = await this.client.query(
      `UPDATE inspection_task
       SET witness_count = $2
       WHERE id = $1`,
      [id, witnessCount]
    );

    if (res.rowCount === 0) {
      throw new Error(`InspectionTask '${id}' not found`);
    }
  }

  async insertObservation(observation: NewObservationRecord): Promise<ObservationRecord> {
    const res = await this.client.query(
      `INSERT INTO observation (
         task_id, respondent_id, channel, answers, cluster_key, weight, geo_cell, idempotency_key, submitted_at, received_at
       ) VALUES (
         $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10
       )
       RETURNING id, task_id, respondent_id, channel, answers, cluster_key, weight, geo_cell, idempotency_key, submitted_at, received_at`,
      [
        observation.taskId,
        observation.respondentId,
        observation.channel,
        JSON.stringify(observation.answers),
        observation.clusterKey,
        observation.weight,
        observation.geoCell ?? null,
        observation.idempotencyKey,
        observation.submittedAt,
        observation.receivedAt,
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      taskId: row.task_id,
      respondentId: row.respondent_id,
      channel: row.channel,
      answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
      clusterKey: row.cluster_key,
      weight: Number(row.weight) as 0 | 1,
      geoCell: row.geo_cell,
      idempotencyKey: row.idempotency_key,
      submittedAt: new Date(row.submitted_at),
      receivedAt: new Date(row.received_at),
    };
  }

  async getObservationsForTask(taskId: string): Promise<ObservationRecord[]> {
    const res = await this.client.query(
      `SELECT id, task_id, respondent_id, channel, answers, cluster_key, weight, geo_cell, idempotency_key, submitted_at, received_at
       FROM observation
       WHERE task_id = $1
       ORDER BY received_at ASC`,
      [taskId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      respondentId: row.respondent_id,
      channel: row.channel,
      answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
      clusterKey: row.cluster_key,
      weight: Number(row.weight) as 0 | 1,
      geoCell: row.geo_cell,
      idempotencyKey: row.idempotency_key,
      submittedAt: new Date(row.submitted_at),
      receivedAt: new Date(row.received_at),
    }));
  }

  async getClusterKeysForTask(taskId: string): Promise<string[]> {
    const res = await this.client.query(
      `SELECT DISTINCT cluster_key
       FROM observation
       WHERE task_id = $1`,
      [taskId]
    );

    return res.rows.map((r) => r.cluster_key);
  }
}
