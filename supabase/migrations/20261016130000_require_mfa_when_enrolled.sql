-- Once a user has a verified two-step (TOTP) factor, every health table and their
-- media require a session that has passed the code (aal2). A stolen password alone
-- (aal1 session) then reads and writes nothing, even through the API directly.
-- Users without a verified factor are unaffected.
-- The helper lives in health_private, which is NOT exposed through the API.

create schema if not exists health_private;
revoke all on schema health_private from public;
grant usage on schema health_private to authenticated;

create or replace function health_private.mfa_satisfied() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = (select auth.uid()) and status = 'verified'
      );
$$;
revoke all on function health_private.mfa_satisfied() from public;
grant execute on function health_private.mfa_satisfied() to authenticated;

do $$ declare t text; begin
  foreach t in array array['profile','metrics','concerns','entries','regimens','challenges','lab_reports','lab_results','lab_markers','plans','courses','charts','daily_metrics','suggestions'] loop
    execute format('create policy "two-step when enrolled" on health.%I as restrictive for all to authenticated using ((select health_private.mfa_satisfied())) with check ((select health_private.mfa_satisfied()))', t);
  end loop;
end $$;

create policy "health-media two-step when enrolled" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'health-media' or (select health_private.mfa_satisfied()))
  with check (bucket_id <> 'health-media' or (select health_private.mfa_satisfied()));
