-- Migration 005: Services, statutory rules, and divergence
-- Authoritative source: docs/specs/03-data-model.md §5, §12

create table service (
  id             uuid primary key default gen_random_uuid(),
  ward_id        uuid not null references ward(id),
  code           text not null,                -- 'ET-ID-REPLACE'
  office_code    text not null,                -- aggregation unit. NEVER a person.
  label_key      text not null,
  created_at     timestamptz not null default now(),
  unique (ward_id, code)
);

create table statutory_rule (
  id                 uuid primary key default gen_random_uuid(),
  service_id         uuid not null references service(id) on delete cascade,
  fee_ceiling_minor  bigint not null check (fee_ceiling_minor >= 0),
  currency           char(3) not null,
  required_documents jsonb not null,           -- [{"label_key":"...","audio_key":"..."}]
  expected_visits    smallint not null default 1,
  refusal_script_key text not null,            -- i18n key for the exact sentence
  appeal_route_key   text not null,
  source_document_id uuid references source_document(id),
  source_page        int,
  reviewer_initials  text not null,
  reviewed_at        timestamptz not null,
  valid_from         date not null,
  valid_to           date,
  created_at         timestamptz not null default now()
);
create index statutory_service_valid_idx on statutory_rule(service_id, valid_from desc);

create table visit_outcome (
  id              uuid primary key default gen_random_uuid(),
  service_id      uuid not null references service(id) on delete cascade,
  outcome_code    smallint not null check (outcome_code between 1 and 5),
  extra_fee_minor bigint check (extra_fee_minor >= 0),
  visits_reported smallint check (visits_reported between 1 and 20),
  respondent_hash char(64) not null,           -- NOT a FK: we never link an outcome to a person record
  cluster_key     text not null,
  channel         channel not null,
  idempotency_key text not null unique,
  reported_at     timestamptz not null default now()
);
create index visit_outcome_service_time_idx on visit_outcome(service_id, reported_at desc);

-- Materialized aggregate; refreshed by cron. NEVER queried row-by-row from the public API.
create table divergence_aggregate (
  service_id           uuid not null references service(id) on delete cascade,
  window_days          smallint not null,       -- 30
  computed_at          timestamptz not null default now(),
  report_count         int not null,
  distinct_clusters    int not null,
  pct_additional_fee   numeric(5,2),
  median_extra_minor   bigint,
  avg_visits           numeric(4,2),
  k_satisfied          boolean not null,
  alert_active         boolean not null default false,
  primary key (service_id, window_days)
);

alter table service enable row level security;
alter table statutory_rule enable row level security;
alter table visit_outcome enable row level security;
alter table divergence_aggregate enable row level security;

create policy divergence_k_gated on divergence_aggregate
  for select using (k_satisfied = true);
