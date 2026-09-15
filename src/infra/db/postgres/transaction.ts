// Real PostgreSQL Transaction Runner
// Authoritative sources: docs/specs/02-architecture.md §2, §4, docs/specs/11-tasks.md T-13

import type { Pool, PoolClient } from 'pg';
import type { TransactionContext, TransactionRunner } from '../transaction';
import { PostgresProjectRepository } from './project.repository';
import { PostgresTaskRepository } from './task.repository';
import { PostgresAuditLogService } from './audit-log.service';
import { PostgresIdempotencyStore } from './idempotency.store';

export class PostgresTransactionRunner implements TransactionRunner {
  constructor(private readonly pool: Pool) {}

  async runTransaction<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const ctx: TransactionContext = {
        taskRepo: new PostgresTaskRepository(client),
        projectRepo: new PostgresProjectRepository(client),
        auditLogService: new PostgresAuditLogService(client),
        idempotencyStore: new PostgresIdempotencyStore(client),
        acquireAdvisoryLock: async (lockKey: string): Promise<void> => {
          // Transaction-scoped PostgreSQL advisory lock: automatically released at COMMIT/ROLLBACK
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
        },
      };

      const result = await work(ctx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Rollback failure is ignored to preserve the root cause exception
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
