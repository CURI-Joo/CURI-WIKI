import type {
  Repository,
  Document,
  DocumentFilters,
  SearchResult,
} from '@/types';
import { demoAuditLogs, demoDocumentTags, demoProfiles, demoTags } from '@/data/demo-data';
import { seedCategories } from '@/data/seed-categories';
import { isDemoMode } from '@/lib/demo-mode';
import { canReadDocument } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/client';

export function getRepository(): Repository {
  if (isDemoMode()) return demoRepository;

  const supabase = createClient();

  return {
    // Profiles
    async getProfile(id: string) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      return data ?? null;
    },
    async getProfiles() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'approved');
      return data ?? [];
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
      let query = supabase.from('documents').select('*');
      if (filters?.category_id) query = query.eq('category_id', filters.category_id);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.visibility) query = query.eq('visibility', filters.visibility);
      if (filters?.owner_id) query = query.eq('owner_id', filters.owner_id);
      const { data } = await query.order('updated_at', { ascending: false });
      return (data ?? []) as Document[];
    },
    async getDocument(slug: string) {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('slug', slug)
        .single();
      return (data as Document) ?? null;
    },
    async getDocumentById(id: string) {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();
      return (data as Document) ?? null;
    },
    async createDocument(doc) {
      const { createStoredDocument } = await import('@/lib/document-store');
      return createStoredDocument({
        title: doc.title,
        summary: doc.summary,
        categoryId: doc.category_id,
        content: doc.content_markdown,
        userId: doc.created_by,
      });
    },
    async updateDocument(id: string, updates: Partial<Document>) {
      const existing = await this.getDocumentById(id);
      if (!existing) throw new Error('Document not found');

      const { updateStoredDocument } = await import('@/lib/document-store');
      return updateStoredDocument(id, {
        title: updates.title ?? existing.title,
        summary: updates.summary ?? existing.summary,
        categoryId: updates.category_id ?? existing.category_id,
        content: updates.content_markdown ?? existing.content_markdown,
        userId: updates.updated_by ?? existing.updated_by,
      });
    },

    // Categories
    async getCategories() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      return data ?? [];
    },

    // Tags
    async getTags() {
      const { data } = await supabase.from('tags').select('*');
      return data ?? [];
    },
    async getDocumentTags(documentId: string) {
      const { data } = await supabase
        .from('document_tags')
        .select('tag_id, tags(*)')
        .eq('document_id', documentId);
      return (data ?? []).map((row: { tags: import('@/types').Tag }) => row.tags).filter(Boolean);
    },

    // Access
    async getDocumentAccess(documentId: string) {
      const { data } = await supabase
        .from('document_access')
        .select('*')
        .eq('document_id', documentId);
      return data ?? [];
    },
    async getUserAccessibleDocIds(userId: string) {
      const { data } = await supabase
        .from('document_access')
        .select('document_id')
        .eq('user_id', userId);
      return (data ?? []).map((row: { document_id: string }) => row.document_id);
    },

    // Revisions
    async getDocumentRevisions() {
      return [];
    },

    // Audit
    async getAuditLogs() {
      return [];
    },
    async createAuditLog() {
      // No-op for now
    },

    // Search
    async search(query: string) {
      if (!query.trim()) return [];

      const { data } = await supabase
        .from('documents')
        .select('id, title, summary, slug, category_id')
        .or(`title.ilike.%${query}%,summary.ilike.%${query}%,content_markdown.ilike.%${query}%`)
        .limit(20);

      const { data: categories } = await supabase
        .from('categories')
        .select('id, name');

      const catMap = new Map<string, string>((categories ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

      return (data ?? []).map((doc: { id: string; title: string; summary: string; slug: string; category_id: string }): SearchResult => ({
        type: 'document',
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        slug: doc.slug,
        category: catMap.get(doc.category_id) ?? undefined,
      }));
    },
  };
}

const auditLogs = [...demoAuditLogs];

const demoRepository: Repository = {
  async getProfile(id: string) {
    return demoProfiles.find((p) => p.id === id) ?? null;
  },
  async getProfiles() {
    return demoProfiles.filter((p) => p.status === 'approved');
  },
  async getProjects() {
    return [];
  },
  async getProject() {
    return null;
  },
  async getDocuments(filters?: DocumentFilters) {
    const { getAllDocuments } = await import('@/lib/document-store');
    let result = getAllDocuments();
    if (filters?.category_id) result = result.filter((d) => d.category_id === filters.category_id);
    if (filters?.status) result = result.filter((d) => d.status === filters.status);
    if (filters?.visibility) result = result.filter((d) => d.visibility === filters.visibility);
    if (filters?.owner_id) result = result.filter((d) => d.owner_id === filters.owner_id);
    return result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },
  async getDocument(slug: string) {
    const { getAllDocuments } = await import('@/lib/document-store');
    return getAllDocuments().find((d) => d.slug === slug) ?? null;
  },
  async getDocumentById(id: string) {
    const { getAllDocuments } = await import('@/lib/document-store');
    return getAllDocuments().find((d) => d.id === id) ?? null;
  },
  async createDocument(doc) {
    const { createStoredDocument } = await import('@/lib/document-store');
    return createStoredDocument({
      title: doc.title,
      summary: doc.summary,
      categoryId: doc.category_id,
      content: doc.content_markdown,
      userId: doc.created_by,
    });
  },
  async updateDocument(id: string, updates: Partial<Document>) {
    const existing = await this.getDocumentById(id);
    if (!existing) throw new Error('Document not found');

    const { updateStoredDocument } = await import('@/lib/document-store');
    return updateStoredDocument(id, {
      title: updates.title ?? existing.title,
      summary: updates.summary ?? existing.summary,
      categoryId: updates.category_id ?? existing.category_id,
      content: updates.content_markdown ?? existing.content_markdown,
      userId: updates.updated_by ?? existing.updated_by,
    });
  },
  async getCategories() {
    return [...seedCategories].sort((a, b) => a.sort_order - b.sort_order);
  },
  async getTags() {
    return demoTags;
  },
  async getDocumentTags(documentId: string) {
    const tagIds = demoDocumentTags
      .filter((dt) => dt.document_id === documentId)
      .map((dt) => dt.tag_id);
    return demoTags.filter((tag) => tagIds.includes(tag.id));
  },
  async getDocumentAccess(documentId: string) {
    const { getAllDocumentAccess } = await import('@/lib/document-store');
    return getAllDocumentAccess().filter((access) => access.document_id === documentId);
  },
  async getUserAccessibleDocIds(userId: string) {
    const { getUserAccessibleDocIds } = await import('@/lib/document-store');
    return getUserAccessibleDocIds(userId);
  },
  async getDocumentRevisions() {
    return [];
  },
  async getAuditLogs(filters?: { resource_id?: string }) {
    if (filters?.resource_id) {
      return auditLogs.filter((log) => log.resource_id === filters.resource_id);
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
  async search(query: string, userId: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const user = demoProfiles.find((p) => p.id === userId);
    if (!user || user.status !== 'approved') return [];

    const { getAllDocuments, getUserAccessibleDocIds } = await import('@/lib/document-store');
    const accessibleDocIds = getUserAccessibleDocIds(userId);
    const visibleDocs = getAllDocuments().filter((doc) =>
      canReadDocument(user, doc, accessibleDocIds, doc.id)
    );

    return visibleDocs
      .filter((doc) =>
        [doc.title, doc.summary, doc.content_markdown]
          .some((value) => value.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 20)
      .map((doc): SearchResult => ({
        type: 'document',
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        slug: doc.slug,
        category: seedCategories.find((category) => category.id === doc.category_id)?.name,
      }));
  },
};
