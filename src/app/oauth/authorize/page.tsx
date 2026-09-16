import { redirect } from "next/navigation";
import { validateAuthorizeRequest } from "@/lib/mcp/oauth/flow";
import { OAuthError } from "@/lib/mcp/oauth/types";
import { stores } from "@/lib/mcp/runtime";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<string, string> = {
  "wiki.read": "위키 문서 읽기",
  "wiki.write": "내 계정으로 문서 작성 및 수정",
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const req = {
    client_id: one(params.client_id),
    redirect_uri: one(params.redirect_uri),
    scope: one(params.scope) || undefined,
    state: one(params.state) || undefined,
    code_challenge: one(params.code_challenge) || undefined,
    code_challenge_method: one(params.code_challenge_method) || undefined,
    resource: one(params.resource) || undefined,
  };

  // Not signed in: send them through the normal wiki login, then back here.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const self = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, one(v)] as [string, string]])),
    );
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${self.toString()}`)}`);
  }

  const { oauthStore } = await stores();
  let client;
  let scope: string;
  try {
    const validated = await validateAuthorizeRequest(oauthStore, req);
    client = validated.client;
    scope = validated.scope;
  } catch (err) {
    const message = err instanceof OAuthError ? err.message : "요청이 올바르지 않습니다.";
    return (
      <main style={{ maxWidth: "28rem", margin: "12vh auto", padding: "0 1.5rem", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: "1.25rem" }}>연결할 수 없습니다</h1>
        <p style={{ color: "#666" }}>{message}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "28rem", margin: "10vh auto", padding: "0 1.5rem", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>{client.client_name} 연결</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        <strong>{user!.email}</strong> 계정으로 CURI Wiki에 접근을 허용합니다.
      </p>

      <ul style={{ paddingLeft: "1.1rem", color: "#333" }}>
        {scope.split(" ").map((s) => (
          <li key={s}>{SCOPE_LABELS[s] || s}</li>
        ))}
      </ul>

      <p style={{ color: "#888", fontSize: "0.875rem" }}>
        허용하면 이후 작성되는 문서의 작성자는 이 계정으로 기록됩니다. 연결은 설정에서 언제든 해제할 수 있습니다.
      </p>

      <form method="POST" action="/api/oauth/authorize" style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
        {Object.entries({ ...req, scope }).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <button name="decision" value="allow" type="submit" style={{ padding: "0.6rem 1.1rem" }}>
          허용
        </button>
        <button name="decision" value="deny" type="submit" style={{ padding: "0.6rem 1.1rem" }}>
          거부
        </button>
      </form>
    </main>
  );
}
