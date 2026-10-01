import type { AuthContext } from "../oauth/flow";
import { fetchSource } from "./source";
import { readImageFile, requireUploadedImages } from "./images";
import type { WikiStore } from "./types";
import { normalizeDriveUrl } from "../../document-drive";
import { requireDocumentEditor } from "./permissions";

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

function documentUrl(baseUrl: string, doc: { slug: string }): string {
  return `${baseUrl.replace(/\/+$/, "")}/documents/${doc.slug}`;
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
    name: "upload_image",
    description: "Save an actual image file to CURI Wiki and attach it to a document. Pass complete original file bytes as data_base64, or a downloadable file_url (the server downloads and stores the file, never hotlinks it). Use the returned markdown_url in the body. For a new article, first create a Draft without images, upload its images, then update and publish. Never invent or abbreviate image bytes; if unavailable, ask for the original file.",
    inputSchema: {
      type: "object",
      properties: {
        document_id_or_slug: { type: "string", description: "Document receiving this attachment." },
        file_name: { type: "string", description: "Original image filename." },
        data_base64: { type: "string", description: "Complete base64 of the original file, without a data: prefix. Do not truncate or generate it." },
        file_url: { type: "string", description: "Downloadable image file URL, used only to copy the real file into wiki storage. Do not pass a web page URL." },
      },
      required: ["document_id_or_slug", "file_name"],
      additionalProperties: false,
    },
    requiredScope: "wiki.write",
    handler: async (args, ctx) => {
      const user = await requireApproved(ctx);
      const doc = await ctx.store.getDocument(String(args.document_id_or_slug));
      if (!doc) throw new ToolError("사진을 첨부할 문서를 찾을 수 없습니다. 먼저 Draft 문서를 만드세요.");
      requireDocumentEditor(user, { owner_id: doc.owner_id, category_id: `cat-${doc.category_slug}` });
      const file = await readImageFile(args);
      const attachment = await ctx.store.uploadImage({ ...file, document_id: doc.id }, user.id);
      return { status: "uploaded", ...attachment, file_name: file.file_name, file_size: file.bytes.byteLength };
    },
  },

  {
    name: "create_document",
    description:
      "Create and publish a document on CURI Wiki as the connected account. For articles with images, create a Draft without images, use upload_image to save the original files, then update_document with the returned markdown_url values. Never embed external, temporary, or data URLs. Set dry_run to preview without writing.",
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
        drive_url: { type: ["string", "null"], description: "Optional Google Drive folder/file or Google Docs HTTPS sharing link, shown below the title." },
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
        ...(args.drive_url !== undefined ? { drive_url: normalizeDriveUrl(args.drive_url) } : {}),
      };
      if (args.dry_run) return { dry_run: true, payload: input };

      const user = await requireApproved(ctx);
      requireUploadedImages(input.content_markdown, ctx.baseUrl);
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
      "Update an existing CURI Wiki document as its owner or an approved admin. Secret documents require an admin. Use when search_documents shows the page already exists.",
    inputSchema: {
      type: "object",
      properties: {
        id_or_slug: { type: "string" },
        title: { type: "string" },
        content_markdown: { type: "string" },
        drive_url: { type: ["string", "null"], description: "Google Drive/Docs sharing link below the title. Omit to keep the current link; null removes it." },
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
      const editableFields = new Set(['title', 'content_markdown', 'drive_url', 'summary', 'category_slug', 'tags', 'status']);
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([key, v]) => editableFields.has(key) && v !== undefined && (v !== null || key === "drive_url")),
      );
      if (patch.drive_url !== undefined) patch.drive_url = normalizeDriveUrl(patch.drive_url);
      if (!Object.keys(patch).length) throw new ToolError("변경할 필드를 하나 이상 지정하세요.");
      const user = await requireApproved(ctx);
      const previous = await ctx.store.getDocument(String(id_or_slug));
      if (!previous) throw new ToolError("수정할 문서를 찾을 수 없습니다.");
      requireDocumentEditor(user,
        { owner_id: previous.owner_id, category_id: `cat-${previous.category_slug}` },
        patch.category_slug === undefined ? undefined : `cat-${patch.category_slug}`,
      );
      if (typeof patch.content_markdown === "string") {
        requireUploadedImages(patch.content_markdown, ctx.baseUrl, previous.content_markdown);
      }
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
