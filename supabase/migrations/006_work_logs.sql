-- ============================================================
-- Work Logs: 개인 업무일지 캘린더
-- ============================================================

create table if not exists public.work_logs (
  id text primary key default ('wlog-' || gen_random_uuid()::text),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  project text not null check (project in ('CURI', 'LG생활건강', 'LG전자', 'WAME', 'Internal', 'ETC')),
  title text not null,
  description text not null default '',
  status text not null default 'In Progress' check (status in ('Todo', 'In Progress', 'Done')),
  related_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_logs_user_id_idx on public.work_logs (user_id);
create index if not exists work_logs_work_date_idx on public.work_logs (work_date desc);
create index if not exists work_logs_user_date_idx on public.work_logs (user_id, work_date desc);

alter table public.work_logs enable row level security;

create policy "Approved users can read own work logs"
  on public.work_logs for select
  using (public.is_approved() and user_id = auth.uid());

create policy "Approved users can create own work logs"
  on public.work_logs for insert
  with check (public.is_approved() and user_id = auth.uid());

create policy "Approved users can update own work logs"
  on public.work_logs for update
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create policy "Approved users can delete own work logs"
  on public.work_logs for delete
  using (public.is_approved() and user_id = auth.uid());

