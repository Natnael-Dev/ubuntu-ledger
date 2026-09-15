-- Migration 001: Enumerated types
-- Authoritative source: docs/specs/03-data-model.md §1

create type fiscal_state as enum (
  'PROMISED', 'COMMITTED', 'DISBURSED', 'AUDITED'
);

create type audit_state as enum (
  'NOT_DISPATCHED', 'TASK_DISPATCHED', 'AWAITING_THRESHOLD',
  'PHYSICALLY_CONFIRMED', 'DISCREPANCY_FLAGGED'
);

create type probation_state as enum (
  'REPORTED_BROKEN', 'REPAIR_CLAIMED', 'PROBATION_DAY_0',
  'PROBATION_ACTIVE', 'VERIFIED_SUSTAINED', 'PROBATION_FAILED'
);

create type bulletin_state as enum (
  'DRAFT', 'APPROVED_FOR_BROADCAST', 'REJECTED', 'BROADCAST_CONFIRMED'
);

create type source_confidence as enum (
  'OFFICIAL_CITED', 'OFFICIAL_UNCITED', 'UNOFFICIAL_ESTIMATE'
);

create type channel as enum ('USSD', 'SMS', 'IVR', 'PWA', 'CONSOLE');

create type actor_role as enum ('CITIZEN', 'MONITOR', 'MODERATOR', 'INGEST_REVIEWER', 'ADMIN', 'SYSTEM');

create type voice_state as enum ('AUDIO_RECORDED', 'INTENT_STRUCTURED', 'HUMAN_AUDITED', 'PURGED', 'REJECTED');
