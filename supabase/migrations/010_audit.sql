-- Migration 010: Append-only audit chain
-- Authoritative source: docs/specs/03-data-model.md §10, §12

create table audit_event (
  seq          bigserial primary key,
  ward_id      uuid references ward(id),
  actor_role   actor_role not null,
  actor_ref    text,                            -- role/initials/system job name. NEVER a citizen identity.
  action       text not null,                   -- 'PROJECT_STATE_CHANGED'
  entity_type  text not null,
  entity_id    uuid,
  payload      jsonb not null,                  -- redacted; no PII, no raw phone, no free text from citizens
  payload_hash char(64) not null,
  prev_hash    char(64) not null,
  hash         char(64) not null,
  occurred_at  timestamptz not null default now()
);
create unique index audit_hash_idx on audit_event(hash);
create index audit_entity_idx on audit_event(entity_type, entity_id, seq);

-- Hard append-only guarantee
create rule audit_no_update as on update to audit_event do instead nothing;
create rule audit_no_delete as on delete to audit_event do instead nothing;

alter table audit_event enable row level security;
