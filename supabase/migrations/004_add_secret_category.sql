-- ============================================================
-- Add Secret category
-- ============================================================

insert into public.categories (id, name, slug, icon, parent_id, sort_order)
values ('cat-secret', 'Secret', 'secret', 'Shield', null, 3)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  icon = excluded.icon,
  parent_id = excluded.parent_id,
  sort_order = excluded.sort_order;
