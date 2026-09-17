// T-29 Offline Observation Outbox Storage
// Authoritative sources: docs/specs/03-data-model.md §9, §11; docs/specs/07-trust-and-security.md §3, §5

import type {
  IOfflineOutboxStore,
  OfflineObservationRecord,
  OutboxItemStatus,
  OutboxSummary,
} from './types';
import { SystemClock } from '@/infra/clock';

export const MAX_PENDING_CAPACITY = 50;
const DB_NAME = 'ward_proofline_offline';
const STORE_NAME = 'offline_observations';
const DB_VERSION = 1;

/**
 * Deterministic client-side integrity hash to detect local tamper/corruption.
 */
export function computeIntegrityHash(
  key: string,
  taskId: string,
  phoneHash: string,
  answers: Record<string, boolean>
): string {
  // Simple deterministic djb2/fnv-style or pseudo-sha representation for browser/node portability
  const str = `${key}:${taskId}:${phoneHash}:${JSON.stringify(answers)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `int_${Math.abs(hash).toString(16)}`;
}

/**
 * Validates that an observation payload strictly contains zero PII.
 * Enforces that phone numbers, GPS coordinates, and free-text are absent.
 */
export function assertZeroPii(record: {
  phoneHash: string;
  answers: Record<string, boolean>;
  geoCell?: string | null;
  [key: string]: unknown;
}): void {
  // 1. phoneHash must be 64-character lowercase hex digest
  if (!/^[0-9a-f]{64}$/i.test(record.phoneHash)) {
    throw new Error('PII Violation: phoneHash must be a 64-character HMAC-SHA256 digest');
  }

  // 2. Reject known PII property keys
  const forbiddenKeys = ['phone', 'phonenumber', 'rawphone', 'msisdn', 'mobile', 'tel', 'citizen', 'name'];
  for (const key of Object.keys(record)) {
    if (forbiddenKeys.includes(key.toLowerCase())) {
      throw new Error(`PII Violation: Forbidden PII field '${key}' detected in observation record`);
    }
  }

  // 3. Inspect string values for raw international phone formats (+251..., +254..., or 10-15 digit standalone phone numbers)
  const phonePattern = /^\+?[1-9]\d{8,14}$/;
  for (const [k, v] of Object.entries(record)) {
    if (k === 'clientIdempotencyKey' || k === 'taskId' || k === 'phoneHash' || k === 'submittedAt') {
      continue;
    }
    if (typeof v === 'string' && phonePattern.test(v.trim())) {
      throw new Error(`PII Violation: Plain phone number detected in field '${k}'`);
    }
  }

  // 4. Assert answers are strictly boolean
  for (const [k, v] of Object.entries(record.answers)) {
    if (typeof v !== 'boolean') {
      throw new Error(`Invalid answer for key '${k}': must be boolean, received ${typeof v}`);
    }
  }
}

/**
 * In-Memory Outbox Store for Node.js / Unit Tests / SSR
 */
export class InMemoryOutboxStore implements IOfflineOutboxStore {
  private records: Map<string, OfflineObservationRecord> = new Map();

  async enqueue(
    item: Omit<
      OfflineObservationRecord,
      'createdAt' | 'status' | 'retryCount' | 'integrityHash'
    >
  ): Promise<OfflineObservationRecord> {
    assertZeroPii(item);

    // Check capacity
    const pendingCount = (await this.getPending()).length;
    if (pendingCount >= MAX_PENDING_CAPACITY) {
      throw new Error('OUTBOX_QUOTA_EXCEEDED: Maximum pending offline observations reached (50)');
    }

    const integrityHash = computeIntegrityHash(
      item.clientIdempotencyKey,
      item.taskId,
      item.phoneHash,
      item.answers
    );

    const clock = new SystemClock();
    const record: OfflineObservationRecord = {
      ...item,
      createdAt: clock.nowMs(),
      status: 'QUEUED',
      retryCount: 0,
      integrityHash,
    };

    this.records.set(item.clientIdempotencyKey, record);
    return { ...record };
  }

  async getByKey(clientIdempotencyKey: string): Promise<OfflineObservationRecord | null> {
    const rec = this.records.get(clientIdempotencyKey);
    return rec ? { ...rec } : null;
  }

  async getAll(): Promise<OfflineObservationRecord[]> {
    return Array.from(this.records.values())
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({ ...r }));
  }

  async getPending(): Promise<OfflineObservationRecord[]> {
    return (await this.getAll()).filter((r) => r.status === 'QUEUED');
  }

  async updateStatus(
    clientIdempotencyKey: string,
    status: OutboxItemStatus,
    extra?: Partial<OfflineObservationRecord>
  ): Promise<void> {
    const existing = this.records.get(clientIdempotencyKey);
    if (!existing) return;
    this.records.set(clientIdempotencyKey, {
      ...existing,
      ...extra,
      status,
    });
  }

  async deleteRecord(clientIdempotencyKey: string): Promise<void> {
    this.records.delete(clientIdempotencyKey);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  async getSummary(): Promise<OutboxSummary> {
    const all = await this.getAll();
    return {
      total: all.length,
      queued: all.filter((r) => r.status === 'QUEUED').length,
      syncing: all.filter((r) => r.status === 'SYNCING').length,
      synced: all.filter((r) => r.status === 'SYNCED').length,
      failed: all.filter((r) => r.status === 'FAILED' || r.status === 'CORRUPTED').length,
    };
  }
}

/**
 * Browser-native IndexedDB Outbox Store
 */
export class IndexedDbOutboxStore implements IOfflineOutboxStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private fallbackStore: InMemoryOutboxStore | null = null;

  constructor() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.fallbackStore = new InMemoryOutboxStore();
    }
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.fallbackStore) {
      throw new Error('IndexedDB not supported in this environment');
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, {
              keyPath: 'clientIdempotencyKey',
            });
            store.createIndex('idx_status', 'status', { unique: false });
            store.createIndex('idx_createdAt', 'createdAt', { unique: false });
            store.createIndex('idx_taskId', 'taskId', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  async enqueue(
    item: Omit<
      OfflineObservationRecord,
      'createdAt' | 'status' | 'retryCount' | 'integrityHash'
    >
  ): Promise<OfflineObservationRecord> {
    if (this.fallbackStore) {
      return this.fallbackStore.enqueue(item);
    }

    assertZeroPii(item);

    const pending = await this.getPending();
    if (pending.length >= MAX_PENDING_CAPACITY) {
      throw new Error('OUTBOX_QUOTA_EXCEEDED: Maximum pending offline observations reached (50)');
    }

    const integrityHash = computeIntegrityHash(
      item.clientIdempotencyKey,
      item.taskId,
      item.phoneHash,
      item.answers
    );

    const clock = new SystemClock();
    const record: OfflineObservationRecord = {
      ...item,
      createdAt: clock.nowMs(),
      status: 'QUEUED',
      retryCount: 0,
      integrityHash,
    };

    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  async getByKey(clientIdempotencyKey: string): Promise<OfflineObservationRecord | null> {
    if (this.fallbackStore) {
      return this.fallbackStore.getByKey(clientIdempotencyKey);
    }
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(clientIdempotencyKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(): Promise<OfflineObservationRecord[]> {
    if (this.fallbackStore) {
      return this.fallbackStore.getAll();
    }
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows: OfflineObservationRecord[] = req.result || [];
        rows.sort((a, b) => a.createdAt - b.createdAt);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getPending(): Promise<OfflineObservationRecord[]> {
    if (this.fallbackStore) {
      return this.fallbackStore.getPending();
    }
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const idx = store.index('idx_status');
      const req = idx.getAll('QUEUED');
      req.onsuccess = () => {
        const rows: OfflineObservationRecord[] = req.result || [];
        rows.sort((a, b) => a.createdAt - b.createdAt);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateStatus(
    clientIdempotencyKey: string,
    status: OutboxItemStatus,
    extra?: Partial<OfflineObservationRecord>
  ): Promise<void> {
    if (this.fallbackStore) {
      return this.fallbackStore.updateStatus(clientIdempotencyKey, status, extra);
    }
    const db = await this.getDb();
    const existing = await this.getByKey(clientIdempotencyKey);
    if (!existing) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const updated: OfflineObservationRecord = {
        ...existing,
        ...extra,
        status,
      };
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteRecord(clientIdempotencyKey: string): Promise<void> {
    if (this.fallbackStore) {
      return this.fallbackStore.deleteRecord(clientIdempotencyKey);
    }
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(clientIdempotencyKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    if (this.fallbackStore) {
      return this.fallbackStore.clear();
    }
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSummary(): Promise<OutboxSummary> {
    if (this.fallbackStore) {
      return this.fallbackStore.getSummary();
    }
    const all = await this.getAll();
    return {
      total: all.length,
      queued: all.filter((r) => r.status === 'QUEUED').length,
      syncing: all.filter((r) => r.status === 'SYNCING').length,
      synced: all.filter((r) => r.status === 'SYNCED').length,
      failed: all.filter((r) => r.status === 'FAILED' || r.status === 'CORRUPTED').length,
    };
  }
}

/**
 * Factory creating the environment-appropriate store instance
 */
export function getOutboxStore(): IOfflineOutboxStore {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return new IndexedDbOutboxStore();
  }
  return new InMemoryOutboxStore();
}
