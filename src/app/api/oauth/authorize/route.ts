import { issueAuthorizationCode, validateAuthorizeRequest } from "@/lib/mcp/oauth/flow";
import { OAuthError } from "@/lib/mcp/oauth/types";
import { stores } from "@/lib/mcp/runtime";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Consent form target. Issues the authorization code and redirects to Claude. */
export async function POST(request: Request) {
  const form = await request.formData();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v ? v : undefined;
  };

  const req = {
    client_id: get("client_id") || "",
    redirect_uri: get("redirect_uri") || "",
    scope: get("scope"),
    state: get("state"),
    code_challenge: get("code_challenge"),
    code_challenge_method: get("code_challenge_method"),
    resource: get("resource"),
  };

  // The session is re-checked here: the hidden fields are user-controlled, the
  // identity must never be.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "login_required" }, { status: 401 });

  try {
    const { oauthStore } = await stores();
    const { scope } = await validateAuthorizeRequest(oauthStore, req);

    if (get("decision") !== "allow") {
      const back = new URL(req.redirect_uri);
      back.searchParams.set("error", "access_denied");
      if (req.state) back.searchParams.set("state", req.state);
      return Response.redirect(back.toString(), 303);
    }

    const { redirectTo } = await issueAuthorizationCode(oauthStore, {
      req,
      userId: user.id,
      scope,
    });
    return Response.redirect(redirectTo, 303);
  } catch (err) {
    if (err instanceof OAuthError) {
      return Response.json(err.toResponseBody(), { status: err.status });
    }
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
