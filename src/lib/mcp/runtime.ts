import { createSupabaseOAuthStore, createSupabaseWikiStore, type SupabaseLike } from "./supabase-store";

/**
 * Wiring used by every route handler. Replace `createServiceClient` with the
 * project's own service-role helper if one already exists.
 */
export function baseUrl(): string {
  const explicit = process.env.CURI_WIKI_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export async function createServiceClient(): Promise<SupabaseLike> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
  }
  return createClient(url, key, { auth: { persistSession: false } }) as unknown as SupabaseLike;
}

export async function stores() {
  const db = await createServiceClient();
  return {
    oauthStore: createSupabaseOAuthStore(db),
    wikiStore: createSupabaseWikiStore(db, {
      documentsTable: process.env.CURI_WIKI_DOCUMENTS_TABLE,
      categoriesTable: process.env.CURI_WIKI_CATEGORIES_TABLE,
      profilesTable: process.env.CURI_WIKI_PROFILES_TABLE,
    }),
  };
}

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
} as const;
