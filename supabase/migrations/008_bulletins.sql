-- Migration 008: Radio bulletins
-- Authoritative source: docs/specs/03-data-model.md §8, §12

create table radio_bulletin (
  id             uuid primary key default gen_random_uuid(),
  ward_id        uuid not null references ward(id),
  period_start   date not null,
  period_end     date not null,
  facts          jsonb not null,               -- the k-gated fact set the script was built from
  script_text    text not null,
  locale         text not null,
  state          bulletin_state not null default 'DRAFT',
  moderator_id   uuid,
  moderated_at   timestamptz,
  rejection_reason text,
  audio_path     text,                         -- P2 only
  created_at     timestamptz not null default now(),
  unique (ward_id, period_start, locale)
);
create index bulletin_ward_state_idx on radio_bulletin(ward_id, state);

alter table radio_bulletin enable row level security;

create policy bulletin_moderator_rw on radio_bulletin
  for all using (auth.jwt() ->> 'role' in ('moderator','admin'))
  with check (auth.jwt() ->> 'role' in ('moderator','admin'));
