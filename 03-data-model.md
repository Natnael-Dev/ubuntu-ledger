# 03 — Data Model

Postgres 15+ (Supabase). All tables in schema `public` unless stated. All timestamps `timestamptz`. All money in **minor units** as `bigint` (never floats). All identifiers `uuid default gen_random_uuid()`.

**Rule:** no table gets a `status` column that is not governed by a state machine in `04-state-machine.md`, and no status is written outside the domain core.

---

## 1. Enumerated types

```sql
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
```

---

## 2. Jurisdiction and configuration

```sql
create table country (
  code            text primary key,              -- ISO-3166-1 alpha-2, e.g. 'ET'
  name            text not null,
  currency        char(3) not null,              -- 'ETB'
  admin_tier_labels jsonb not null,              -- ["Region","Zone","Woreda","Kebele"]
  default_locale  text not null,
  locales         text[] not null,
  config_version  int not null default 1,
  created_at      timestamptz not null default now()
);

create table ward (
  id            uuid primary key default gen_random_uuid(),
  country_code  text not null references country(code),
  code          text not null,                   -- 'ET-AA-W09'  (human-usable, appears on posters)
  name          text not null,
  admin_path    text[] not null,                 -- ['Addis Ababa','Sub-city X','Woreda 9']
  locales       text[] not null,
  radio_partner text,                            -- nullable: a PoC deployment may have none
  created_at    timestamptz not null default now(),
  unique (country_code, code)
);
create index ward_country_idx on ward(country_code);
```

---

## 3. Sources and receipts

```sql
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
```

> **Privacy constraint:** `geo_cell` is a coarse grid identifier (≈1 km). There is no `lat`/`lng` column anywhere in this schema, by design. Do not add one.

---

## 4. Proof tasks and observations

```sql
create table asset_type (
  key           text primary key,              -- 'borehole'
  label_key     text not null,                 -- i18n key
  questions     jsonb not null,                -- [{ "id":"q1","label_key":"...","audio_key":"..." }, ...]
  max_questions int generated always as (jsonb_array_length(questions)) stored,
  constraint max_three_questions check (jsonb_array_length(questions) between 2 and 3)
);

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
```

> `weight = 0` means the observation is recorded and auditable but does **not** count as a witness (it duplicates an existing cluster). Never delete a duplicate — suppress it.

---

## 5. Services, statutory rules and divergence

```sql
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
```

**Outcome codes (fixed, never renumbered):**

| Code | Neutral label (i18n key) | Meaning |
|---|---|---|
| 1 | `outcome.served_at_official_fee` | Service received at the statutory fee |
| 2 | `outcome.additional_payment_requested` | An amount above the statutory ceiling was requested |
| 3 | `outcome.receipt_not_provided` | Payment made, no official receipt issued |
| 4 | `outcome.undocumented_requirement` | A requirement not on the statutory list was asked for |
| 5 | `outcome.office_inaccessible` | Office closed / service unavailable |

```sql
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
```

---

## 6. Repair probation

```sql
create table repair_ticket (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid not null references asset(id) on delete cascade,
  project_id          uuid references project(id),
  state               probation_state not null default 'REPORTED_BROKEN',
  reported_broken_at  timestamptz not null default now(),
  repair_claimed_at   timestamptz,
  claimed_by          text,                    -- organisation name, never a person
  probation_started_at timestamptz,
  probation_ends_at   timestamptz,
  probation_days      smallint not null default 7 check (probation_days between 7 and 14),
  resolved_at         timestamptz,
  failure_reason_key  text,
  created_at          timestamptz not null default now(),
  -- the closing key is held by time + community, never by a claim
  constraint sustained_requires_probation_end check (
    state <> 'VERIFIED_SUSTAINED' or (probation_ends_at is not null and resolved_at >= probation_ends_at)
  )
);
create index ticket_asset_idx on repair_ticket(asset_id);
create index ticket_probation_due_idx on repair_ticket(probation_ends_at)
  where state = 'PROBATION_ACTIVE';

create table probation_ping (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references repair_ticket(id) on delete cascade,
  respondent_id  uuid not null references respondent(id),
  scheduled_for  timestamptz not null,
  sent_at        timestamptz,
  responded_at   timestamptz,
  still_working  boolean,
  cluster_key    text,
  unique (ticket_id, respondent_id, scheduled_for)
);
create index ping_due_idx on probation_ping(scheduled_for) where sent_at is null;
```

> The `sustained_requires_probation_end` CHECK is the **database-level guarantee** behind the demo's key moment. A contractor claim cannot bypass it even if application code is wrong. Point at this constraint in the video.

---

## 7. Voice pipeline (zero-PII)

```sql
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
```

No transcript column exists. Intent is stored as booleans/enums only. See `07 §5`.

---

## 8. Bulletins

```sql
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
```

---

## 9. Messaging outbox

```sql
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
```

---

## 10. Append-only audit chain

```sql
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
```

`hash = sha256(seq || prev_hash || payload_hash || occurred_at)`. Genesis `prev_hash` = 64 zeros. A verifier endpoint walks the chain and reports the first break. See `07 §7`.

```sql
-- Hard append-only guarantee
create rule audit_no_update as on update to audit_event do instead nothing;
create rule audit_no_delete as on delete to audit_event do instead nothing;
```

---

## 11. Idempotency

```sql
create table idempotency_record (
  key          text primary key,
  endpoint     text not null,
  request_hash char(64) not null,
  response     jsonb not null,
  created_at   timestamptz not null default now()
);
create index idempotency_age_idx on idempotency_record(created_at);
```

Every mutating endpoint requires an `Idempotency-Key`. Replay with the same key and same `request_hash` returns the stored response. Same key, different hash → `409 idempotency_key_reused`.

---

## 12. Row Level Security

Enable RLS on **every** table. Default deny. Roles: `anon` (public/citizen paths via service-role-backed API only), `authenticated` with a `role` claim of `moderator` / `ingest_reviewer` / `admin`.

```sql
alter table project enable row level security;
alter table observation enable row level security;
-- ... repeat for every table

-- Public may read receipts, but only cited/uncited official lines and never internal fields
create policy project_public_read on project
  for select using (true);

-- Nobody may write a project except service role (ingestion goes through the API)
-- (no insert/update policy for anon/authenticated = denied)

-- Observations: no direct client access at all. Writes go through the API with the service role.
create policy observation_no_public on observation
  for select using (false);

-- Divergence aggregates: readable only when k is satisfied
create policy divergence_k_gated on divergence_aggregate
  for select using (k_satisfied = true);

-- Moderator scope
create policy bulletin_moderator_rw on radio_bulletin
  for all using (auth.jwt() ->> 'role' in ('moderator','admin'))
  with check (auth.jwt() ->> 'role' in ('moderator','admin'));

-- Respondent PII is never client-readable
create policy respondent_no_client on respondent for select using (false);
create policy voice_no_client on voice_note for select using (false);
```

**Test requirement:** `tests/unit/rls.test.ts` must assert, with an anon client, that selecting from `respondent`, `voice_note`, `observation` and `audit_event` returns zero rows, and that `divergence_aggregate` returns zero rows while `k_satisfied = false`.

---

## 13. Indexing rationale (state, don't guess)

| Index | Serves |
|---|---|
| `project_ward_audit_idx` | ward receipt listing filtered by audit state — the main public query |
| `observation_task_cluster_idx` | `count(distinct cluster_key)` per task — the triangulation hot path |
| `ticket_probation_due_idx` (partial) | cron scan for probation windows closing |
| `outbox_due_idx` (partial) | cron scan for unsent messages |
| `voice_purge_due_idx` (partial) | cron scan for audio past TTL |
| `audit_entity_idx` | entity history walk for the "prove it" view |

---

## 14. Concurrency

- Any transition that reads-then-writes a lifecycle state must `select ... for update` on the owning aggregate row (`project` or `repair_ticket`) inside the transaction.
- Witness recount runs in the same transaction as the observation insert.
- Two simultaneous observations completing the threshold must produce exactly **one** state-change audit event. This is an adversarial test case (`ADV-07`).

---

## 15. Seed data shape (one ward, demo-sized)

| Table | Rows | Notes |
|---|---|---|
| `country` | 2 | ET (full), KE (shell, proves portability) |
| `ward` | 1 | `ET-AA-W09` |
| `source_document` | 2 | one with a real hash, one deliberately absent → drives `UNOFFICIAL_ESTIMATE` |
| `project` | 6 | 1 generator (demo hero), 1 borehole, 1 latrine block, 3 filler |
| `asset` | 6 | each with a landmark string, no coordinates |
| `asset_type` | 3 | borehole, generator, latrine_block |
| `respondent` | 12 | spread across 4 distinct `cluster_key`s, incl. 3 sharing one cluster (sybil demo) |
| `service` | 2 | ID replacement, clinic intake |
| `statutory_rule` | 2 | with reviewer initials and real-shaped citations |
| `visit_outcome` | 14 | tuned so one service sits just below k and one just above |
| `repair_ticket` | 1 | the generator, primed at `REPAIR_CLAIMED` for the demo |
