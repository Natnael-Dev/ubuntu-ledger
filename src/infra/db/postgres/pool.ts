// PostgreSQL Connection Pool Provider
// Authoritative source: docs/specs/02-architecture.md §2, docs/specs/15-deployment-and-run.md §3

import { Pool, PoolConfig } from 'pg';

let poolInstance: Pool | null = null;

export function getPostgresPool(customConfig?: PoolConfig): Pool {
  if (!poolInstance) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.TEST_POSTGRES_URL ||
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

    poolInstance = new Pool(
      customConfig || {
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    );
  }
  return poolInstance;
}

export async function closePostgresPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
