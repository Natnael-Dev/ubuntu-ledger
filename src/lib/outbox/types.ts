// T-29 Offline Observation Outbox & Sync Types
// Authoritative sources: docs/specs/03-data-model.md §9, §11; docs/specs/05-api-contracts.md §5; docs/specs/07-trust-and-security.md §3, §5

export type OutboxItemStatus =
  | 'QUEUED'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED'
  | 'CORRUPTED';

export interface ObservationAnswers {
  [questionId: string]: boolean;
}

export interface OfflineObservationRecord {
  /** Natural primary key: Client-generated UUID v4 sent as Idempotency-Key */
  clientIdempotencyKey: string;
  /** UUID of the target inspection task */
  taskId: string;
  /** Salted HMAC-SHA256 of the monitor MSISDN (ZERO raw MSISDN) */
  phoneHash: string;
  /** Discriminator channel */
  channel: 'PWA';
  /** Boolean answer map (zero free text) */
  answers: ObservationAnswers;
  /** Coarse grid cell (~1km, e.g. "et-aa-0917") or null (zero GPS) */
  geoCell: string | null;
  /** MSISDN prefix bucket (first 6 digits) or null */
  msisdnPrefixBucket?: string | null;
  /** ISO 8601 UTC client capture timestamp */
  submittedAt: string;
  /** Epoch ms for strict FIFO replay order */
  createdAt: number;
  /** Outbox lifecycle state */
  status: OutboxItemStatus;
  /** Retry attempt count for transient failures */
  retryCount: number;
  /** Timestamp of most recent dispatch attempt */
  lastAttemptAt?: string | null;
  /** Recorded error for diagnostics */
  lastError?: string | null;
  /** Integrity digest for client-side tamper detection */
  integrityHash: string;
  /** Cached server response upon successful sync */
  serverResponse?: {
    accepted: boolean;
    counted: boolean;
    clusterKey?: string;
    reasonKey?: string;
    witnessCount?: number;
    witnessTarget?: number;
    resultingNarrative?: string;
    messageKey?: string;
  } | null;
}

export interface OutboxSummary {
  total: number;
  queued: number;
  syncing: number;
  synced: number;
  failed: number;
}

export interface IOfflineOutboxStore {
  enqueue(
    item: Omit<
      OfflineObservationRecord,
      'createdAt' | 'status' | 'retryCount' | 'integrityHash'
    >
  ): Promise<OfflineObservationRecord>;
  getByKey(clientIdempotencyKey: string): Promise<OfflineObservationRecord | null>;
  getAll(): Promise<OfflineObservationRecord[]>;
  getPending(): Promise<OfflineObservationRecord[]>;
  updateStatus(
    clientIdempotencyKey: string,
    status: OutboxItemStatus,
    extra?: Partial<OfflineObservationRecord>
  ): Promise<void>;
  deleteRecord(clientIdempotencyKey: string): Promise<void>;
  clear(): Promise<void>;
  getSummary(): Promise<OutboxSummary>;
}
