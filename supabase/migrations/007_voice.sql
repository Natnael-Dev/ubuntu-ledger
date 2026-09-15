-- Migration 007: Voice pipeline (zero-PII)
-- Authoritative source: docs/specs/03-data-model.md §7, §12

create table voice_note (
  id              uuid primary key default gen_random_uuid(),
  ward_id         uuid not null references ward(id),
  task_id         uuid references inspection_task(id),
  storage_path    text,                        -- nulled on purge
  duration_ms     int,
  state           voice_state not null default 'AUDIO_RECORDED',
  structured      jsonb,                       -- {"q1":true,...} extracted intent only
  moderator_id    uuid,
  moderated_at    timestamptz,
  purge_after     timestamptz not null,        -- recorded_at + 48h, enforced by cron
  purged_at       timestamptz,
  created_at      timestamptz not null default now(),
  constraint purge_window check (purge_after <= created_at + interval '48 hours')
);
create index voice_purge_due_idx on voice_note(purge_after) where purged_at is null;

alter table voice_note enable row level security;

create policy voice_no_client on voice_note
  for select using (false);
