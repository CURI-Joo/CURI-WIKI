import { protectedResourceMetadata } from "@/lib/mcp/oauth/metadata";
import { CORS_HEADERS, baseUrl } from "@/lib/mcp/runtime";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(protectedResourceMetadata(baseUrl()), { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
