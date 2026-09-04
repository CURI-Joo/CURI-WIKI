import type {
  Repository,
  Document,
  DocumentFilters,
  SearchResult,
} from '@/types';
import { seedProfiles } from './seed-profiles';
import { seedCategories } from './seed-categories';
import { seedTags, seedDocumentTags, seedAuditLogs } from './seed-tags';
import { canReadDocument } from '@/lib/permissions';
import {
  createStoredDocument,
  getAllDocumentAccess,
  getAllDocuments,
  getUserAccessibleDocIds as getStoredUserAccessibleDocIds,
  updateStoredDocument,
} from '@/lib/document-store';
import Fuse from 'fuse.js';

// In-memory mutable copies
const profiles = [...seedProfiles];
const categories = [...seedCategories];
const tags = [...seedTags];
const documentTags = [...seedDocumentTags];
const auditLogs = [...seedAuditLogs];

export const mockRepository: Repository = {
  // Profiles
  async getProfile(id: string) {
    return profiles.find((p) => p.id === id) ?? null;
  },
  async getProfiles() {
    return profiles.filter((p) => p.status === 'active');
  },

  // Projects
  async getProjects() {
    return [];
  },
  async getProject() {
    return null;
  },

  // Documents
  async getDocuments(filters?: DocumentFilters) {
    let result = getAllDocuments();
    if (filters?.category_id) result = result.filter((d) => d.category_id === filters.category_id);
    if (filters?.project_id) result = result.filter((d) => d.project_id === filters.project_id);
    if (filters?.status) result = result.filter((d) => d.status === filters.status);
    if (filters?.visibility) result = result.filter((d) => d.visibility === filters.visibility);
    if (filters?.owner_id) result = result.filter((d) => d.owner_id === filters.owner_id);
    return result;
  },
  async getDocument(slug: string) {
    return getAllDocuments().find((d) => d.slug === slug) ?? null;
  },
  async getDocumentById(id: string) {
    return getAllDocuments().find((d) => d.id === id) ?? null;
  },
  async createDocument(doc) {
    return createStoredDocument({
      title: doc.title,
      summary: doc.summary,
      categoryId: doc.category_id,
      projectId: doc.project_id ?? '',
      status: doc.status,
      visibility: doc.visibility,
      externalStatus: doc.external_status,
      content: doc.content_markdown,
      userId: doc.created_by,
      allowedUserIds: [],
    });
  },
  async updateDocument(id: string, updates: Partial<Document>) {
    const existing = getAllDocuments().find((document) => document.id === id);
    if (!existing) throw new Error('Document not found');

    return updateStoredDocument(id, {
      title: updates.title ?? existing.title,
      summary: updates.summary ?? existing.summary,
      categoryId: updates.category_id ?? existing.category_id,
      projectId: updates.project_id ?? existing.project_id ?? '',
      status: updates.status ?? existing.status,
      visibility: updates.visibility ?? existing.visibility,
      externalStatus: updates.external_status ?? existing.external_status,
      content: updates.content_markdown ?? existing.content_markdown,
      userId: updates.updated_by ?? existing.updated_by,
      allowedUserIds: getAllDocumentAccess()
        .filter((access) => access.document_id === id)
        .map((access) => access.user_id),
    });
  },

  // Categories
  async getCategories() {
    return categories.sort((a, b) => a.sort_order - b.sort_order);
  },

  // Tags
  async getTags() {
    return tags;
  },
  async getDocumentTags(documentId: string) {
    const tagIds = documentTags.filter((dt) => dt.document_id === documentId).map((dt) => dt.tag_id);
    return tags.filter((t) => tagIds.includes(t.id));
  },

  // Access
  async getDocumentAccess(documentId: string) {
    return getAllDocumentAccess().filter((da) => da.document_id === documentId);
  },
  async getUserAccessibleDocIds(userId: string) {
    return getStoredUserAccessibleDocIds(userId);
  },

  // Revisions
  async getDocumentRevisions(documentId: string) {
    void documentId;
    return []; // Demo: no revisions yet
  },

  // Audit
  async getAuditLogs(filters?: { resource_id?: string }) {
    if (filters?.resource_id) {
      return auditLogs.filter((l) => l.resource_id === filters.resource_id);
    }
    return auditLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
  async createAuditLog(log) {
    auditLogs.push({
      ...log,
      id: `audit-${Date.now()}`,
      created_at: new Date().toISOString(),
    });
  },

  // Search — uses Fuse.js in demo mode
  async search(query: string, userId: string) {
    const user = profiles.find((p) => p.id === userId);
    if (!user || user.status !== 'active') return [];

    const accessibleDocIds = getStoredUserAccessibleDocIds(userId);

    const visibleDocs = getAllDocuments().filter((doc) =>
      canReadDocument(user, doc, accessibleDocIds, doc.id)
    );

    const fuse = new Fuse(visibleDocs, {
      keys: ['title', 'summary', 'content_markdown'],
      threshold: 0.4,
      includeMatches: true,
    });

    const docResults = fuse.search(query).map((r): SearchResult => {
      const cat = categories.find((c) => c.id === r.item.category_id);
      return {
        type: 'document',
        id: r.item.id,
        title: r.item.title,
        summary: r.item.summary,
        slug: r.item.slug,
        category: cat?.name,
      };
    });

    return docResults.slice(0, 20);
  },
};
