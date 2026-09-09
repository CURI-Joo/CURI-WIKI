-- ============================================================
-- AI Writer: Personal Access Tokens + Write Audit Logs
-- ============================================================

create table if not exists public.personal_access_tokens (
  id text primary key default ('pat-' || gen_random_uuid()::text),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  last_four text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists personal_access_tokens_user_id_idx
  on public.personal_access_tokens(user_id);

create index if not exists personal_access_tokens_active_idx
  on public.personal_access_tokens(user_id, revoked_at, expires_at);

create table if not exists public.ai_write_logs (
  id text primary key default ('awl-' || gen_random_uuid()::text),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  auth_method text not null check (auth_method in ('session', 'token')),
  document_id text references public.documents(id) on delete set null,
  request_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_write_logs_actor_id_idx
  on public.ai_write_logs(actor_id, created_at desc);

alter table public.personal_access_tokens enable row level security;
alter table public.ai_write_logs enable row level security;

-- PAT policies: users can only read/manage their own tokens
create policy "Users can read own personal access tokens"
  on public.personal_access_tokens for select
  using (auth.uid() = user_id);

create policy "Users can create own personal access tokens"
  on public.personal_access_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal access tokens"
  on public.personal_access_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal access tokens"
  on public.personal_access_tokens for delete
  using (auth.uid() = user_id);

-- AI write logs policies
create policy "Users can read own ai write logs"
  on public.ai_write_logs for select
  using (auth.uid() = actor_id or public.is_admin());

create policy "Users can insert own ai write logs"
  on public.ai_write_logs for insert
  with check (auth.uid() = actor_id);
