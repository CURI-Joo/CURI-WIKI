-- ============================================================
-- Secret category: admin-only access policies
-- ============================================================

-- Categories

drop policy if exists "Approved users can read categories" on public.categories;

create policy "Approved users can read categories"
  on public.categories for select
  using (
    public.is_approved()
    and (slug <> 'secret' or public.is_admin())
  );

-- Documents

drop policy if exists "Approved users can read documents" on public.documents;
drop policy if exists "Approved users can insert documents" on public.documents;
drop policy if exists "Doc owners and admins can update" on public.documents;

create policy "Approved users can read documents"
  on public.documents for select
  using (
    public.is_approved()
    and (category_id <> 'cat-secret' or public.is_admin())
  );

create policy "Approved users can insert documents"
  on public.documents for insert
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and (category_id <> 'cat-secret' or public.is_admin())
  );

create policy "Doc owners and admins can update"
  on public.documents for update
  using (
    public.is_approved()
    and (
      public.is_admin()
      or (owner_id = auth.uid() and category_id <> 'cat-secret')
    )
  )
  with check (
    public.is_approved()
    and (
      public.is_admin()
      or (owner_id = auth.uid() and category_id <> 'cat-secret')
    )
  );

-- Document access rows should follow document visibility

drop policy if exists "Approved users can read doc access" on public.document_access;

create policy "Approved users can read doc access"
  on public.document_access for select
  using (
    public.is_approved()
    and exists (
      select 1
      from public.documents d
      where d.id = document_access.document_id
    )
  );

-- Attachments tied to secret documents should not be readable by non-admin users

drop policy if exists "Approved users can read attachments" on public.attachments;

create policy "Approved users can read attachments"
  on public.attachments for select
  using (
    public.is_approved()
    and (
      document_id is null
      or exists (
        select 1
        from public.documents d
        where d.id = attachments.document_id
      )
    )
  );
