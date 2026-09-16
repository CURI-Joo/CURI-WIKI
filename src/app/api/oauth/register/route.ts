import { registerClient } from "@/lib/mcp/oauth/register";
import { OAuthError } from "@/lib/mcp/oauth/types";
import { CORS_HEADERS, stores } from "@/lib/mcp/runtime";

export const dynamic = "force-dynamic";

/** RFC 7591 dynamic client registration - this is how Claude registers itself. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { oauthStore } = await stores();
    const registered = await registerClient(oauthStore, body);
    return Response.json(registered, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    if (err instanceof OAuthError) {
      return Response.json(err.toResponseBody(), { status: err.status, headers: CORS_HEADERS });
    }
    return Response.json(
      { error: "server_error", error_description: (err as Error).message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
