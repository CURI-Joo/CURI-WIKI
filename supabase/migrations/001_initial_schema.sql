-- ============================================================
-- CURI Wiki: Initial Schema
-- ============================================================

-- ─── Profiles ────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Categories ──────────────────────────────────────────────
create table public.categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  icon text not null,
  parent_id text references public.categories(id),
  sort_order integer not null default 0
);

-- ─── Documents ───────────────────────────────────────────────
create table public.documents (
  id text primary key default ('doc-' || gen_random_uuid()::text),
  title text not null,
  slug text not null unique,
  summary text not null default '',
  content_markdown text not null default '',
  category_id text not null references public.categories(id),
  owner_id uuid not null references public.profiles(id),
  status text not null default 'Published' check (status in ('Draft', 'Published', 'Archived')),
  visibility text not null default 'COMPANY' check (visibility in ('COMPANY', 'RESTRICTED')),
  external_status text not null default 'INTERNAL_ONLY' check (external_status in ('INTERNAL_ONLY', 'REVIEW_REQUIRED', 'EXTERNAL_OK')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz default now()
);

-- ─── Document Access ─────────────────────────────────────────
create table public.document_access (
  id text primary key default ('access-' || gen_random_uuid()::text),
  document_id text not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null default 'VIEW' check (access_level in ('VIEW', 'EDIT')),
  unique (document_id, user_id)
);

-- ─── Tags ────────────────────────────────────────────────────
create table public.tags (
  id text primary key,
  name text not null,
  slug text not null unique
);

create table public.document_tags (
  document_id text not null references public.documents(id) on delete cascade,
  tag_id text not null references public.tags(id) on delete cascade,
  primary key (document_id, tag_id)
);

-- ─── Issues ──────────────────────────────────────────────────
create table public.issues (
  id text primary key,
  title text not null,
  description text not null default '',
  project text not null check (project in ('Admin', 'Healthcare', 'Dashboard', 'Wiki')),
  status text not null default '이슈 등록' check (status in ('이슈 등록', '해결 중', '이슈 해결')),
  priority text not null check (priority in ('즉시 수정 필요', '차차 수정 필요', '개선 사항')),
  reporter_id uuid not null references public.profiles(id),
  assignee_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Issue Activities ────────────────────────────────────────
create table public.issue_activities (
  id text primary key default ('act-' || gen_random_uuid()::text),
  issue_id text not null references public.issues(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  type text not null check (type in ('created', 'status_changed')),
  detail text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Attachments ─────────────────────────────────────────────
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  issue_id text references public.issues(id) on delete set null,
  document_id text references public.documents(id) on delete set null,
  storage_key text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS Helper Functions
-- ============================================================

create or replace function public.is_approved()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved' and role = 'admin'
  );
$$;

-- ============================================================
-- Enable RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.documents enable row level security;
alter table public.document_access enable row level security;
alter table public.tags enable row level security;
alter table public.document_tags enable row level security;
alter table public.issues enable row level security;
alter table public.issue_activities enable row level security;
alter table public.attachments enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================

-- ─── Profiles ────────────────────────────────────────────────
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Approved users can read all profiles"
  on public.profiles for select
  using (public.is_approved());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admin can update any profile"
  on public.profiles for update
  using (public.is_admin());

-- ─── Categories ──────────────────────────────────────────────
create policy "Approved users can read categories"
  on public.categories for select
  using (public.is_approved());

-- ─── Documents ───────────────────────────────────────────────
create policy "Approved users can read documents"
  on public.documents for select
  using (public.is_approved());

create policy "Approved users can insert documents"
  on public.documents for insert
  with check (public.is_approved() and created_by = auth.uid());

create policy "Doc owners and admins can update"
  on public.documents for update
  using (public.is_approved() and (owner_id = auth.uid() or public.is_admin()));

-- ─── Document Access ─────────────────────────────────────────
create policy "Approved users can read doc access"
  on public.document_access for select
  using (public.is_approved());

create policy "Doc owners and admins can manage access"
  on public.document_access for all
  using (
    public.is_approved() and (
      public.is_admin()
      or exists (
        select 1 from public.documents
        where id = document_access.document_id and owner_id = auth.uid()
      )
    )
  );

-- ─── Tags ────────────────────────────────────────────────────
create policy "Approved users can read tags"
  on public.tags for select
  using (public.is_approved());

create policy "Approved users can read doc tags"
  on public.document_tags for select
  using (public.is_approved());

-- ─── Issues ──────────────────────────────────────────────────
create policy "Approved users can read issues"
  on public.issues for select
  using (public.is_approved());

create policy "Approved users can create issues"
  on public.issues for insert
  with check (public.is_approved() and reporter_id = auth.uid());

create policy "Approved users can update issues"
  on public.issues for update
  using (public.is_approved());

create policy "Reporter and admin can delete issues"
  on public.issues for delete
  using (public.is_approved() and (reporter_id = auth.uid() or public.is_admin()));

-- ─── Issue Activities ────────────────────────────────────────
create policy "Approved users can read activities"
  on public.issue_activities for select
  using (public.is_approved());

create policy "Approved users can create activities"
  on public.issue_activities for insert
  with check (public.is_approved() and actor_id = auth.uid());

-- ─── Attachments ─────────────────────────────────────────────
create policy "Approved users can read attachments"
  on public.attachments for select
  using (public.is_approved());

create policy "Approved users can insert attachments"
  on public.attachments for insert
  with check (public.is_approved() and uploaded_by = auth.uid());

-- ============================================================
-- Auth Trigger: Auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.profiles (id, email, name, avatar_url, role, status)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    'member',
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Storage: wiki-media bucket
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wiki-media',
  'wiki-media',
  false,
  104857600, -- 100MB
  array[
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
);

-- Storage RLS
create policy "Approved users can upload to wiki-media"
  on storage.objects for insert
  with check (bucket_id = 'wiki-media' and public.is_approved());

create policy "Approved users can read wiki-media"
  on storage.objects for select
  using (bucket_id = 'wiki-media' and public.is_approved());

create policy "Uploaders and admins can delete from wiki-media"
  on storage.objects for delete
  using (
    bucket_id = 'wiki-media'
    and public.is_approved()
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );
