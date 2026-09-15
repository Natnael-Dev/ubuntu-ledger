-- Migration 006: Repair probation
-- Authoritative source: docs/specs/03-data-model.md §6, §12

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

alter table repair_ticket enable row level security;
alter table probation_ping enable row level security;
