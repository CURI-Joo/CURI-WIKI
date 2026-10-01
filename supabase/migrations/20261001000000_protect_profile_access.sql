-- Self-service profile edits must not grant approval or administrator access.
-- Keep name/avatar edits and the existing approved-admin management flow working.
create or replace function public.protect_profile_access()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
    and current_user not in ('postgres', 'supabase_admin', 'service_role')
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin()
  then
    raise exception 'Only an approved administrator can change account role or approval status.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_access() from public;

drop trigger if exists protect_profile_access on public.profiles;
create trigger protect_profile_access
  before update of role, status on public.profiles
  for each row execute function public.protect_profile_access();
