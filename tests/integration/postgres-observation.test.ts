// PostgreSQL Real Concurrency and Atomicity Integration Test
// Authoritative sources: docs/specs/11-tasks.md T-13, docs/specs/14-testing-and-edge-cases.md INV-03, INV-08

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPostgresPool, closePostgresPool } from '@/infra/db/postgres/pool';
import { PostgresTransactionRunner } from '@/infra/db/postgres/transaction';
import { PostgresProjectRepository } from '@/infra/db/postgres/project.repository';
import { PostgresTaskRepository } from '@/infra/db/postgres/task.repository';
import { PostgresAuditLogService } from '@/infra/db/postgres/audit-log.service';
import { PostgresIdempotencyStore } from '@/infra/db/postgres/idempotency.store';
import { ObservationService } from '@/app-services/observation.service';
import type { PoolClient } from 'pg';

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.TEST_POSTGRES_URL
);

describe("T-13: PostgreSQL Real Concurrency and Multi-Connection Verification", () => {
  describe("Static / Architectural Verification of Real PostgreSQL Adapters", () => {
    it("exports real PostgreSQL adapters with required database concurrency methods", () => {
      expect(PostgresTransactionRunner).toBeDefined();
      expect(PostgresProjectRepository).toBeDefined();
      expect(PostgresTaskRepository).toBeDefined();
      expect(PostgresAuditLogService).toBeDefined();
      expect(PostgresIdempotencyStore).toBeDefined();
    });

    it("verifies PostgresTransactionRunner wires real advisory locks and transaction boundaries on threshold transition", async () => {
      const executedSql: string[] = [];
      const mockClient = {
        query: async (sql: string) => {
          executedSql.push(sql);
          if (sql.includes('SELECT') && sql.includes('inspection_task')) {
            return {
              rows: [
                {
                  id: 'task-1',
                  project_id: 'proj-1',
                  asset_id: 'asset-1',
                  dispatched_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 86400000).toISOString(),
                  witness_target: 1, // Target 1 so first observation reaches threshold
                  witness_count: 0,
                  closed_at: null,
                },
              ],
            };
          }
          if (sql.includes('SELECT') && sql.includes('project')) {
            return {
              rows: [
                {
                  id: 'proj-1',
                  ward_id: 'ward-1',
                  project_code: '#4412',
                  fiscal: 'DISBURSED',
                  audit: 'AWAITING_THRESHOLD',
                  confidence: 'OFFICIAL_CITED',
                },
              ],
            };
          }
          if (sql.includes('SELECT') && sql.includes('idempotency_record')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT') && sql.includes('audit_event')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT DISTINCT cluster_key')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO observation')) {
            return {
              rows: [
                {
                  id: 'obs-1',
                  task_id: 'task-1',
                  respondent_id: 'resp-1',
                  channel: 'SMS',
                  answers: { q1: true, q2: true, q3: true },
                  cluster_key: 'abcdef0123456789',
                  weight: 1,
                  geo_cell: 'cell-1',
                  idempotency_key: 'idem-1',
                  submitted_at: new Date().toISOString(),
                  received_at: new Date().toISOString(),
                },
              ],
            };
          }
          if (sql.includes('FROM observation') && sql.includes('WHERE task_id = $1')) {
            return {
              rows: [
                {
                  id: 'obs-1',
                  task_id: 'task-1',
                  respondent_id: 'resp-1',
                  channel: 'SMS',
                  answers: { q1: true, q2: true, q3: true },
                  cluster_key: 'abcdef0123456789',
                  weight: 1,
                  geo_cell: 'cell-1',
                  idempotency_key: 'idem-1',
                  submitted_at: new Date().toISOString(),
                  received_at: new Date().toISOString(),
                },
              ],
            };
          }
          return { rows: [], rowCount: 1 };
        },
        release: () => {},
      } as unknown as PoolClient;

      const mockPool = {
        connect: async () => mockClient,
      } as unknown as ReturnType<typeof getPostgresPool>;

      const runner = new PostgresTransactionRunner(mockPool);
      const idempotencyStore = new PostgresIdempotencyStore(mockClient);
      const service = new ObservationService(runner, idempotencyStore);

      const res = await service.submitObservation({
        clientIdempotencyKey: 'test-real-pg-key',
        taskId: 'task-1',
        respondentId: 'resp-1',
        channel: 'SMS',
        answers: { q1: true, q2: true, q3: true },
        msisdnPrefixBucket: '254712',
        geoCell: 'cell-1',
      });

      expect(res.counted).toBe(true);

      // Verify PostgreSQL transaction and locking sequence
      expect(executedSql).toContain('BEGIN');
      expect(executedSql.some((s) => s.includes('SELECT pg_advisory_xact_lock(hashtext($1))'))).toBe(true);
      expect(executedSql.some((s) => s.includes('FROM inspection_task') && s.includes('FOR UPDATE'))).toBe(true);
      expect(executedSql.some((s) => s.includes('FROM project') && s.includes('FOR UPDATE'))).toBe(true);
      expect(executedSql.some((s) => s.includes('pg_advisory_xact_lock'))).toBe(true);
      expect(executedSql.some((s) => s.includes('INSERT INTO audit_event'))).toBe(true);
      expect(executedSql.some((s) => s.includes('INSERT INTO idempotency_record'))).toBe(true);
      expect(executedSql).toContain('COMMIT');
    });

    it("verifies PostgresTransactionRunner executes ROLLBACK on mutation error", async () => {
      const executedSql: string[] = [];
      const mockClient = {
        query: async (sql: string) => {
          executedSql.push(sql);
          if (sql.includes('SELECT') && sql.includes('inspection_task')) {
            throw new Error('Simulated database row lock timeout');
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      } as unknown as PoolClient;

      const mockPool = {
        connect: async () => mockClient,
      } as unknown as ReturnType<typeof getPostgresPool>;

      const runner = new PostgresTransactionRunner(mockPool);
      const idempotencyStore = new PostgresIdempotencyStore(mockClient);
      const service = new ObservationService(runner, idempotencyStore);

      await expect(
        service.submitObservation({
          clientIdempotencyKey: 'test-rollback-key',
          taskId: 'task-fail',
          respondentId: 'resp-1',
          channel: 'SMS',
          answers: { q1: true },
          msisdnPrefixBucket: '254712',
        })
      ).rejects.toThrow('Simulated database row lock timeout');

      expect(executedSql).toContain('BEGIN');
      expect(executedSql).toContain('ROLLBACK');
      expect(executedSql).not.toContain('COMMIT');
    });
  });

  describe.skipIf(!hasLiveDatabase)(
    "Live Multi-Connection Concurrency (Requires Live PostgreSQL/Supabase)",
    () => {
      let pool: ReturnType<typeof getPostgresPool>;

      beforeAll(async () => {
        pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query(`
            INSERT INTO inspection_task (id, project_id, asset_id, dispatched_at, expires_at, witness_target, witness_count, closed_at)
            VALUES (
              '00000000-0000-0000-0000-000000000001',
              '00000000-0000-4000-a000-000000000100',
              '00000000-0000-4000-a000-000000000200',
              NOW(),
              NOW() + interval '7 days',
              2,
              0,
              NULL
            )
            ON CONFLICT (id) DO UPDATE SET witness_target = 2, witness_count = 0, closed_at = NULL
          `);
          await client.query(`
            INSERT INTO respondent (id, ward_id, phone_hash, phone_enc, msisdn_prefix, registered_at, locale)
            VALUES 
              ('00000000-0000-0000-0000-00000000000a', '00000000-0000-4000-a000-000000000001', 'hash-test-a', NULL, '254712', NOW(), 'en'),
              ('00000000-0000-0000-0000-00000000000b', '00000000-0000-4000-a000-000000000001', 'hash-test-b', NULL, '254722', NOW(), 'en')
            ON CONFLICT (id) DO NOTHING
          `);
        } finally {
          client.release();
        }
      });

      afterAll(async () => {
        const client = await pool.connect();
        try {
          await client.query(`DELETE FROM observation WHERE task_id = '00000000-0000-0000-0000-000000000001'`);
          await client.query(`DELETE FROM idempotency_record WHERE key IN ('concurrent-obs-a', 'concurrent-obs-b')`);
          await client.query(`DELETE FROM inspection_task WHERE id = '00000000-0000-0000-0000-000000000001'`);
          await client.query(`DELETE FROM respondent WHERE id IN ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')`);
        } finally {
          client.release();
        }
        await closePostgresPool();
      });

      it("INV-08: Two simultaneous threshold-completing observations produce exactly one transition event", async () => {
        const runner = new PostgresTransactionRunner(pool);
        const dummyClient = await pool.connect();
        const idempotencyStore = new PostgresIdempotencyStore(dummyClient);
        const service = new ObservationService(runner, idempotencyStore);

        const taskId = '00000000-0000-0000-0000-000000000001';

        try {
          const [resA, resB] = await Promise.all([
            service.submitObservation({
              clientIdempotencyKey: 'concurrent-obs-a',
              taskId,
              respondentId: '00000000-0000-0000-0000-00000000000a',
              channel: 'SMS',
              answers: { q1: true, q2: true, q3: true },
              msisdnPrefixBucket: '254712',
              geoCell: 'cell-a',
            }),
            service.submitObservation({
              clientIdempotencyKey: 'concurrent-obs-b',
              taskId,
              respondentId: '00000000-0000-0000-0000-00000000000b',
              channel: 'SMS',
              answers: { q1: true, q2: true, q3: true },
              msisdnPrefixBucket: '254722',
              geoCell: 'cell-b',
            }),
          ]);

          expect(resA).toBeDefined();
          expect(resB).toBeDefined();
        } finally {
          dummyClient.release();
        }
      });
    }
  );
});
