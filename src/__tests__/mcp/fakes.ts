import type { AuthCode, OAuthClient, OAuthStore, TokenRecord } from '@/lib/mcp/oauth/types';
import type { CreateDocumentInput, WikiDocument, WikiStore, WikiUser } from '@/lib/mcp/wiki/types';

type MemoryDocRow = {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  summary: string | null;
  content_markdown: string;
  status: string;
  tags: string[];
  source_url: string | null;
  author_id: string;
  updated_at?: string;
};

const CATEGORY_MAP: Record<string, string> = {
  company: 'cat-company',
  product: 'cat-product',
};

const CATEGORY_SLUG_BY_ID = new Map<string, string>(
  Object.entries(CATEGORY_MAP).map(([slug, id]) => [id, slug])
);

export function memoryOAuthStore(): OAuthStore & { tokens: Map<string, TokenRecord> } {
  const clients = new Map<string, OAuthClient>();
  const codes = new Map<string, AuthCode>();
  const tokens = new Map<string, TokenRecord>();

  return {
    tokens,
    async createClient(client) {
      clients.set(client.client_id, client);
    },
    async getClient(id) {
      return clients.get(id) ?? null;
    },
    async saveAuthCode(code) {
      codes.set(code.code_hash, code);
    },
    async consumeAuthCode(hash) {
      const record = codes.get(hash);
      if (!record || record.used) return null;
      record.used = true;
      return { ...record };
    },
    async saveToken(token) {
      tokens.set(token.token_hash, token);
    },
    async getToken(hash) {
      return tokens.get(hash) ?? null;
    },
    async revokeToken(hash) {
      const token = tokens.get(hash);
      if (token) token.revoked = true;
    },
    async revokeTokensForUser(userId, clientId) {
      for (const token of tokens.values()) {
        if (token.user_id === userId && (!clientId || token.client_id === clientId)) {
          token.revoked = true;
        }
      }
    },
  };
}

export function memoryWikiStore(users: WikiUser[]): WikiStore & { docs: WikiDocument[] } {
  const rows: MemoryDocRow[] = [];

  const toDoc = (row: MemoryDocRow): WikiDocument => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category_slug: CATEGORY_SLUG_BY_ID.get(row.category_id) ?? row.category_id,
    summary: row.summary,
    content_markdown: row.content_markdown,
    status: row.status,
    tags: row.tags,
    source_url: row.source_url,
    author_id: row.author_id,
    updated_at: row.updated_at,
  });

  return {
    get docs() {
      return rows.map(toDoc);
    },
    async getUser(id) {
      return users.find((user) => user.id === id) ?? null;
    },
    async listCategories() {
      return [
        { slug: 'company', name: '회사' },
        { slug: 'product', name: '제품' },
      ];
    },
    async searchDocuments({ query, category_slug, limit = 5 }) {
      const categoryId = category_slug ? CATEGORY_MAP[category_slug] : null;
      return rows
        .filter((row) => (!categoryId || row.category_id === categoryId))
        .filter((row) => (!query || row.title.includes(query)))
        .slice(0, limit)
        .map(toDoc);
    },
    async getDocument(idOrSlug) {
      const row = rows.find((doc) => doc.id === idOrSlug || doc.slug === idOrSlug);
      return row ? toDoc(row) : null;
    },
    async createDocument(input: CreateDocumentInput, authorId: string) {
      const categoryId = CATEGORY_MAP[input.category_slug];
      if (!categoryId) {
        throw new Error(`존재하지 않는 카테고리: ${input.category_slug}`);
      }

      const row: MemoryDocRow = {
        id: `doc_${rows.length + 1}`,
        title: input.title,
        slug: input.slug,
        category_id: categoryId,
        summary: input.summary,
        content_markdown: input.content_markdown,
        status: input.status,
        tags: input.tags,
        source_url: input.source_url ?? null,
        author_id: authorId,
      };
      rows.push(row);
      return toDoc(row);
    },
    async updateDocument(idOrSlug, patch, _editorId) {
      const row = rows.find((doc) => doc.id === idOrSlug || doc.slug === idOrSlug);
      if (!row) throw new Error('not found');

      if (patch.category_slug) {
        const categoryId = CATEGORY_MAP[patch.category_slug];
        if (!categoryId) {
          throw new Error(`존재하지 않는 카테고리: ${patch.category_slug}`);
        }
        row.category_id = categoryId;
      }

      if (patch.title !== undefined) row.title = patch.title;
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.summary !== undefined) row.summary = patch.summary;
      if (patch.content_markdown !== undefined) row.content_markdown = patch.content_markdown;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.tags !== undefined) row.tags = patch.tags;
      if (patch.source_url !== undefined) row.source_url = patch.source_url ?? null;
      row.updated_at = new Date().toISOString();

      return toDoc(row);
    },
  };
}
