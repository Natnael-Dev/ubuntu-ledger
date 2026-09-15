-- Migration 003: Sources, receipts, and asset taxonomy
-- Authoritative source: docs/specs/03-data-model.md §3, §4, §12
-- Note: asset_type is defined in §4 but introduced here as the upstream taxonomy prerequisite
-- so that project and asset foreign keys can be enforced immediately at table creation time.

create table asset_type (
  key           text primary key,              -- 'borehole'
  label_key     text not null,                 -- i18n key
  questions     jsonb not null,                -- [{ "id":"q1","label_key":"...","audio_key":"..." }, ...]
  max_questions int generated always as (jsonb_array_length(questions)) stored,
  constraint max_three_questions check (jsonb_array_length(questions) between 2 and 3)
);

create table source_document (
  id               uuid primary key default gen_random_uuid(),
  ward_id          uuid not null references ward(id),
  title            text not null,
  issuer           text not null,
  published_on     date,
  archived_at      timestamptz not null default now(),
  storage_path     text,                        -- Supabase storage object
  sha256           char(64) not null,           -- hash of the bytes we archived
  page_count       int,
  ingest_reviewer  text,                        -- initials of the human who confirmed extraction
  reviewed_at      timestamptz,
  constraint sha256_lower check (sha256 = lower(sha256))
);
create unique index source_document_sha_idx on source_document(sha256);

create table project (
  id                 uuid primary key default gen_random_uuid(),
  ward_id            uuid not null references ward(id),
  project_code       text not null,             -- '#4412' as printed on the board
  title              text not null,             -- plain-language, NOT the gazette wording
  official_title     text,                      -- verbatim gazette wording, preserved
  asset_type         text not null references asset_type(key),
  contractor_name    text,
  amount_minor       bigint not null check (amount_minor >= 0),
  currency           char(3) not null,
  promised_completion date,
  source_document_id uuid references source_document(id),
  source_page        int,
  confidence         source_confidence not null,
  fiscal             fiscal_state not null default 'PROMISED',
  audit              audit_state  not null default 'NOT_DISPATCHED',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (ward_id, project_code),
  -- a cited receipt line MUST carry a document and page
  constraint cited_requires_source check (
    confidence <> 'OFFICIAL_CITED' or (source_document_id is not null and source_page is not null)
  )
);
create index project_ward_audit_idx on project(ward_id, audit);
create index project_asset_type_idx on project(asset_type);

create table asset (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references project(id) on delete cascade,
  asset_type    text not null references asset_type(key),
  label         text not null,                 -- 'Handpump behind the primary school'
  landmark      text not null,                 -- how a person finds it without a map
  geo_cell      text not null,                 -- COARSE cell id only. NEVER store precise GPS.
  created_at    timestamptz not null default now()
);
create index asset_project_idx on asset(project_id);
create index asset_geo_cell_idx on asset(geo_cell);

alter table asset_type enable row level security;
alter table source_document enable row level security;
alter table project enable row level security;
alter table asset enable row level security;

create policy project_public_read on project
  for select using (true);
