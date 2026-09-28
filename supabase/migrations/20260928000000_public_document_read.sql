-- Public documents are readable without signing in. The existing approved-user
-- policy remains in place and is ORed with this permissive SELECT policy.
begin;

create policy "Anyone can read published non-secret documents"
  on public.documents for select
  to anon, authenticated
  using (status = 'Published' and category_id <> 'cat-secret');

-- RLS filters rows, not columns: do not expose entire profiles (including email)
-- to anonymous readers. Only return the displayed author of a public document.
create or replace function public.get_public_document_author(document_id text)
returns table (id uuid, name text)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.name
  from public.documents d
  join public.profiles p on p.id = d.owner_id
  where d.id = document_id
    and d.status = 'Published'
    and d.category_id <> 'cat-secret';
$$;

revoke all on function public.get_public_document_author(text) from public;
grant execute on function public.get_public_document_author(text) to anon, authenticated;

commit;
