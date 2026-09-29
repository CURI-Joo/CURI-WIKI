'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { AccessLevel, DocStatus, Document, DocumentAccess } from '@/types';
import { demoDocumentAccess, demoDocuments } from '@/data/demo-data';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/client';
import { normalizeCategoryId, resolveCategoryIdForDatabase } from '@/lib/category-migration';
import { slugify } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { mergeDriveMetadata } from '@/lib/document-drive';

const DOCUMENTS_KEY = 'curi-wiki-documents-v2';
const ACCESS_KEY = 'curi-wiki-document-access-v2';
const STORE_EVENT = 'curi-wiki-document-store-change';

interface DocumentStoreState {
  documents: Document[];
  loading: boolean;
  accessKey: string;
}

interface CreateDocumentInput {
  driveUrl?: string | null;
  title: string;
  summary: string;
  categoryId: string;
  content: string;
  userId: string;
  status?: DocStatus;
}

interface UpdateDocumentInput {
  driveUrl?: string | null;
  title: string;
  summary: string;
  categoryId: string;
  content: string;
  userId: string;
  status?: DocStatus;
}

interface DeleteDocumentInput {
  userId: string;
}

function normalizeDocuments(documents: Document[]) {
  return documents.map((document) => ({
    ...document,
    category_id: normalizeCategoryId(document.category_id),
  }));
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function emitStoreChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(STORE_EVENT));
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCustomDocuments() {
  return readJson<Document[]>(DOCUMENTS_KEY, []);
}

function writeCustomDocuments(documents: Document[]) {
  writeJson(DOCUMENTS_KEY, documents);
}

function getCustomAccess() {
  return readJson<DocumentAccess[]>(ACCESS_KEY, []);
}

function writeCustomAccess(access: DocumentAccess[]) {
  writeJson(ACCESS_KEY, access);
}

function getMergedDocuments() {
  const byId = new Map<string, Document>();

  for (const document of demoDocuments) {
    byId.set(document.id, {
      ...document,
      category_id: normalizeCategoryId(document.category_id),
    });
  }

  for (const document of getCustomDocuments()) {
    byId.set(document.id, {
      ...document,
      category_id: normalizeCategoryId(document.category_id),
    });
  }

  return Array.from(byId.values());
}

function getMergedAccess() {
  const customAccess = getCustomAccess();
  const customDocumentIds = new Set(customAccess.map((access) => access.document_id));

  return [
    ...demoDocumentAccess.filter(
      (access) => !customDocumentIds.has(access.document_id)
    ),
    ...customAccess,
  ];
}

function createLocalUniqueSlug(title: string, documentId?: string) {
  const base = slugify(title) || 'untitled';
  const documents = getMergedDocuments();
  let slug = base;
  let suffix = 2;

  while (
    documents.some(
      (document) => document.slug === slug && document.id !== documentId
    )
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function createRemoteUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  title: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(title) || 'untitled';
  const { data } = await supabase
    .from('documents')
    .select('slug')
    .like('slug', `${base}%`);

  const existingSlugs = new Set((data ?? []).map((d: { slug: string }) => d.slug));

  if (excludeId) {
    const { data: current } = await supabase
      .from('documents')
      .select('slug')
      .eq('id', excludeId)
      .single();
    if (current) existingSlugs.delete(current.slug);
  }

  if (!existingSlugs.has(base)) return base;

  let suffix = 2;
  while (existingSlugs.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

async function resolveRemoteCategoryId(
  supabase: ReturnType<typeof createClient>,
  categoryId: string
) {
  const { data, error } = await supabase
    .from('categories')
    .select('id');

  if (error || !data) {
    return resolveCategoryIdForDatabase(categoryId);
  }

  return resolveCategoryIdForDatabase(
    categoryId,
    data.map((category: { id: string }) => category.id)
  );
}

function buildAccess(documentId: string, userIds: string[], accessLevel: AccessLevel = 'VIEW') {
  return Array.from(new Set(userIds)).map((userId) => ({
    id: `access-${documentId}-${userId}`,
    document_id: documentId,
    user_id: userId,
    access_level: accessLevel,
  }));
}

function replaceDocumentAccess(documentId: string, allowedUserIds: string[]) {
  const nextAccess = [
    ...getCustomAccess().filter((access) => access.document_id !== documentId),
    ...buildAccess(documentId, allowedUserIds),
  ];

  writeCustomAccess(nextAccess);
}

export function getAllDocuments() {
  return isDemoMode() ? getMergedDocuments() : [];
}

export function getAllDocumentAccess() {
  return isDemoMode() ? getMergedAccess() : [];
}

export function getUserAccessibleDocIds(userId: string) {
  return getAllDocumentAccess()
    .filter((access) => access.user_id === userId)
    .map((access) => access.document_id);
}

function createLocalStoredDocument(input: CreateDocumentInput): Document {
  const now = new Date().toISOString();
  const status = input.status ?? 'Published';
  const document: Document = {
    id: createId('doc'),
    title: input.title.trim(),
    slug: createLocalUniqueSlug(input.title),
    summary: input.summary.trim(),
    content_markdown: mergeDriveMetadata(input.content, '', input.driveUrl),
    category_id: normalizeCategoryId(input.categoryId),
    owner_id: input.userId,
    status,
    visibility: 'COMPANY',
    external_status: 'INTERNAL_ONLY',
    created_by: input.userId,
    updated_by: input.userId,
    created_at: now,
    updated_at: now,
    published_at: status === 'Published' ? now : null,
  };

  writeCustomDocuments([...getCustomDocuments(), document]);
  replaceDocumentAccess(document.id, []);
  emitStoreChange();

  return document;
}

function updateLocalStoredDocument(
  documentId: string,
  input: UpdateDocumentInput
): Document {
  const existing = getMergedDocuments().find((document) => document.id === documentId);
  if (!existing) throw new Error('Document not found');
  const status = input.status ?? existing.status;
  const now = new Date().toISOString();

  const updated: Document = {
    ...existing,
    title: input.title.trim(),
    slug: createLocalUniqueSlug(input.title, documentId),
    summary: input.summary.trim(),
    content_markdown: mergeDriveMetadata(input.content, existing.content_markdown, input.driveUrl),
    category_id: normalizeCategoryId(input.categoryId),
    status,
    updated_by: input.userId,
    updated_at: now,
    published_at:
      status === 'Published'
        ? existing.published_at ?? now
        : status === 'Draft'
          ? null
          : existing.published_at,
  };

  writeCustomDocuments([
    ...getCustomDocuments().filter((document) => document.id !== documentId),
    updated,
  ]);
  replaceDocumentAccess(updated.id, []);
  emitStoreChange();

  return updated;
}

function deleteLocalStoredDocument(
  documentId: string,
  _input: DeleteDocumentInput
) {
  const exists = getMergedDocuments().some((document) => document.id === documentId);
  if (!exists) throw new Error('Document not found');

  writeCustomDocuments(
    getCustomDocuments().filter((document) => document.id !== documentId)
  );
  writeCustomAccess(
    getCustomAccess().filter((access) => access.document_id !== documentId)
  );
  emitStoreChange();
}

export async function createStoredDocument(
  input: CreateDocumentInput
): Promise<Document> {
  if (isDemoMode()) return createLocalStoredDocument(input);

  const supabase = createClient();
  const slug = await createRemoteUniqueSlug(supabase, input.title);
  const databaseCategoryId = await resolveRemoteCategoryId(supabase, input.categoryId);
  const status = input.status ?? 'Published';
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title: input.title.trim(),
      slug,
      summary: input.summary.trim(),
      content_markdown: mergeDriveMetadata(input.content, '', input.driveUrl),
      category_id: databaseCategoryId,
      owner_id: input.userId,
      status,
      visibility: 'COMPANY',
      external_status: 'INTERNAL_ONLY',
      created_by: input.userId,
      updated_by: input.userId,
      published_at: status === 'Published' ? now : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Document;
}

export async function updateStoredDocument(
  documentId: string,
  input: UpdateDocumentInput
): Promise<Document> {
  if (isDemoMode()) return updateLocalStoredDocument(documentId, input);

  const supabase = createClient();
  const slug = await createRemoteUniqueSlug(supabase, input.title, documentId);
  const databaseCategoryId = await resolveRemoteCategoryId(supabase, input.categoryId);
  const { data: existing, error: readError } = await supabase
    .from('documents')
    .select('status, published_at, content_markdown')
    .eq('id', documentId)
    .single();
  if (readError || !existing) throw new Error(readError?.message ?? '문서를 찾을 수 없습니다.');
  const status = input.status ?? ((existing as Pick<Document, 'status'> | null)?.status ?? 'Published');
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('documents')
    .update({
      title: input.title.trim(),
      slug,
      summary: input.summary.trim(),
      content_markdown: mergeDriveMetadata(input.content, existing?.content_markdown ?? '', input.driveUrl),
      category_id: databaseCategoryId,
      status,
      updated_by: input.userId,
      updated_at: now,
      published_at:
        status === 'Published'
          ? ((existing as Pick<Document, 'published_at'> | null)?.published_at ?? now)
          : status === 'Draft'
            ? null
            : (existing as Pick<Document, 'published_at'> | null)?.published_at ?? null,
    })
    .eq('id', documentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Document;
}

export async function deleteStoredDocument(
  documentId: string,
  input: DeleteDocumentInput
): Promise<void> {
  if (isDemoMode()) {
    deleteLocalStoredDocument(documentId, input);
    return;
  }

  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? '문서 삭제에 실패했습니다.');
  }
}

export function useDocumentStore() {
  const isDemo = isDemoMode();
  const { session, profile, loading: authLoading } = useAuth();
  const approved = Boolean(session && profile?.status === 'approved');
  const accessKey = isDemo ? 'demo' : `${session?.user.id ?? 'anon'}:${profile?.status ?? ''}:${profile?.role ?? ''}`;
  const requestId = useRef(0);
  const [state, setState] = useState<DocumentStoreState>(() => ({
    documents: isDemo ? getMergedDocuments() : [],
    loading: !isDemo,
    accessKey,
  }));

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (isDemo) {
      emitStoreChange();
      return;
    }

    if (authLoading) return;

    let documents: Document[] = [];
    try {
      const { data, error } = await createClient()
        .from('documents')
        .select('*')
        .order('updated_at', { ascending: false });

      // RLS remains authoritative for approved users, including their drafts.
      if (!error) documents = normalizeDocuments((data ?? []) as Document[]);
    } catch {
      // A failed request must not leave documents from an earlier session visible.
    }

    // During migration rollout, anon RLS may return [] without an error. Only
    // public readers fall back to the API, which explicitly filters public rows.
    if (!approved && documents.length === 0) {
      try {
        const response = await fetch('/api/wiki/public-documents', { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json() as { documents?: Document[] };
          documents = normalizeDocuments((payload.documents ?? []).filter(
            (document) => document.status === 'Published' && document.category_id !== 'cat-secret'
          ));
        }
      } catch {
        // A failed public fallback must leave the list empty.
      }
    }

    if (currentRequest === requestId.current) {
      setState({ documents, loading: false, accessKey });
    }
  }, [isDemo, authLoading, accessKey, approved]);

  useEffect(() => {
    if (!isDemo) {
      void refresh();

      return () => {
        requestId.current += 1;
      };
    }

    const sync = () => setState({ documents: getMergedDocuments(), loading: false, accessKey });
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DOCUMENTS_KEY || event.key === ACCESS_KEY) sync();
    };

    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isDemo, refresh, accessKey]);

  // Hide the previous session's data synchronously, before the effect refetches.
  if (authLoading || state.accessKey !== accessKey) {
    return { documents: [] as Document[], loading: true, refresh };
  }

  return { documents: state.documents, loading: state.loading, refresh };
}
