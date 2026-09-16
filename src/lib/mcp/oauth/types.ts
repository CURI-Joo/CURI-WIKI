export const SCOPES = ["wiki.read", "wiki.write"] as const;
export type Scope = (typeof SCOPES)[number];
export const DEFAULT_SCOPE = "wiki.read wiki.write";

export interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  /** Public clients (Claude) use PKCE and have no secret. */
  client_secret_hash: string | null;
  scope: string;
  created_at: string;
}

export interface AuthCode {
  code_hash: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
  code_challenge_method: string;
  resource: string | null;
  expires_at: number;
  used: boolean;
}

export interface TokenRecord {
  token_hash: string;
  kind: "access" | "refresh";
  client_id: string;
  user_id: string;
  scope: string;
  resource: string | null;
  expires_at: number;
  revoked: boolean;
  /** Refresh tokens rotate; the replaced one is revoked and linked forward. */
  parent_hash?: string | null;
}

/** Everything the OAuth layer needs from persistence, so it stays testable. */
export interface OAuthStore {
  createClient(client: OAuthClient): Promise<void>;
  getClient(clientId: string): Promise<OAuthClient | null>;

  saveAuthCode(code: AuthCode): Promise<void>;
  /** Must atomically mark the code used; returns null if missing or already used. */
  consumeAuthCode(codeHash: string): Promise<AuthCode | null>;

  saveToken(token: TokenRecord): Promise<void>;
  getToken(tokenHash: string): Promise<TokenRecord | null>;
  revokeToken(tokenHash: string): Promise<void>;
  revokeTokensForUser(userId: string, clientId?: string): Promise<void>;
}

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "OAuthError";
  }

  toResponseBody() {
    return { error: this.code, error_description: this.message };
  }
}
