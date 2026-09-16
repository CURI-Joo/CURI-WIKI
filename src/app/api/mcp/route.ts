import { handleMcpRequest } from "@/lib/mcp/server";
import { CORS_HEADERS, baseUrl, stores } from "@/lib/mcp/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { oauthStore, wikiStore } = await stores();
  return handleMcpRequest(request, {
    oauthStore,
    wikiStore,
    baseUrl: baseUrl(),
    defaultCategory: process.env.CURI_WIKI_DEFAULT_CATEGORY || "company",
  });
}

export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST", ...CORS_HEADERS } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
