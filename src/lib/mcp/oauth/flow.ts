import { hashToken, nowSeconds, randomToken, timingSafeEqual, verifyPkce } from "./crypto";
import { OAuthError, type AuthCode, type OAuthStore, type TokenRecord } from "./types";

export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const CODE_TTL_SECONDS = 60 * 5;

export interface AuthorizeRequest {
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
}

/**
 * Validates an /oauth/authorize request before any UI is shown. Throws when the
 * problem must not be redirected back to the client (unknown client / bad
 * redirect_uri), per OAuth 2.1 §4.1.2.1.
 */
export async function validateAuthorizeRequest(store: OAuthStore, req: AuthorizeRequest) {
  const client = await store.getClient(req.client_id);
  if (!client) throw new OAuthError("invalid_client", "등록되지 않은 client_id 입니다.");

  const matched = client.redirect_uris.some((uri) => timingSafeEqual(uri, req.redirect_uri));
  if (!matched) {
    throw new OAuthError("invalid_request", "redirect_uri 가 등록된 값과 다릅니다.");
  }
  if (!req.code_challenge || req.code_challenge_method !== "S256") {
    throw new OAuthError("invalid_request", "PKCE(S256) code_challenge 가 필요합니다.");
  }

  const allowed = client.scope.split(" ");
  const requested = (req.scope || client.scope).split(/\s+/).filter(Boolean);
  const granted = requested.filter((s) => allowed.includes(s));
  if (!granted.length) throw new OAuthError("invalid_scope", "허용되지 않은 scope 입니다.");

  return { client, scope: granted.join(" ") };
}

/** Called after the signed-in user approves the consent screen. */
export async function issueAuthorizationCode(
  store: OAuthStore,
  params: { req: AuthorizeRequest; userId: string; scope: string },
): Promise<{ code: string; redirectTo: string }> {
  const code = randomToken(24);
  const record: AuthCode = {
    code_hash: hashToken(code),
    client_id: params.req.client_id,
    user_id: params.userId,
    redirect_uri: params.req.redirect_uri,
    scope: params.scope,
    code_challenge: params.req.code_challenge!,
    code_challenge_method: params.req.code_challenge_method!,
    resource: params.req.resource ?? null,
    expires_at: nowSeconds() + CODE_TTL_SECONDS,
    used: false,
  };
  await store.saveAuthCode(record);

  const redirectTo = new URL(params.req.redirect_uri);
  redirectTo.searchParams.set("code", code);
  if (params.req.state) redirectTo.searchParams.set("state", params.req.state);
  return { code, redirectTo: redirectTo.toString() };
}

async function mintTokens(
  store: OAuthStore,
  base: { client_id: string; user_id: string; scope: string; resource: string | null },
) {
  const access = randomToken(32);
  const refresh = randomToken(32);
  const now = nowSeconds();

  const accessRecord: TokenRecord = {
    token_hash: hashToken(access),
    kind: "access",
    expires_at: now + ACCESS_TTL_SECONDS,
    revoked: false,
    ...base,
  };
  const refreshRecord: TokenRecord = {
    token_hash: hashToken(refresh),
    kind: "refresh",
    expires_at: now + REFRESH_TTL_SECONDS,
    revoked: false,
    ...base,
  };
  await store.saveToken(accessRecord);
  await store.saveToken(refreshRecord);

  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    scope: base.scope,
  };
}

async function authenticateClient(
  store: OAuthStore,
  body: Record<string, string>,
) {
  const client = await store.getClient(body.client_id || "");
  if (!client) throw new OAuthError("invalid_client", "unknown client_id", 401);
  if (client.client_secret_hash) {
    const provided = body.client_secret || "";
    if (!provided || !timingSafeEqual(hashToken(provided), client.client_secret_hash)) {
      throw new OAuthError("invalid_client", "client authentication failed", 401);
    }
  }
  return client;
}

export async function exchangeToken(store: OAuthStore, body: Record<string, string>) {
  const grant = body.grant_type;

  if (grant === "authorization_code") {
    const client = await authenticateClient(store, body);
    const record = await store.consumeAuthCode(hashToken(body.code || ""));
    if (!record) throw new OAuthError("invalid_grant", "authorization code가 유효하지 않습니다.");
    if (record.expires_at < nowSeconds()) {
      throw new OAuthError("invalid_grant", "authorization code가 만료되었습니다.");
    }
    if (record.client_id !== client.client_id) {
      // Code issued to a different client: revoke everything it could reach.
      await store.revokeTokensForUser(record.user_id, record.client_id);
      throw new OAuthError("invalid_grant", "client_id가 일치하지 않습니다.");
    }
    if (!timingSafeEqual(record.redirect_uri, body.redirect_uri || "")) {
      throw new OAuthError("invalid_grant", "redirect_uri가 일치하지 않습니다.");
    }
    if (!verifyPkce(body.code_verifier || "", record.code_challenge, record.code_challenge_method)) {
      throw new OAuthError("invalid_grant", "PKCE 검증에 실패했습니다.");
    }
    return mintTokens(store, {
      client_id: record.client_id,
      user_id: record.user_id,
      scope: record.scope,
      resource: record.resource,
    });
  }

  if (grant === "refresh_token") {
    const client = await authenticateClient(store, body);
    const hash = hashToken(body.refresh_token || "");
    const record = await store.getToken(hash);
    if (!record || record.kind !== "refresh" || record.revoked) {
      throw new OAuthError("invalid_grant", "refresh_token이 유효하지 않습니다.");
    }
    if (record.expires_at < nowSeconds()) {
      throw new OAuthError("invalid_grant", "refresh_token이 만료되었습니다.");
    }
    if (record.client_id !== client.client_id) {
      throw new OAuthError("invalid_grant", "client_id가 일치하지 않습니다.");
    }
    // Rotation: the presented refresh token is single-use.
    await store.revokeToken(hash);
    return mintTokens(store, {
      client_id: record.client_id,
      user_id: record.user_id,
      scope: record.scope,
      resource: record.resource,
    });
  }

  throw new OAuthError("unsupported_grant_type", `지원하지 않는 grant_type: ${grant}`);
}

export interface AuthContext {
  userId: string;
  clientId: string;
  scopes: string[];
}

/** Bearer validation for /api/mcp. Returns null when the token is unusable. */
export async function authenticateBearer(
  store: OAuthStore,
  authorizationHeader: string | null,
): Promise<AuthContext | null> {
  const raw = (authorizationHeader || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!raw) return null;
  const record = await store.getToken(hashToken(raw.trim()));
  if (!record || record.kind !== "access" || record.revoked) return null;
  if (record.expires_at < nowSeconds()) return null;
  return {
    userId: record.user_id,
    clientId: record.client_id,
    scopes: record.scope.split(" ").filter(Boolean),
  };
}
