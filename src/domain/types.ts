// Core Domain Types
// Authoritative sources: docs/specs/03-data-model.md §1, docs/specs/04-state-machine.md §8
export type { Locale } from './content';

export type FiscalState = 'PROMISED' | 'COMMITTED' | 'DISBURSED' | 'AUDITED';

export type AuditState =
  | 'NOT_DISPATCHED'
  | 'TASK_DISPATCHED'
  | 'AWAITING_THRESHOLD'
  | 'PHYSICALLY_CONFIRMED'
  | 'DISCREPANCY_FLAGGED';

export type ProbationState =
  | 'REPORTED_BROKEN'
  | 'REPAIR_CLAIMED'
  | 'PROBATION_DAY_0'
  | 'PROBATION_ACTIVE'
  | 'VERIFIED_SUSTAINED'
  | 'PROBATION_FAILED';

export type BulletinState =
  | 'DRAFT'
  | 'APPROVED_FOR_BROADCAST'
  | 'REJECTED'
  | 'BROADCAST_CONFIRMED';

export type SourceConfidence =
  | 'OFFICIAL_CITED'
  | 'OFFICIAL_UNCITED'
  | 'UNOFFICIAL_ESTIMATE';

export type Channel = 'USSD' | 'SMS' | 'IVR' | 'PWA' | 'CONSOLE';

export type ActorRole =
  | 'CITIZEN'
  | 'MONITOR'
  | 'MODERATOR'
  | 'INGEST_REVIEWER'
  | 'ADMIN'
  | 'SYSTEM';

export type VoiceState =
  | 'AUDIO_RECORDED'
  | 'INTENT_STRUCTURED'
  | 'HUMAN_AUDITED'
  | 'PURGED'
  | 'REJECTED';

export type DomainErrorCode =
  | 'E_ILLEGAL_TRANSITION'
  | 'E_TERMINAL_STATE'
  | 'E_UNINITIALIZED'
  | 'E_ALREADY_INITIALIZED'
  | 'E_UNOFFICIAL_ESTIMATE_CANNOT_COMMIT'
  | 'E_MISSING_SOURCE_CITATION'
  | 'E_MISSING_DISBURSEMENT_DOCUMENT'
  | 'E_AUDIT_NOT_SETTLED'
  | 'E_GUARD_FAILED'
  | 'E_PROBATION_LOCKED';

export type Effect =
  | { kind: 'AUDIT'; action: string; payload: Record<string, unknown> }
  | { kind: 'SET_CONFIDENCE'; confidence: SourceConfidence }
  | { kind: 'MARK_BULLETIN_ELIGIBLE' }
  | { kind: 'CREATE_TASK'; taskId: string; assetId: string; expiresAt: string }
  | { kind: 'RECOMPUTE_WITNESS_COUNT'; witnessCount: number; clusterKey: string }
  | { kind: 'NOTIFY_MODERATOR'; action: string }
  | { kind: 'ENQUEUE_MODERATOR'; queue: string }
  | { kind: 'PAUSE_PROBATION_CLOCK' }
  | { kind: 'OPEN_RESPONSE_WINDOW'; durationHours: number }
  | { kind: 'QUEUE_BULLETIN_CORRECTION' }
  | { kind: 'CLOSE_TASK' }
  | { kind: 'SCHEDULE_PING'; pingDay: 3 | 7; ticketId: string; respondentId?: string; clusterKey?: string }
  | { kind: 'ENQUEUE_OUTBOX'; templateKey: string; recipientId: string }
  | { kind: 'INCREMENT_FAILURE_COUNT'; claimingOrg: string }
  | { kind: 'QUEUE_BULLETIN_FACT'; reason: string; assetId?: string; ticketId?: string };
