// T-29 Offline Outbox Sync Engine
// Authoritative sources: docs/specs/05-api-contracts.md §5, docs/specs/11-tasks.md T-29

import type {
  IOfflineOutboxStore,
  OfflineObservationRecord,
  OutboxSummary,
} from './types';
import { getOutboxStore } from './outbox-store';
import { SystemClock } from '@/infra/clock';

export type SyncEventListener = (summary: OutboxSummary) => void;

export class SyncEngine {
  private store: IOfflineOutboxStore;
  private isSyncing = false;
  private simulatedOffline = false;
  private listeners: Set<SyncEventListener> = new Set();
  private fetchFn: typeof fetch;

  constructor(
    store?: IOfflineOutboxStore,
    fetchFn?: typeof fetch
  ) {
    this.store = store || getOutboxStore();
    this.fetchFn = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (async () => { throw new Error('Fetch not available'); }));

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.simulatedOffline) {
          void this.flush();
        }
      });
      window.addEventListener('offline', () => {
        void this.notifyListeners();
      });
    }
  }

  public setSimulatedOffline(offline: boolean): void {
    this.simulatedOffline = offline;
    void this.notifyListeners();
    if (!offline) {
      void this.flush();
    }
  }

  public isOnline(): boolean {
    if (this.simulatedOffline) return false;
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    void this.getSummary().then((s) => listener(s));
    return () => this.listeners.delete(listener);
  }

  private async notifyListeners(): Promise<void> {
    const summary = await this.getSummary();
    for (const l of this.listeners) {
      try {
        l(summary);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    }
  }

  public async getSummary(): Promise<OutboxSummary> {
    return this.store.getSummary();
  }

  public async enqueue(
    item: Omit<
      OfflineObservationRecord,
      'createdAt' | 'status' | 'retryCount' | 'integrityHash'
    >
  ): Promise<OfflineObservationRecord> {
    const record = await this.store.enqueue(item);
    await this.notifyListeners();

    // If online, await flush so callers have predictable sync completion
    if (this.isOnline()) {
      await this.flush();
    }

    return record;
  }

  private activeFlushPromise: Promise<{
    processed: number;
    synced: number;
    failed: number;
    paused: boolean;
  }> | null = null;

  public async flush(): Promise<{
    processed: number;
    synced: number;
    failed: number;
    paused: boolean;
  }> {
    if (this.activeFlushPromise) {
      return this.activeFlushPromise;
    }
    this.activeFlushPromise = this.doFlush();
    try {
      return await this.activeFlushPromise;
    } finally {
      this.activeFlushPromise = null;
    }
  }

  private async doFlush(): Promise<{
    processed: number;
    synced: number;
    failed: number;
    paused: boolean;
  }> {
    if (!this.isOnline()) {
      await this.notifyListeners();
      return { processed: 0, synced: 0, failed: 0, paused: true };
    }

    this.isSyncing = true;
    let processed = 0;
    let synced = 0;
    let failed = 0;
    let paused = false;

    try {
      const pending = await this.store.getPending();
      for (const item of pending) {
        if (!this.isOnline()) {
          paused = true;
          break;
        }

        const clock = new SystemClock();
        processed++;
        await this.store.updateStatus(item.clientIdempotencyKey, 'SYNCING', {
          lastAttemptAt: clock.nowIso(),
        });
        await this.notifyListeners();

        try {
          const res = await this.fetchFn('/api/observations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.clientIdempotencyKey,
            },
            body: JSON.stringify({
              taskId: item.taskId,
              phoneHash: item.phoneHash,
              clientIdempotencyKey: item.clientIdempotencyKey,
              answers: item.answers,
              channel: item.channel,
              geoCell: item.geoCell,
              msisdnPrefixBucket: item.msisdnPrefixBucket,
              submittedAt: item.submittedAt,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            await this.store.updateStatus(item.clientIdempotencyKey, 'SYNCED', {
              serverResponse: data,
              lastError: null,
            });
            synced++;
          } else {
            const status = res.status;
            let errorText = '';
            try {
              const errJson = await res.json();
              errorText = errJson.detail || errJson.title || errJson.code || `HTTP ${status}`;
            } catch {
              errorText = `HTTP ${status}`;
            }

            // Classification:
            // 4xx errors are terminal (validation, missing task, closed task, conflict)
            if (status >= 400 && status < 500 && status !== 429) {
              await this.store.updateStatus(item.clientIdempotencyKey, 'FAILED', {
                lastError: errorText,
              });
              failed++;
            } else {
              // Retryable 5xx or 429
              await this.store.updateStatus(item.clientIdempotencyKey, 'QUEUED', {
                retryCount: item.retryCount + 1,
                lastError: errorText,
              });
              paused = true;
              break; // Pause remaining queue on transient outage
            }
          }
        } catch (netErr: unknown) {
          const msg = netErr instanceof Error ? netErr.message : 'Network error';
          await this.store.updateStatus(item.clientIdempotencyKey, 'QUEUED', {
            retryCount: item.retryCount + 1,
            lastError: msg,
          });
          paused = true;
          break; // Pause remaining queue on network disconnect
        }

        await this.notifyListeners();
      }
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
    }

    return { processed, synced, failed, paused };
  }

  /**
   * Resets FAILED item(s) back to QUEUED and triggers an immediate flush,
   * enabling recovery from transient client/network error states.
   */
  public async retryFailed(clientIdempotencyKey?: string): Promise<{
    processed: number;
    synced: number;
    failed: number;
    paused: boolean;
  }> {
    const all = await this.store.getAll();
    for (const item of all) {
      if (item.status === 'FAILED') {
        if (!clientIdempotencyKey || item.clientIdempotencyKey === clientIdempotencyKey) {
          await this.store.updateStatus(item.clientIdempotencyKey, 'QUEUED', {
            retryCount: 0,
            lastError: null,
          });
        }
      }
    }
    await this.notifyListeners();
    return this.flush();
  }
}

let globalSyncEngine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!globalSyncEngine) {
    globalSyncEngine = new SyncEngine();
  }
  return globalSyncEngine;
}
