-- ============================================================
-- CURI Wiki: Seed Data
-- ============================================================

-- ─── Categories (3개: curiai, wame, etc) ─────────────────────
insert into public.categories (id, name, slug, icon, parent_id, sort_order) values
  ('cat-curi-ai', 'CURI AI', 'curi-ai', 'Bot', null, 0),
  ('cat-etc', 'ETC', 'etc', 'MoreHorizontal', null, 1),
  ('cat-wame', 'WAME', 'wame', 'MessageSquare', null, 2);

-- ─── Tags ────────────────────────────────────────────────────
insert into public.tags (id, name, slug) values
  ('tag-ai', 'AI', 'ai'),
  ('tag-llm', 'LLM', 'llm'),
  ('tag-ux', 'UX', 'ux'),
  ('tag-design', 'Design', 'design'),
  ('tag-frontend', 'Frontend', 'frontend'),
  ('tag-backend', 'Backend', 'backend'),
  ('tag-infra', 'Infra', 'infra'),
  ('tag-qa', 'QA', 'qa'),
  ('tag-ops', 'Ops', 'ops'),
  ('tag-onboarding', 'Onboarding', 'onboarding');
