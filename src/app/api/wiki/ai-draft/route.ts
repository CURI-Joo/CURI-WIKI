import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { slugify } from '@/lib/utils';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { authenticateWikiActor } from '@/lib/wiki-auth';
import {
  buildWikiDraftMarkdown,
  createDefaultTitle,
  normalizeLines,
  normalizeWikiDraftInput,
  type WikiDraftInput,
} from '@/lib/wiki-ai-draft';

interface CreateWikiDraftRequest {
  title?: string;
  workSummary?: string;
  keyChanges?: string[] | string;
  tests?: string[] | string;
  impact?: string[] | string;
  rollbackPlan?: string;
  followUps?: string[] | string;
  references?: string[] | string;
  categoryId?: string;
  status?: 'Draft' | 'Published';
}

function parseLineInput(value: string[] | string | undefined) {
  if (Array.isArray(value)) return normalizeLines(value, 20);
  if (typeof value === 'string') {
    return normalizeLines(
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      20
    );
  }
  return [];
}

async function createUniqueSlug(
  supabase: any,
  title: string
) {
  const base = slugify(title) || 'untitled';
  const { data } = await supabase
    .from('documents')
    .select('slug')
    .like('slug', `${base}%`);

  const existingSlugs = new Set((data ?? []).map((row: { slug: string }) => row.slug));
  if (!existingSlugs.has(base)) return base;

  let suffix = 2;
  while (existingSlugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function POST(request: NextRequest) {
  let body: CreateWikiDraftRequest;

  try {
    body = (await request.json()) as CreateWikiDraftRequest;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const normalized = normalizeWikiDraftInput({
    title: body.title,
    workSummary: body.workSummary,
    keyChanges: parseLineInput(body.keyChanges),
    tests: parseLineInput(body.tests),
    impact: parseLineInput(body.impact),
    rollbackPlan: body.rollbackPlan,
    followUps: parseLineInput(body.followUps),
    references: parseLineInput(body.references),
    categoryId: body.categoryId,
  } satisfies Partial<WikiDraftInput>);

  if (!normalized.workSummary) {
    return NextResponse.json(
      { error: 'work_summary_required', message: 'workSummary는 필수입니다.' },
      { status: 400 }
    );
  }

  if (isDemoMode()) {
    const title = normalized.title || createDefaultTitle();
    const markdown = buildWikiDraftMarkdown({
      title,
      workSummary: normalized.workSummary,
      keyChanges: normalized.keyChanges,
      tests: normalized.tests,
      impact: normalized.impact,
      rollbackPlan: normalized.rollbackPlan,
      followUps: normalized.followUps,
      references: normalized.references,
      categoryId: normalized.categoryId,
    });

    return NextResponse.json({
      ok: true,
      mode: 'demo',
      title,
      status: 'Draft',
      category_id: normalized.categoryId,
      content_markdown: markdown,
      next_step: '실제 저장 없이 미리보기만 제공합니다.',
    });
  }

  const actor = await authenticateWikiActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (actor.status !== 'approved') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (normalized.categoryId === 'cat-secret' && actor.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden_secret_category' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin() as any;

  const title = normalized.title || createDefaultTitle();
  const slug = await createUniqueSlug(supabase, title);
  const markdown = buildWikiDraftMarkdown({
    title,
    workSummary: normalized.workSummary,
    keyChanges: normalized.keyChanges,
    tests: normalized.tests,
    impact: normalized.impact,
    rollbackPlan: normalized.rollbackPlan,
    followUps: normalized.followUps,
    references: normalized.references,
    categoryId: normalized.categoryId,
  });

  const status = body.status === 'Published' ? 'Published' : 'Draft';
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title,
      slug,
      summary: normalized.workSummary,
      content_markdown: markdown,
      category_id: normalized.categoryId,
      owner_id: actor.userId,
      status,
      visibility: 'COMPANY',
      external_status: 'INTERNAL_ONLY',
      created_by: actor.userId,
      updated_by: actor.userId,
      published_at: status === 'Published' ? now : null,
    })
    .select('id, slug, title, status, category_id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'create_failed', message: error?.message ?? '문서 생성 실패' },
      { status: 500 }
    );
  }

  await supabase
    .from('ai_write_logs')
    .insert({
      actor_id: actor.userId,
      auth_method: actor.authMethod,
      document_id: data.id,
      request_summary: normalized.workSummary,
      metadata: {
        key_changes_count: normalized.keyChanges.length,
        tests_count: normalized.tests.length,
        references_count: normalized.references.length,
        category_id: normalized.categoryId,
        token_id: actor.tokenId ?? null,
      },
    });

  return NextResponse.json({
    ok: true,
    document: data,
    edit_url: `/documents/${data.slug}/edit`,
    view_url: `/documents/${data.slug}`,
  });
}
