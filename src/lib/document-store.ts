'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AccessLevel, Document, DocumentAccess } from '@/types';
import { demoDocumentAccess, demoDocuments } from '@/data/demo-data';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';

const DOCUMENTS_KEY = 'curi-wiki-documents-v2';
const ACCESS_KEY = 'curi-wiki-document-access-v2';
const STORE_EVENT = 'curi-wiki-document-store-change';

interface DocumentStoreState {
  documents: Document[];
  loading: boolean;
}

interface CreateDocumentInput {
  title: string;
  summary: string;
  categoryId: string;
  content: string;
  userId: string;
}

interface UpdateDocumentInput {
  title: string;
  summary: string;
  categoryId: string;
  content: string;
  userId: string;
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
    byId.set(document.id, document);
  }

  for (const document of getCustomDocuments()) {
    byId.set(document.id, document);
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
  const document: Document = {
    id: createId('doc'),
    title: input.title.trim(),
    slug: createLocalUniqueSlug(input.title),
    summary: input.summary.trim(),
    content_markdown: input.content,
    category_id: input.categoryId,
    owner_id: input.userId,
    status: 'Published',
    visibility: 'COMPANY',
    external_status: 'INTERNAL_ONLY',
    created_by: input.userId,
    updated_by: input.userId,
    created_at: now,
    updated_at: now,
    published_at: now,
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

  const updated: Document = {
    ...existing,
    title: input.title.trim(),
    slug: createLocalUniqueSlug(input.title, documentId),
    summary: input.summary.trim(),
    content_markdown: input.content,
    category_id: input.categoryId,
    updated_by: input.userId,
    updated_at: new Date().toISOString(),
  };

  writeCustomDocuments([
    ...getCustomDocuments().filter((document) => document.id !== documentId),
    updated,
  ]);
  replaceDocumentAccess(updated.id, []);
  emitStoreChange();

  return updated;
}

export async function createStoredDocument(
  input: CreateDocumentInput
): Promise<Document> {
  if (isDemoMode()) return createLocalStoredDocument(input);

  const supabase = createClient();
  const slug = await createRemoteUniqueSlug(supabase, input.title);

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title: input.title.trim(),
      slug,
      summary: input.summary.trim(),
      content_markdown: input.content,
      category_id: input.categoryId,
      owner_id: input.userId,
      status: 'Published',
      visibility: 'COMPANY',
      external_status: 'INTERNAL_ONLY',
      created_by: input.userId,
      updated_by: input.userId,
      published_at: new Date().toISOString(),
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

  const { data, error } = await supabase
    .from('documents')
    .update({
      title: input.title.trim(),
      slug,
      summary: input.summary.trim(),
      content_markdown: input.content,
      category_id: input.categoryId,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Document;
}

export function useDocumentStore() {
  const isDemo = isDemoMode();
  const [state, setState] = useState<DocumentStoreState>(() => ({
    documents: isDemo ? getMergedDocuments() : [],
    loading: !isDemo,
  }));

  const refresh = useCallback(async () => {
    if (isDemo) {
      setState({ documents: getMergedDocuments(), loading: false });
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('updated_at', { ascending: false });
    setState({ documents: (data ?? []) as Document[], loading: false });
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo) {
      let cancelled = false;

      async function loadDocuments() {
        const supabase = createClient();
        const { data } = await supabase
          .from('documents')
          .select('*')
          .order('updated_at', { ascending: false });

        if (!cancelled) {
          setState({ documents: (data ?? []) as Document[], loading: false });
        }
      }

      void loadDocuments();

      return () => {
        cancelled = true;
      };
    }

    const sync = () => setState({ documents: getMergedDocuments(), loading: false });
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DOCUMENTS_KEY || event.key === ACCESS_KEY) sync();
    };

    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isDemo]);

  return { ...state, refresh };
}
