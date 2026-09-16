import { hashToken, nowSeconds, randomToken } from "./crypto";
import { DEFAULT_SCOPE, OAuthError, type OAuthClient, type OAuthStore } from "./types";

export interface RegistrationRequest {
  client_name?: string;
  redirect_uris?: unknown;
  scope?: string;
  token_endpoint_auth_method?: string;
  grant_types?: string[];
}

/** Claude registers itself through DCR, so redirect URIs arrive unvetted. */
function validateRedirectUris(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris is required");
  }
  if (input.length > 5) {
    throw new OAuthError("invalid_redirect_uri", "too many redirect_uris");
  }
  return input.map((raw) => {
    if (typeof raw !== "string") {
      throw new OAuthError("invalid_redirect_uri", "redirect_uris must be strings");
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new OAuthError("invalid_redirect_uri", `not a valid URL: ${raw}`);
    }
    const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (url.protocol !== "https:" && !isLoopback) {
      throw new OAuthError("invalid_redirect_uri", "redirect_uris must use https");
    }
    if (url.hash) {
      throw new OAuthError("invalid_redirect_uri", "redirect_uris must not contain a fragment");
    }
    return url.toString();
  });
}

function filterScope(requested: string | undefined): string {
  const allowed = DEFAULT_SCOPE.split(" ");
  if (!requested) return DEFAULT_SCOPE;
  const granted = requested.split(/\s+/).filter((s) => allowed.includes(s));
  return granted.length ? granted.join(" ") : DEFAULT_SCOPE;
}

export async function registerClient(store: OAuthStore, body: RegistrationRequest) {
  const redirect_uris = validateRedirectUris(body.redirect_uris);
  const scope = filterScope(body.scope);
  const isPublic = (body.token_endpoint_auth_method || "none") === "none";

  const client_id = `mcp_${randomToken(12)}`;
  const secret = isPublic ? null : randomToken(24);

  const client: OAuthClient = {
    client_id,
    client_name: String(body.client_name || "Unnamed MCP client").slice(0, 120),
    redirect_uris,
    client_secret_hash: secret ? hashToken(secret) : null,
    scope,
    created_at: new Date().toISOString(),
  };
  await store.createClient(client);

  return {
    client_id,
    ...(secret ? { client_secret: secret } : {}),
    client_id_issued_at: nowSeconds(),
    client_name: client.client_name,
    redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: isPublic ? "none" : "client_secret_post",
    scope,
  };
}
