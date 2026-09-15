-- Migration 009: Messaging outbox
-- Authoritative source: docs/specs/03-data-model.md §9, §12

create table outbox_message (
  id              uuid primary key default gen_random_uuid(),
  respondent_id   uuid references respondent(id),
  channel         channel not null,
  template_key    text not null,
  slots           jsonb not null default '{}'::jsonb,
  locale          text not null,
  scheduled_for   timestamptz not null default now(),
  sent_at         timestamptz,
  delivery_state  text not null default 'QUEUED',   -- QUEUED|SENT|FAILED|SIMULATED
  attempts        smallint not null default 0,
  last_error      text,
  idempotency_key text not null unique
);
create index outbox_due_idx on outbox_message(scheduled_for) where sent_at is null;

alter table outbox_message enable row level security;
