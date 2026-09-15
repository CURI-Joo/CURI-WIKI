import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeCategorySlug, resolveCategoryIdForDatabase } from '@/lib/category-migration';
import { slugify } from '@/lib/utils';
import type { DocStatus } from '@/types';

type CreateWikiDocumentBody = {
  title?: string;
  summary?: string;
  content_markdown?: string;
  category_id?: string;
  category_slug?: string;
  status?: DocStatus;
  tags?: string[];
};

type AuthSupabaseClient = SupabaseClient;

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function toSummary(contentMarkdown: string): string {
  const plainText = contentMarkdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[#>*_~\-\[\]\(\)!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) return '요약 없음';
  return plainText.slice(0, 160);
}

async function getAuthContext(request: NextRequest) {
  const token = getBearerToken(request);

  if (token) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase client environment variables are required.');
    }

    const supabase = createSupabaseClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    return { supabase, user };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

async function createUniqueSlug(supabase: AuthSupabaseClient, title: string) {
  const base = slugify(title) || 'untitled';

  const { data } = await supabase
    .from('documents')
    .select('slug')
    .like('slug', `${base}%`);

  const existingSlugs = new Set((data ?? []).map((row: { slug: string }) => row.slug));
  if (!existingSlugs.has(base)) return base;

  let index = 2;
  while (existingSlugs.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

async function resolveCategoryId(supabase: AuthSupabaseClient, body: CreateWikiDocumentBody) {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, slug');

  const availableCategoryIds = (categories ?? []).map((category: { id: string }) => category.id);

  if (body.category_id) {
    return resolveCategoryIdForDatabase(body.category_id, availableCategoryIds);
  }

  if (body.category_slug) {
    const normalizedSlug = normalizeCategorySlug(body.category_slug);
    const matched = (categories ?? []).find(
      (category: { id: string; slug: string }) => normalizeCategorySlug(category.slug) === normalizedSlug
    );

    if (matched?.id) {
      return resolveCategoryIdForDatabase(matched.id, availableCategoryIds);
    }
  }

  return resolveCategoryIdForDatabase('cat-company', availableCategoryIds);
}

async function attachTags(
  supabase: AuthSupabaseClient,
  documentId: string,
  tagNames: string[]
) {
  const normalized = Array.from(new Set(tagNames.map((tag) => tag.trim()).filter(Boolean)));
  if (normalized.length === 0) return;

  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, slug');

  const byNameOrSlug = new Map<string, string>();
  for (const tag of tags ?? []) {
    const normalizedName = (tag.name as string).toLowerCase();
    const normalizedSlug = (tag.slug as string).toLowerCase();
    byNameOrSlug.set(normalizedName, tag.id as string);
    byNameOrSlug.set(normalizedSlug, tag.id as string);
  }

  const tagIds = normalized
    .map((tag) => byNameOrSlug.get(tag.toLowerCase()))
    .filter((tagId): tagId is string => Boolean(tagId));

  if (tagIds.length === 0) return;

  await supabase
    .from('document_tags')
    .insert(tagIds.map((tagId) => ({ document_id: documentId, tag_id: tagId })));
}

export async function POST(request: NextRequest) {
  let body: CreateWikiDocumentBody;

  try {
    body = (await request.json()) as CreateWikiDocumentBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const title = body.title?.trim();
  const contentMarkdown = body.content_markdown?.trim();

  if (!title || !contentMarkdown) {
    return NextResponse.json(
      { error: 'title and content_markdown are required.' },
      { status: 400 }
    );
  }

  const status: DocStatus = body.status ?? 'Published';
  if (!['Draft', 'Published', 'Archived'].includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const { supabase, user } = await getAuthContext(request);

  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const categoryId = await resolveCategoryId(supabase, body);
  const slug = await createUniqueSlug(supabase, title);
  const now = new Date().toISOString();

  const { data: document, error } = await supabase
    .from('documents')
    .insert({
      title,
      slug,
      summary: body.summary?.trim() || toSummary(contentMarkdown),
      content_markdown: contentMarkdown,
      category_id: categoryId,
      owner_id: user.id,
      status,
      visibility: 'COMPANY',
      external_status: 'INTERNAL_ONLY',
      created_by: user.id,
      updated_by: user.id,
      published_at: status === 'Published' ? now : null,
    })
    .select('id, title, slug, category_id, status, created_by, created_at')
    .single();

  if (error || !document) {
    return NextResponse.json(
      { error: error?.message ?? 'create_failed' },
      { status: 500 }
    );
  }

  if (body.tags?.length) {
    await attachTags(supabase, document.id as string, body.tags);
  }

  return NextResponse.json({
    ok: true,
    document,
    url: `/documents/${document.slug}`,
  });
}
