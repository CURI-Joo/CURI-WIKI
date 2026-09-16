import { hashToken } from "@/lib/mcp/oauth/crypto";
import { CORS_HEADERS, stores } from "@/lib/mcp/runtime";

export const dynamic = "force-dynamic";

/** RFC 7009. Always returns 200, even for unknown tokens, per the spec. */
export async function POST(request: Request) {
  const form = await request.formData();
  const token = form.get("token");
  if (typeof token === "string" && token) {
    const { oauthStore } = await stores();
    await oauthStore.revokeToken(hashToken(token)).catch(() => {});
  }
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
