'use client';

import { useEffect, useState } from 'react';
import type { AccessLevel, Document, DocumentAccess } from '@/types';
import { seedDocumentAccess } from '@/data/seed-tags';
import { seedDocuments } from '@/data/seed-documents';
import { slugify } from '@/lib/utils';

const DOCUMENTS_KEY = 'curi-wiki-documents-v1';
const ACCESS_KEY = 'curi-wiki-document-access-v1';
const STORE_EVENT = 'curi-wiki-document-store-change';

interface DocumentStoreState {
  documents: Document[];
  access: DocumentAccess[];
}

interface UpsertDocumentInput {
  title: string;
  summary: string;
  categoryId: string;
  projectId: string;
  status: Document['status'];
  visibility: Document['visibility'];
  externalStatus: Document['external_status'];
  content: string;
  userId: string;
  allowedUserIds: string[];
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

  for (const document of seedDocuments) {
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
    ...seedDocumentAccess.filter(
      (access) => !customDocumentIds.has(access.document_id)
    ),
    ...customAccess,
  ];
}

function createUniqueSlug(title: string, documentId?: string) {
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

export function getDocumentStoreState(): DocumentStoreState {
  return {
    documents: getMergedDocuments(),
    access: getMergedAccess(),
  };
}

export function getAllDocuments() {
  return getMergedDocuments();
}

export function getAllDocumentAccess() {
  return getMergedAccess();
}

export function getDocumentBySlug(slug: string) {
  return getMergedDocuments().find((document) => document.slug === slug) ?? null;
}

export function getAllowedUserIdsForDocument(documentId: string) {
  return getMergedAccess()
    .filter((access) => access.document_id === documentId)
    .map((access) => access.user_id);
}

export function getUserAccessibleDocIds(userId: string) {
  return getMergedAccess()
    .filter((access) => access.user_id === userId)
    .map((access) => access.document_id);
}

export function createStoredDocument(input: UpsertDocumentInput) {
  const now = new Date().toISOString();
  const documentId = createId('doc');
  const document: Document = {
    id: documentId,
    title: input.title.trim(),
    slug: createUniqueSlug(input.title),
    summary: input.summary.trim(),
    content_markdown: input.content,
    category_id: input.categoryId,
    project_id: input.projectId || null,
    owner_id: input.userId,
    status: input.status,
    visibility: input.visibility,
    external_status: input.externalStatus,
    created_by: input.userId,
    updated_by: input.userId,
    created_at: now,
    updated_at: now,
    published_at: input.status === 'Published' ? now : null,
  };

  writeCustomDocuments([...getCustomDocuments(), document]);
  replaceDocumentAccess(
    document.id,
    document.visibility === 'RESTRICTED' ? input.allowedUserIds : []
  );
  emitStoreChange();

  return document;
}

export function updateStoredDocument(
  documentId: string,
  input: UpsertDocumentInput
) {
  const existing = getMergedDocuments().find((document) => document.id === documentId);
  if (!existing) throw new Error('Document not found');

  const updated: Document = {
    ...existing,
    title: input.title.trim(),
    slug: createUniqueSlug(input.title, documentId),
    summary: input.summary.trim(),
    content_markdown: input.content,
    category_id: input.categoryId,
    project_id: input.projectId || null,
    status: input.status,
    visibility: input.visibility,
    external_status: input.externalStatus,
    updated_by: input.userId,
    updated_at: new Date().toISOString(),
    published_at:
      input.status === 'Published'
        ? existing.published_at ?? new Date().toISOString()
        : existing.published_at,
  };

  writeCustomDocuments([
    ...getCustomDocuments().filter((document) => document.id !== documentId),
    updated,
  ]);
  replaceDocumentAccess(
    updated.id,
    updated.visibility === 'RESTRICTED' ? input.allowedUserIds : []
  );
  emitStoreChange();

  return updated;
}

export function useDocumentStore() {
  const [state, setState] = useState<DocumentStoreState>(() =>
    getDocumentStoreState()
  );

  useEffect(() => {
    const sync = () => setState(getDocumentStoreState());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DOCUMENTS_KEY || event.key === ACCESS_KEY) sync();
    };

    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return state;
}
