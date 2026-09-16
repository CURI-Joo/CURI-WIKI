import type { AuthContext } from "../oauth/flow";
import { fetchSource } from "./source";
import type { WikiStore } from "./types";

export interface ToolContext {
  store: WikiStore;
  auth: AuthContext;
  baseUrl: string;
  defaultCategory: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredScope?: string;
  handler(args: Record<string, any>, ctx: ToolContext): Promise<unknown>;
}

export class ToolError extends Error {}

/** Keeps Hangul intact - CURI Wiki slugs are Korean. */
export function slugify(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/["'`~!@#$%^&*()[\]{}<>?/\\|,.:;+=]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function documentUrl(baseUrl: string, doc: { category_slug: string; slug: string }): string {
  return `${baseUrl.replace(/\/+$/, "")}/${doc.category_slug}/${doc.slug}`;
}

async function requireApproved(ctx: ToolContext) {
  const user = await ctx.store.getUser(ctx.auth.userId);
  if (!user) throw new ToolError("연결된 위키 계정을 찾을 수 없습니다.");
  if (!user.approved) {
    throw new ToolError("계정이 아직 승인되지 않아 문서를 작성할 수 없습니다. 관리자 승인 후 다시 시도하세요.");
  }
  return user;
}

function requireScope(ctx: ToolContext, scope: string) {
  if (!ctx.auth.scopes.includes(scope)) {
    throw new ToolError(`이 작업에는 ${scope} 권한이 필요합니다. 커넥터를 다시 연결해 권한을 허용해 주세요.`);
  }
}

export const tools: ToolDefinition[] = [
  {
    name: "whoami",
    description:
      "Show which CURI Wiki account this connection writes as, and whether it is approved to publish.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (_args, ctx) => {
      const user = await ctx.store.getUser(ctx.auth.userId);
      if (!user) throw new ToolError("연결된 위키 계정을 찾을 수 없습니다.");
      return {
        user_id: user.id,
        email: user.email,
        display_name: user.display_name,
        approved: user.approved,
        scopes: ctx.auth.scopes,
      };
    },
  },

  {
    name: "fetch_source",
    description:
      "Fetch a public URL and return its title, description, readable text and links. Use this to read the link the user shared before drafting.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "http(s) URL of the source page." },
        max_chars: { type: "number", description: "Character cap on extracted text (default 12000)." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    handler: async (args) => fetchSource(String(args.url), Number(args.max_chars) || 12000),
  },

  {
    name: "list_categories",
    description: "List CURI Wiki categories with their slugs, to pick a valid category_slug.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    requiredScope: "wiki.read",
    handler: async (_args, ctx) => ({ categories: await ctx.store.listCategories() }),
  },

  {
    name: "search_documents",
    description:
      "Search existing CURI Wiki documents. Use before writing to match the house style and avoid duplicates.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category_slug: { type: "string" },
        limit: { type: "number", description: "Max results (default 5)." },
      },
      additionalProperties: false,
    },
    requiredScope: "wiki.read",
    handler: async (args, ctx) => ({
      results: await ctx.store.searchDocuments({
        query: args.query,
        category_slug: args.category_slug,
        limit: Math.min(Number(args.limit) || 5, 20),
      }),
    }),
  },

  {
    name: "get_document",
    description: "Fetch one CURI Wiki document by id or slug, including its markdown body.",
    inputSchema: {
      type: "object",
      properties: { id_or_slug: { type: "string" } },
      required: ["id_or_slug"],
      additionalProperties: false,
    },
    requiredScope: "wiki.read",
    handler: async (args, ctx) => {
      const doc = await ctx.store.getDocument(String(args.id_or_slug));
      if (!doc) throw new ToolError(`문서를 찾을 수 없습니다: ${args.id_or_slug}`);
      return { document: doc, url: documentUrl(ctx.baseUrl, doc) };
    },
  },

  {
    name: "create_document",
    description:
      "Create and publish a document on CURI Wiki as the connected account. Pass the full Korean markdown body drafted from the source link. Set dry_run to preview the payload without writing.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title (Korean)." },
        content_markdown: { type: "string", description: "Full markdown body." },
        category_slug: { type: "string", description: "Category slug." },
        summary: { type: "string", description: "One or two sentence summary." },
        slug: { type: "string", description: "URL slug; derived from the title when omitted." },
        tags: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["Draft", "Published"] },
        source_url: { type: "string", description: "Original link this was written from." },
        dry_run: { type: "boolean", description: "Return the payload without writing." },
      },
      required: ["title", "content_markdown"],
      additionalProperties: false,
    },
    requiredScope: "wiki.write",
    handler: async (args, ctx) => {
      const input = {
        title: String(args.title),
        slug: String(args.slug || slugify(String(args.title))),
        category_slug: String(args.category_slug || ctx.defaultCategory),
        content_markdown: String(args.content_markdown),
        summary: String(args.summary || ""),
        status: String(args.status || "Published"),
        tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        source_url: args.source_url ? String(args.source_url) : null,
      };
      if (args.dry_run) return { dry_run: true, payload: input };

      const user = await requireApproved(ctx);
      const existing = await ctx.store.getDocument(input.slug);
      if (existing) {
        throw new ToolError(
          `같은 slug의 문서가 이미 있습니다: ${input.slug}. update_document로 수정하거나 다른 slug를 쓰세요.`,
        );
      }
      const doc = await ctx.store.createDocument(input, user.id);
      return { status: "created", document: doc, url: documentUrl(ctx.baseUrl, doc) };
    },
  },

  {
    name: "update_document",
    description:
      "Update an existing CURI Wiki document as the connected account. Use when search_documents shows the page already exists.",
    inputSchema: {
      type: "object",
      properties: {
        id_or_slug: { type: "string" },
        title: { type: "string" },
        content_markdown: { type: "string" },
        summary: { type: "string" },
        category_slug: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["Draft", "Published"] },
      },
      required: ["id_or_slug"],
      additionalProperties: false,
    },
    requiredScope: "wiki.write",
    handler: async (args, ctx) => {
      const { id_or_slug, ...rest } = args;
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined && v !== null),
      );
      if (!Object.keys(patch).length) throw new ToolError("변경할 필드를 하나 이상 지정하세요.");
      const user = await requireApproved(ctx);
      const doc = await ctx.store.updateDocument(String(id_or_slug), patch, user.id);
      return { status: "updated", document: doc, url: documentUrl(ctx.baseUrl, doc) };
    },
  },
];

export const toolMap = new Map(tools.map((t) => [t.name, t]));

export async function runTool(name: string, args: Record<string, any>, ctx: ToolContext) {
  const tool = toolMap.get(name);
  if (!tool) throw new ToolError(`알 수 없는 툴: ${name}`);
  if (tool.requiredScope) requireScope(ctx, tool.requiredScope);
  return tool.handler(args || {}, ctx);
}
