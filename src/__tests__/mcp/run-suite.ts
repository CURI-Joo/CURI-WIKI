import crypto from "node:crypto";
import { base64url, hashToken, nowSeconds } from "@/lib/mcp/oauth/crypto";
import {
  authenticateBearer,
  exchangeToken,
  issueAuthorizationCode,
  validateAuthorizeRequest,
} from "@/lib/mcp/oauth/flow";
import { registerClient } from "@/lib/mcp/oauth/register";
import {
  authorizationServerMetadata,
  protectedResourceMetadata,
} from "@/lib/mcp/oauth/metadata";
import { OAuthError } from "@/lib/mcp/oauth/types";
import { handleMcpRequest } from "@/lib/mcp/server";
import { memoryOAuthStore, memoryWikiStore } from "@/__tests__/mcp/fakes";

const BASE = "https://curi-wiki-six.vercel.app";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` - ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` - ${detail}` : ""}`);
  }
}

async function expectOAuthError(label: string, fn: () => Promise<unknown>, code?: string) {
  try {
    await fn();
    check(label, false, "did not throw");
  } catch (err) {
    const isOAuth = err instanceof OAuthError;
    check(label, isOAuth && (!code || (err as OAuthError).code === code),
      isOAuth ? (err as OAuthError).code : String(err));
  }
}

function pkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

const mcpCall = async (
  deps: any,
  body: unknown,
  token?: string,
): Promise<{ status: number; headers: Headers; body: any }> => {
  const res = await handleMcpRequest(
    new Request(`${BASE}/api/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    deps,
  );
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
};

const toolText = (body: any) => body?.result?.content?.[0]?.text ?? "";
const toolJson = (body: any) => {
  try {
    return JSON.parse(toolText(body));
  } catch {
    return { _text: toolText(body) };
  }
};

export async function runMcpSuite() {
  console.log("\ndiscovery metadata");
  const asMeta = authorizationServerMetadata(BASE);
  const prMeta = protectedResourceMetadata(BASE);
  check("issuer matches base", asMeta.issuer === BASE);
  check("only S256 advertised", JSON.stringify(asMeta.code_challenge_methods_supported) === '["S256"]');
  check("registration endpoint advertised", asMeta.registration_endpoint === `${BASE}/api/oauth/register`);
  check("resource points at /api/mcp", prMeta.resource === `${BASE}/api/mcp`);
  check("authorization server linked", prMeta.authorization_servers[0] === BASE);

  console.log("\ndynamic client registration");
  const store = memoryOAuthStore();
  const registered = await registerClient(store, {
    client_name: "Claude",
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: "none",
  });
  check("client_id issued", typeof registered.client_id === "string");
  check("public client gets no secret", !("client_secret" in registered));
  check("scope defaults to read+write", registered.scope === "wiki.read wiki.write");

  await expectOAuthError(
    "http redirect_uri rejected",
    () => registerClient(store, { redirect_uris: ["http://evil.example.com/cb"] }),
    "invalid_redirect_uri",
  );
  await expectOAuthError(
    "missing redirect_uris rejected",
    () => registerClient(store, { client_name: "x" }),
    "invalid_redirect_uri",
  );
  const loopback = await registerClient(store, { redirect_uris: ["http://127.0.0.1:8765/callback"] });
  check("loopback redirect allowed", loopback.redirect_uris[0].startsWith("http://127.0.0.1"));

  console.log("\nauthorize request validation");
  const { verifier, challenge } = pkce();
  const authorizeReq = {
    client_id: registered.client_id,
    redirect_uri: REDIRECT,
    scope: "wiki.read wiki.write",
    state: "st-123",
    code_challenge: challenge,
    code_challenge_method: "S256",
  };
  const validated = await validateAuthorizeRequest(store, authorizeReq);
  check("valid request accepted", validated.scope === "wiki.read wiki.write");

  await expectOAuthError(
    "unknown client rejected",
    () => validateAuthorizeRequest(store, { ...authorizeReq, client_id: "nope" }),
    "invalid_client",
  );
  await expectOAuthError(
    "mismatched redirect_uri rejected",
    () => validateAuthorizeRequest(store, { ...authorizeReq, redirect_uri: "https://evil.test/cb" }),
    "invalid_request",
  );
  await expectOAuthError(
    "missing PKCE rejected",
    () => validateAuthorizeRequest(store, { ...authorizeReq, code_challenge: undefined }),
    "invalid_request",
  );
  await expectOAuthError(
    "plain PKCE method rejected",
    () => validateAuthorizeRequest(store, { ...authorizeReq, code_challenge_method: "plain" }),
    "invalid_request",
  );

  console.log("\nconsent and token exchange");
  const USER = "11111111-2222-3333-4444-555555555555";
  const { code, redirectTo } = await issueAuthorizationCode(store, {
    req: authorizeReq,
    userId: USER,
    scope: validated.scope,
  });
  const backUrl = new URL(redirectTo);
  check("redirects back to client", backUrl.origin + backUrl.pathname === REDIRECT);
  check("state echoed", backUrl.searchParams.get("state") === "st-123");
  check("code is not stored in plaintext", store.tokens.size === 0 && code.length > 20);

  await expectOAuthError(
    "wrong code_verifier rejected",
    () =>
      exchangeToken(store, {
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: registered.client_id,
        code_verifier: "wrong-verifier",
      }),
    "invalid_grant",
  );

  // The failed attempt consumed the single-use code, so issue a fresh one.
  const fresh = await issueAuthorizationCode(store, {
    req: authorizeReq,
    userId: USER,
    scope: validated.scope,
  });
  const tokens = await exchangeToken(store, {
    grant_type: "authorization_code",
    code: fresh.code,
    redirect_uri: REDIRECT,
    client_id: registered.client_id,
    code_verifier: verifier,
  });
  check("access token issued", typeof tokens.access_token === "string");
  check("refresh token issued", typeof tokens.refresh_token === "string");
  check("expires_in is one hour", tokens.expires_in === 3600);
  check(
    "tokens stored hashed only",
    [...store.tokens.keys()].every((k) => /^[0-9a-f]{64}$/.test(k)) &&
      !store.tokens.has(tokens.access_token),
  );

  await expectOAuthError(
    "code cannot be reused",
    () =>
      exchangeToken(store, {
        grant_type: "authorization_code",
        code: fresh.code,
        redirect_uri: REDIRECT,
        client_id: registered.client_id,
        code_verifier: verifier,
      }),
    "invalid_grant",
  );

  console.log("\nrefresh rotation");
  const refreshed = await exchangeToken(store, {
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: registered.client_id,
  });
  check("refresh returns new access token", refreshed.access_token !== tokens.access_token);
  check("refresh token rotated", refreshed.refresh_token !== tokens.refresh_token);
  await expectOAuthError(
    "old refresh token revoked",
    () =>
      exchangeToken(store, {
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: registered.client_id,
      }),
    "invalid_grant",
  );

  console.log("\nbearer validation");
  const ctx = await authenticateBearer(store, `Bearer ${refreshed.access_token}`);
  check("bearer resolves to the user", ctx?.userId === USER);
  check("scopes parsed", ctx?.scopes.join(",") === "wiki.read,wiki.write");
  check("garbage bearer rejected", (await authenticateBearer(store, "Bearer nope")) === null);
  check("missing header rejected", (await authenticateBearer(store, null)) === null);
  check(
    "refresh token cannot be used as bearer",
    (await authenticateBearer(store, `Bearer ${refreshed.refresh_token}`)) === null,
  );

  console.log("\nmcp endpoint");
  const wiki = memoryWikiStore([
    { id: USER, email: "minjoo@example.com", display_name: "서민주", approved: true },
    { id: "pending-user", email: "new@example.com", display_name: "신규", approved: false },
  ]);
  const deps = { oauthStore: store, wikiStore: wiki, baseUrl: BASE, defaultCategory: "company" };

  const noAuth = await mcpCall(deps, { jsonrpc: "2.0", id: 1, method: "initialize" });
  check("401 without a token", noAuth.status === 401);
  check(
    "challenge points at resource metadata",
    (noAuth.headers.get("www-authenticate") || "").includes(
      "resource_metadata=\"https://curi-wiki-six.vercel.app/.well-known/oauth-protected-resource\"",
    ),
    noAuth.headers.get("www-authenticate") || "",
  );

  const token = refreshed.access_token;
  const init = await mcpCall(
    deps,
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
    token,
  );
  check("initialize succeeds", init.body.result?.serverInfo?.name === "curi-wiki");
  check("protocol echoed", init.body.result?.protocolVersion === "2025-06-18");

  const notif = await mcpCall(deps, { jsonrpc: "2.0", method: "notifications/initialized" }, token);
  check("notification gets 202 and no body", notif.status === 202 && notif.body === null);

  const listed = await mcpCall(deps, { jsonrpc: "2.0", id: 2, method: "tools/list" }, token);
  const toolNames: string[] = listed.body.result.tools.map((t: any) => t.name);
  check("create_document listed", toolNames.includes("create_document"));
  check("fetch_source listed", toolNames.includes("fetch_source"));
  check("no login tools needed", !toolNames.some((n) => n.includes("login")));

  const who = await mcpCall(
    deps,
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "whoami", arguments: {} } },
    token,
  );
  check("whoami returns the connected account", toolJson(who.body).email === "minjoo@example.com");

  const badMethod = await mcpCall(deps, { jsonrpc: "2.0", id: 4, method: "nope/nope" }, token);
  check("unknown method is -32601", badMethod.body.error?.code === -32601);

  console.log("\ndocument writes");
  const dry = await mcpCall(
    deps,
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "create_document",
        arguments: { title: "행사 부스 운영 가이드", content_markdown: "## 개요", dry_run: true },
      },
    },
    token,
  );
  check("dry run writes nothing", toolJson(dry.body).dry_run === true && wiki.docs.length === 0);
  check("slug keeps hangul", toolJson(dry.body).payload.slug === "행사-부스-운영-가이드");

  const created = await mcpCall(
    deps,
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "create_document",
        arguments: {
          title: "행사 부스 운영 가이드",
          content_markdown: "## 개요\n부스 운영 절차입니다.",
          summary: "부스 운영 요약",
          tags: ["행사", "부스"],
          source_url: "https://example.com/booth",
        },
      },
    },
    token,
  );
  const createdBody = toolJson(created.body);
  check("document created", createdBody.status === "created");
  check("author is the connected user", wiki.docs[0].author_id === USER);
  check("url built from category and slug",
    createdBody.url === `${BASE}/company/행사-부스-운영-가이드`, createdBody.url);

  const dupe = await mcpCall(
    deps,
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "create_document",
        arguments: { title: "행사 부스 운영 가이드", content_markdown: "## 중복" },
      },
    },
    token,
  );
  check("duplicate slug refused", dupe.body.result?.isError === true && wiki.docs.length === 1);
  check("refusal suggests update_document", toolText(dupe.body).includes("update_document"));

  console.log("\nscope and approval enforcement");
  // A read-only token must not be able to write.
  const readOnlyCode = await issueAuthorizationCode(store, {
    req: { ...authorizeReq, scope: "wiki.read" },
    userId: USER,
    scope: "wiki.read",
  });
  const readOnly = await exchangeToken(store, {
    grant_type: "authorization_code",
    code: readOnlyCode.code,
    redirect_uri: REDIRECT,
    client_id: registered.client_id,
    code_verifier: verifier,
  });
  const denied = await mcpCall(
    deps,
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "create_document", arguments: { title: "권한 없음", content_markdown: "x" } },
    },
    readOnly.access_token,
  );
  check("read-only token cannot write", denied.body.result?.isError === true);
  check("scope error names wiki.write", toolText(denied.body).includes("wiki.write"));
  const stillReads = await mcpCall(
    deps,
    { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "list_categories", arguments: {} } },
    readOnly.access_token,
  );
  check("read-only token can still read", toolJson(stillReads.body).categories.length === 2);

  // Unapproved accounts are blocked at write time, not at login time.
  const pendingCode = await issueAuthorizationCode(store, {
    req: authorizeReq,
    userId: "pending-user",
    scope: "wiki.read wiki.write",
  });
  const pending = await exchangeToken(store, {
    grant_type: "authorization_code",
    code: pendingCode.code,
    redirect_uri: REDIRECT,
    client_id: registered.client_id,
    code_verifier: verifier,
  });
  const pendingWrite = await mcpCall(
    deps,
    {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "create_document", arguments: { title: "승인 전", content_markdown: "x" } },
    },
    pending.access_token,
  );
  check("unapproved account cannot publish", pendingWrite.body.result?.isError === true);
  check("message explains approval", toolText(pendingWrite.body).includes("승인"));

  console.log("\nexpiry");
  const record = await store.getToken(hashToken(refreshed.access_token));
  record!.expires_at = nowSeconds() - 10;
  const expired = await mcpCall(deps, { jsonrpc: "2.0", id: 11, method: "tools/list" }, refreshed.access_token);
  check("expired access token gets 401", expired.status === 401);

  return { passed, failures };
}
