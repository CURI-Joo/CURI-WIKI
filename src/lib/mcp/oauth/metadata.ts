import { SCOPES } from "./types";

/**
 * RFC 8414 - authorization server metadata. Claude fetches this to discover the
 * authorize/token/register endpoints, so every URL must be absolute and public.
 */
export function authorizationServerMetadata(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    scopes_supported: [...SCOPES],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // OAuth 2.1: PKCE is mandatory and only S256 is accepted.
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    service_documentation: `${base}/docs/mcp`,
  };
}

/**
 * RFC 9728 - protected resource metadata. The 401 challenge from /api/mcp points
 * here, which is how Claude finds the authorization server.
 */
export function protectedResourceMetadata(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "CURI Wiki",
    resource_documentation: `${base}/docs/mcp`,
  };
}
