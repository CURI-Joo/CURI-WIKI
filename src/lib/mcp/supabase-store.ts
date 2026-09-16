import type { AuthCode, OAuthClient, OAuthStore, TokenRecord } from "./oauth/types";
import type {
  CreateDocumentInput,
  WikiCategory,
  WikiDocument,
  WikiStore,
  WikiUser,
} from "./wiki/types";

/**
 * Structural type instead of importing @supabase/supabase-js, so this file
 * compiles on its own. The real `SupabaseClient` satisfies it.
 * Pass a SERVICE ROLE client: these tables are closed to anon/authenticated by RLS.
 */
export interface SupabaseLike {
  from(table: string): any;
  auth: {
    admin: {
      getUserById(id: string): Promise<{ data: { user: any } | null; error: any }>;
    };
  };
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: any }>;
}

const unwrap = <T>(res: { data: T; error: any }, what: string): T => {
  if (res.error) throw new Error(`${what}: ${res.error.message || res.error}`);
  return res.data;
};

export function createSupabaseOAuthStore(db: SupabaseLike): OAuthStore {
  return {
    async createClient(client: OAuthClient) {
      unwrap(await db.from("mcp_oauth_clients").insert(client), "client 등록 실패");
    },

    async getClient(clientId: string) {
      const { data, error } = await db
        .from("mcp_oauth_clients")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(`client 조회 실패: ${error.message}`);
      return (data as OAuthClient) ?? null;
    },

    async saveAuthCode(code: AuthCode) {
      unwrap(await db.from("mcp_auth_codes").insert(code), "authorization code 저장 실패");
    },

    async consumeAuthCode(codeHash: string) {
      // Single-use is enforced in SQL (see consume_mcp_auth_code) so two
      // concurrent exchanges cannot both succeed.
      const { data, error } = await db.rpc("consume_mcp_auth_code", { p_code_hash: codeHash });
      if (error) throw new Error(`authorization code 소비 실패: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      return (row as AuthCode) ?? null;
    },

    async saveToken(token: TokenRecord) {
      unwrap(await db.from("mcp_tokens").insert(token), "토큰 저장 실패");
    },

    async getToken(tokenHash: string) {
      const { data, error } = await db
        .from("mcp_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw new Error(`토큰 조회 실패: ${error.message}`);
      return (data as TokenRecord) ?? null;
    },

    async revokeToken(tokenHash: string) {
      unwrap(
        await db.from("mcp_tokens").update({ revoked: true }).eq("token_hash", tokenHash),
        "토큰 폐기 실패",
      );
    },

    async revokeTokensForUser(userId: string, clientId?: string) {
      let q = db.from("mcp_tokens").update({ revoked: true }).eq("user_id", userId);
      if (clientId) q = q.eq("client_id", clientId);
      unwrap(await q, "토큰 일괄 폐기 실패");
    },
  };
}

export interface WikiSchema {
  documentsTable?: string;
  categoriesTable?: string;
  profilesTable?: string;
}

export function createSupabaseWikiStore(db: SupabaseLike, schema: WikiSchema = {}): WikiStore {
  const documents = schema.documentsTable || "documents";
  const categories = schema.categoriesTable || "categories";
  const profiles = schema.profilesTable || "profiles";

  const toWikiDocument = (row: any, categorySlug: string): WikiDocument => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category_slug: categorySlug,
    summary: row.summary ?? "",
    content_markdown: row.content_markdown ?? "",
    status: row.status ?? "Published",
    tags: Array.isArray(row.tags) ? row.tags : [],
    source_url: row.source_url ?? null,
    author_id: row.author_id ?? row.created_by ?? "",
    updated_at: row.updated_at,
  });

  const listCategoriesRaw = async (): Promise<Array<{ id: string; slug: string; name: string }>> => {
    const { data, error } = await db.from(categories).select("id, slug, name");
    if (error) throw new Error(`카테고리 조회 실패: ${error.message}`);
    return (data as Array<{ id: string; slug: string; name: string }>) || [];
  };

  const getCategoryIdBySlug = async (slug: string): Promise<string> => {
    const { data, error } = await db
      .from(categories)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`카테고리 조회 실패: ${error.message}`);
    if (!data?.id) throw new Error(`존재하지 않는 카테고리: ${slug}`);
    return data.id as string;
  };

  const getCategorySlugMap = async (): Promise<Map<string, string>> => {
    const rows = await listCategoriesRaw();
    return new Map(rows.map((row) => [row.id, row.slug]));
  };

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const isUuid = (value: string): boolean => UUID_RE.test(value);

  return {
    async getUser(userId: string): Promise<WikiUser | null> {
      const { data, error } = await db.auth.admin.getUserById(userId);
      if (error || !data?.user) return null;
      const user = data.user;

      // Approval lives in the app's own profile row, not in auth.users.
      const { data: profile } = await db
        .from(profiles)
        .select("name, status")
        .eq("id", userId)
        .maybeSingle();

      return {
        id: user.id,
        email: user.email ?? null,
        display_name: profile?.name ?? null,
        approved: profile?.status === "approved",
      };
    },

    async listCategories(): Promise<WikiCategory[]> {
      const rows = await listCategoriesRaw();
      return rows
        .map((row) => ({ slug: row.slug, name: row.name }))
        .sort((a, b) => a.slug.localeCompare(b.slug));
    },

    async searchDocuments({ query, category_slug, limit = 5 }) {
      let q = db.from(documents).select("*").limit(limit);
      if (category_slug) {
        const categoryId = await getCategoryIdBySlug(category_slug);
        q = q.eq("category_id", categoryId);
      }
      if (query) q = q.ilike("title", `%${query}%`);
      const { data, error } = await q;
      if (error) throw new Error(`문서 검색 실패: ${error.message}`);

      const slugMap = await getCategorySlugMap();
      return ((data as any[]) || []).map((row) =>
        toWikiDocument(row, slugMap.get(row.category_id) || "")
      );
    },

    async getDocument(idOrSlug: string) {
      const lookupColumn = isUuid(idOrSlug) ? "id" : "slug";
      const selected = await db.from(documents).select("*").eq(lookupColumn, idOrSlug).maybeSingle();
      if (selected.error) throw new Error(`문서 조회 실패: ${selected.error.message}`);

      const row = selected.data as any;

      if (!row) return null;

      const slugMap = await getCategorySlugMap();
      return toWikiDocument(row, slugMap.get(row.category_id) || "");
    },

    async createDocument(input: CreateDocumentInput, authorId: string) {
      const categoryId = await getCategoryIdBySlug(input.category_slug);
      const { data, error } = await db
        .from(documents)
        .insert({
          title: input.title,
          slug: input.slug,
          category_id: categoryId,
          summary: input.summary,
          content_markdown: input.content_markdown,
          status: input.status,
          tags: input.tags,
          source_url: input.source_url ?? null,
          owner_id: authorId,
          created_by: authorId,
          updated_by: authorId,
        })
        .select("*")
        .single();
      if (error) throw new Error(`문서 생성 실패: ${error.message}`);
      return toWikiDocument(data as any, input.category_slug);
    },

    async updateDocument(idOrSlug: string, patch: Partial<CreateDocumentInput>, editorId: string) {
      const updatePayload: Record<string, unknown> = {
        ...patch,
        updated_by: editorId,
        updated_at: new Date().toISOString(),
      };

      if (patch.category_slug) {
        updatePayload.category_id = await getCategoryIdBySlug(patch.category_slug);
        delete updatePayload.category_slug;
      }

      const lookupColumn = isUuid(idOrSlug) ? "id" : "slug";
      const { data, error } = await db
        .from(documents)
        .update(updatePayload)
        .eq(lookupColumn, idOrSlug)
        .select("*")
        .single();
      if (error) throw new Error(`문서 수정 실패: ${error.message}`);
      const slugMap = await getCategorySlugMap();
      return toWikiDocument(data as any, slugMap.get((data as any).category_id) || "");
    },
  };
}
