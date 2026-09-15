-- Migration 004: Proof tasks and observations
-- Authoritative source: docs/specs/03-data-model.md §4, §12
-- Note: asset_type was established in 003_receipts.sql as a taxonomy prerequisite.

create table inspection_task (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references project(id) on delete cascade,
  asset_id        uuid not null references asset(id),
  dispatched_at   timestamptz not null default now(),
  expires_at      timestamptz not null,
  witness_target  int not null default 3,
  witness_count   int not null default 0,      -- DISTINCT clusters, maintained by app-service
  closed_at       timestamptz,
  constraint expiry_after_dispatch check (expires_at > dispatched_at)
);
create index task_project_idx on inspection_task(project_id);
create index task_open_idx on inspection_task(expires_at) where closed_at is null;

create table respondent (
  id             uuid primary key default gen_random_uuid(),
  ward_id        uuid not null references ward(id),
  phone_hash     char(64) not null,            -- HMAC-SHA256(msisdn, PEPPER). Used for ALL joins.
  phone_enc      bytea,                        -- pgp_sym_encrypt(msisdn). Only the outbox worker decrypts.
  msisdn_prefix  text,                         -- first 6 digits ONLY, for sybil cohort detection
  registered_at  timestamptz not null default now(),
  locale         text not null,
  unique (phone_hash)
);
create index respondent_ward_idx on respondent(ward_id);
create index respondent_prefix_idx on respondent(msisdn_prefix);

create table observation (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references inspection_task(id) on delete cascade,
  respondent_id    uuid not null references respondent(id),
  channel          channel not null,
  answers          jsonb not null,             -- {"q1":true,"q2":false,"q3":true}
  cluster_key      text not null,              -- derived by domain/sybil, see 07 §3
  weight           smallint not null default 1 check (weight in (0,1)),
  geo_cell         text,
  idempotency_key  text not null,
  submitted_at     timestamptz not null default now(),
  received_at      timestamptz not null default now(),   -- differs from submitted_at when queued offline
  unique (task_id, respondent_id),             -- one answer per respondent per task
  unique (idempotency_key)
);
create index observation_task_cluster_idx on observation(task_id, cluster_key);

alter table inspection_task enable row level security;
alter table respondent enable row level security;
alter table observation enable row level security;

create policy observation_no_public on observation
  for select using (false);

create policy respondent_no_client on respondent
  for select using (false);
