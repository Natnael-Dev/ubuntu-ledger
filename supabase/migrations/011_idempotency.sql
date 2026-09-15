-- Migration 011: Idempotency
-- Authoritative source: docs/specs/03-data-model.md §11, §12

create table idempotency_record (
  key          text primary key,
  endpoint     text not null,
  request_hash char(64) not null,
  response     jsonb not null,
  created_at   timestamptz not null default now()
);
create index idempotency_age_idx on idempotency_record(created_at);

alter table idempotency_record enable row level security;
