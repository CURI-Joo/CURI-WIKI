import { exchangeToken } from "@/lib/mcp/oauth/flow";
import { OAuthError } from "@/lib/mcp/oauth/types";
import { CORS_HEADERS, stores } from "@/lib/mcp/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const body: Record<string, string> = {};
    form.forEach((value, key) => {
      body[key] = String(value);
    });

    // Public clients may also send credentials via HTTP Basic.
    const basic = request.headers.get("authorization")?.match(/^Basic\s+(.+)$/i)?.[1];
    if (basic) {
      const [id, secret] = Buffer.from(basic, "base64").toString("utf8").split(":");
      body.client_id ||= id || "";
      body.client_secret ||= secret || "";
    }

    const { oauthStore } = await stores();
    const tokens = await exchangeToken(oauthStore, body);
    return Response.json(tokens, {
      headers: { "cache-control": "no-store", ...CORS_HEADERS },
    });
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
