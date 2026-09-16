-- CURI Wiki MCP 커넥터용 OAuth 2.1 인가 서버 테이블
--
-- 이 테이블들은 service_role 로만 접근합니다. RLS를 켜고 정책을 만들지 않으면
-- anon / authenticated 역할은 전부 차단되고 service_role 은 RLS를 우회합니다.

create table if not exists public.mcp_oauth_clients (
  client_id           text primary key,
  client_name         text not null,
  redirect_uris       text[] not null,
  client_secret_hash  text,
  scope               text not null default 'wiki.read wiki.write',
  created_at          timestamptz not null default now()
);

create table if not exists public.mcp_auth_codes (
  code_hash             text primary key,
  client_id             text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  redirect_uri          text not null,
  scope                 text not null,
  code_challenge        text not null,
  code_challenge_method text not null default 'S256',
  resource              text,
  expires_at            bigint not null,
  used                  boolean not null default false,
  created_at            timestamptz not null default now()
);

create table if not exists public.mcp_tokens (
  token_hash  text primary key,
  kind        text not null check (kind in ('access', 'refresh')),
  client_id   text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  scope       text not null,
  resource    text,
  expires_at  bigint not null,
  revoked     boolean not null default false,
  parent_hash text,
  created_at  timestamptz not null default now()
);

create index if not exists mcp_tokens_user_idx on public.mcp_tokens (user_id, kind);
create index if not exists mcp_tokens_expiry_idx on public.mcp_tokens (expires_at);
create index if not exists mcp_auth_codes_expiry_idx on public.mcp_auth_codes (expires_at);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_auth_codes    enable row level security;
alter table public.mcp_tokens        enable row level security;

-- 인가 코드는 단 한 번만 교환될 수 있어야 합니다. 조회와 소비를 한 문장으로
-- 처리해서 동시에 두 번 교환되는 경우를 DB 레벨에서 막습니다.
create or replace function public.consume_mcp_auth_code(p_code_hash text)
returns public.mcp_auth_codes
language sql
security definer
set search_path = public
as $$
  update public.mcp_auth_codes
     set used = true
   where code_hash = p_code_hash
     and used = false
  returning *;
$$;

revoke all on function public.consume_mcp_auth_code(text) from public, anon, authenticated;
grant execute on function public.consume_mcp_auth_code(text) to service_role;

-- 만료된 코드/토큰 정리 (pg_cron 을 쓰면 하루 1회 스케줄 권장)
create or replace function public.cleanup_mcp_expired()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.mcp_auth_codes where expires_at < extract(epoch from now()) - 3600;
  delete from public.mcp_tokens     where expires_at < extract(epoch from now()) - 86400;
$$;

revoke all on function public.cleanup_mcp_expired() from public, anon, authenticated;
grant execute on function public.cleanup_mcp_expired() to service_role;
