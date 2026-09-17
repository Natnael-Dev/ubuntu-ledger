-- Migration 012: Audit Log TRUNCATE Immutability Seal
-- Authoritative sources: docs/specs/03-data-model.md §10, §12, docs/specs/07-trust-and-security.md §9
-- Prevents TRUNCATE table bypass of append-only audit event log

-- 1. Create a reusable trigger function to reject truncation
create or replace function seal_truncate_immutability()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IMMUTABILITY VIOLATION: TRUNCATE is forbidden on table "%" (audit log is append-only)', TG_TABLE_NAME
    using errcode = 'check_violation';
end;
$$;

-- 2. Bind statement-level BEFORE TRUNCATE trigger
drop trigger if exists audit_no_truncate on audit_event;
create trigger audit_no_truncate
before truncate on audit_event
for each statement
execute function seal_truncate_immutability();

-- 3. Mark trigger ENABLE ALWAYS so replica mode / replication cannot bypass it
alter table audit_event enable always trigger audit_no_truncate;

-- 4. Explicitly revoke TRUNCATE privileges from all public and standard roles
revoke truncate on audit_event from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke truncate on audit_event from anon;';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke truncate on audit_event from authenticated;';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke truncate on audit_event from service_role;';
  end if;
end $$;
