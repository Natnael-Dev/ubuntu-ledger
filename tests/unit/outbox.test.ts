// Unit and Adversarial Tests for T-29 Offline Observation Outbox & Sync Engine
// Authoritative sources: docs/specs/03-data-model.md §9, §11; docs/specs/05-api-contracts.md §5; docs/specs/07-trust-and-security.md §3, §5

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryOutboxStore,
  computeIntegrityHash,
  MAX_PENDING_CAPACITY,
} from '@/lib/outbox/outbox-store';
import { SyncEngine } from '@/lib/outbox/sync-engine';
import type { OfflineObservationRecord } from '@/lib/outbox/types';

describe('T-29: Offline Observation Outbox & Sync Architecture', () => {
  let store: InMemoryOutboxStore;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
  });

  const validRecord: Omit<
    OfflineObservationRecord,
    'createdAt' | 'status' | 'retryCount' | 'integrityHash'
  > = {
    clientIdempotencyKey: '00000000-0000-0000-0000-000000000001',
    taskId: '00000000-0000-4000-a000-000000000300',
    phoneHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    channel: 'PWA',
    answers: { q1: true, q2: false, q3: true },
    geoCell: 'et-aa-0917',
    msisdnPrefixBucket: '251993',
    submittedAt: '2026-09-17T12:00:00.000Z',
  };

  describe('Outbox Storage & Zero-PII Security', () => {
    it('enqueues valid observation with QUEUED status and auto-generated timestamp', async () => {
      const enqueued = await store.enqueue(validRecord);
      expect(enqueued.status).toBe('QUEUED');
      expect(enqueued.retryCount).toBe(0);
      expect(typeof enqueued.createdAt).toBe('number');
      expect(enqueued.integrityHash).toMatch(/^int_/);

      const retrieved = await store.getByKey(validRecord.clientIdempotencyKey);
      expect(retrieved).toEqual(enqueued);
    });

    it('enforces zero-PII invariant: rejects raw international phone numbers in records', async () => {
      const badRecord = {
        ...validRecord,
        answers: { q1: true },
        rawPhone: '+251911223344',
      };
      await expect(store.enqueue(badRecord)).rejects.toThrow(/PII Violation/i);
    });

    it('enforces zero-PII invariant: rejects invalid non-64-hex phoneHash', async () => {
      const badRecord = {
        ...validRecord,
        phoneHash: '+251911223344', // Raw phone instead of hash!
      };
      await expect(store.enqueue(badRecord)).rejects.toThrow(/PII Violation/i);
    });

    it('enforces capacity quota: rejects enqueue when maximum pending capacity (50) is reached', async () => {
      for (let i = 0; i < MAX_PENDING_CAPACITY; i++) {
        await store.enqueue({
          ...validRecord,
          clientIdempotencyKey: `00000000-0000-0000-0000-${i.toString(16).padStart(12, '0')}`,
        });
      }

      const pending = await store.getPending();
      expect(pending.length).toBe(50);

      await expect(
        store.enqueue({
          ...validRecord,
          clientIdempotencyKey: '00000000-0000-0000-0000-ffffffffffff',
        })
      ).rejects.toThrow(/OUTBOX_QUOTA_EXCEEDED/i);
    });

    it('detects tampering via integrity hash mismatch', () => {
      const hash1 = computeIntegrityHash(
        validRecord.clientIdempotencyKey,
        validRecord.taskId,
        validRecord.phoneHash,
        validRecord.answers
      );

      // Mutate answer
      const hash2 = computeIntegrityHash(
        validRecord.clientIdempotencyKey,
        validRecord.taskId,
        validRecord.phoneHash,
        { ...validRecord.answers, q1: false }
      );

      expect(hash1).not.toBe(hash2);
    });

    it('correctly tracks outbox summary across statuses', async () => {
      await store.enqueue({ ...validRecord, clientIdempotencyKey: 'k-1' });
      await store.enqueue({ ...validRecord, clientIdempotencyKey: 'k-2' });
      await store.updateStatus('k-2', 'SYNCED');

      const summary = await store.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.queued).toBe(1);
      expect(summary.synced).toBe(1);
      expect(summary.failed).toBe(0);
    });
  });

  describe('Sync Engine & Reconnection Protocol', () => {
    it('holds observation in queue when simulated offline', async () => {
      const mockFetch = async () => {
        throw new Error('Should not be called offline');
      };

      const engine = new SyncEngine(store, mockFetch as unknown as typeof fetch);
      engine.setSimulatedOffline(true);
      expect(engine.isOnline()).toBe(false);

      await engine.enqueue(validRecord);

      const summary = await store.getSummary();
      expect(summary.queued).toBe(1);
      expect(summary.synced).toBe(0);
    });

    it('flushes pending queue sequentially upon reconnection', async () => {
      let callCount = 0;
      const dispatchedHeaders: string[] = [];

      const mockFetch = async (_url: string, init?: RequestInit) => {
        callCount++;
        const headers = init?.headers as Record<string, string>;
        dispatchedHeaders.push(headers['Idempotency-Key']);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accepted: true,
            counted: true,
            witnessCount: 3,
            witnessTarget: 3,
          }),
        } as Response;
      };

      const engine = new SyncEngine(store, mockFetch as unknown as typeof fetch);
      engine.setSimulatedOffline(true);

      await engine.enqueue({ ...validRecord, clientIdempotencyKey: 'obs-001' });
      await engine.enqueue({ ...validRecord, clientIdempotencyKey: 'obs-002' });

      expect(callCount).toBe(0);

      // Reconnect
      engine.setSimulatedOffline(false);
      const flushResult = await engine.flush();

      expect(flushResult.processed).toBe(2);
      expect(flushResult.synced).toBe(2);
      expect(callCount).toBe(2);
      expect(dispatchedHeaders).toEqual(['obs-001', 'obs-002']);

      const summary = await store.getSummary();
      expect(summary.queued).toBe(0);
      expect(summary.synced).toBe(2);
    });

    it('categorizes terminal 4xx errors as FAILED and halts retry', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          code: 'E_TASK_EXPIRED',
          detail: 'InspectionTask is expired',
        }),
      } as Response);

      const engine = new SyncEngine(store, mockFetch as unknown as typeof fetch);
      await engine.enqueue(validRecord);

      const summary = await store.getSummary();
      expect(summary.queued).toBe(0);
      expect(summary.failed).toBe(1);

      const record = await store.getByKey(validRecord.clientIdempotencyKey);
      expect(record?.status).toBe('FAILED');
      expect(record?.lastError).toContain('InspectionTask is expired');
    });

    it('handles transient network error by retaining QUEUED status and incrementing retryCount', async () => {
      let attempts = 0;
      const mockFetch = async () => {
        attempts++;
        throw new TypeError('Failed to fetch (simulated drop)');
      };

      const engine = new SyncEngine(store, mockFetch as unknown as typeof fetch);
      await engine.enqueue(validRecord);

      const record = await store.getByKey(validRecord.clientIdempotencyKey);
      expect(attempts).toBe(1);
      expect(record?.status).toBe('QUEUED');
      expect(record?.retryCount).toBe(1);
      expect(record?.lastError).toContain('Failed to fetch');
    });

    it('ADV-28: double flush is idempotent and preserves SYNCED state', async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ accepted: true, counted: true }),
        } as Response;
      };

      const engine = new SyncEngine(store, mockFetch as unknown as typeof fetch);
      await engine.enqueue(validRecord);
      expect(callCount).toBe(1);

      // Trigger a second flush
      const secondFlush = await engine.flush();
      expect(secondFlush.processed).toBe(0); // Pending items already 0!
      expect(callCount).toBe(1); // Zero additional calls
    });
  });
});
