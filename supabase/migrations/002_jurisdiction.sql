-- Migration 002: Jurisdiction and configuration
-- Authoritative source: docs/specs/03-data-model.md §2, §12

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

alter table country enable row level security;
alter table ward enable row level security;
