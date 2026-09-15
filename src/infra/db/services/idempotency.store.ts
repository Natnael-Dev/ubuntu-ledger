import { systemClock } from '@/infra/clock';
import type { IdempotencyRecord, NewIdempotencyRecord } from '../types';

export interface IdempotencyStore {
  /**
   * Retrieves an idempotency record by its unique key.
   */
  findByKey(key: string): Promise<IdempotencyRecord | null>;

  /**
   * Atomically saves an idempotency response.
   */
  save(record: NewIdempotencyRecord): Promise<void>;
}

/**
 * In-memory implementation for unit and service-level testing.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private records: Map<string, IdempotencyRecord> = new Map();

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    const rec = this.records.get(key);
    return rec ? { ...rec } : null;
  }

  async save(record: NewIdempotencyRecord): Promise<void> {
    if (this.records.has(record.key)) {
      throw new Error(`Unique constraint violation: idempotency key '${record.key}' already exists`);
    }
    const fullRecord: IdempotencyRecord = {
      ...record,
      createdAt: record.createdAt || systemClock.now(),
    };
    this.records.set(record.key, fullRecord);
  }

  // Test helpers
  clear(): void {
    this.records.clear();
  }

  has(key: string): boolean {
    return this.records.has(key);
  }
}
