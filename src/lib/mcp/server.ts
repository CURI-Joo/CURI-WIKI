import { authenticateBearer, type AuthContext } from "./oauth/flow";
import type { OAuthStore } from "./oauth/types";
import { ToolError, runTool, tools } from "./wiki/tools";
import type { WikiStore } from "./wiki/types";

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "curi-wiki", version: "1.0.0" };

export interface McpDeps {
  oauthStore: OAuthStore;
  wikiStore: WikiStore;
  baseUrl: string;
  defaultCategory?: string;
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });

/**
 * RFC 9728 challenge: pointing at the resource metadata is how Claude discovers
 * which authorization server to start the OAuth flow against.
 */
function unauthorized(baseUrl: string) {
  const metadata = `${baseUrl.replace(/\/+$/, "")}/.well-known/oauth-protected-resource`;
  return json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
    {
      status: 401,
      headers: {
        "www-authenticate": `Bearer realm="CURI Wiki", resource_metadata="${metadata}"`,
      },
    },
  );
}

function toolResult(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent:
      value && typeof value === "object" && !Array.isArray(value) ? value : undefined,
  };
}

async function dispatch(msg: JsonRpcMessage, deps: McpDeps, auth: AuthContext) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      return {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "CURI Wiki 문서를 읽고 작성합니다. 순서: whoami → fetch_source → search_documents → create_document. 글은 연결된 계정 명의로 저장됩니다.",
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      };
    case "tools/call": {
      try {
        const value = await runTool(params?.name, params?.arguments || {}, {
          store: deps.wikiStore,
          auth,
          baseUrl: deps.baseUrl,
          defaultCategory: deps.defaultCategory || "company",
        });
        return toolResult(value);
      } catch (err) {
        // Tool failures come back as results, not protocol errors, so the model
        // can read the message and correct course.
        const message = err instanceof ToolError ? err.message : `오류: ${(err as Error).message}`;
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
    default:
      throw Object.assign(new Error(`Method not found: ${method}`), { rpcCode: -32601, id });
  }
}

export async function handleMcpRequest(request: Request, deps: McpDeps): Promise<Response> {
  if (request.method === "GET" || request.method === "DELETE") {
    // Stateless server: no SSE stream and no session to terminate.
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }

  const auth = await authenticateBearer(deps.oauthStore, request.headers.get("authorization"));
  if (!auth) return unauthorized(deps.baseUrl);

  let payload: JsonRpcMessage | JsonRpcMessage[];
  try {
    payload = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const batch = Array.isArray(payload) ? payload : [payload];
  const responses: unknown[] = [];

  for (const msg of batch) {
    const isNotification = msg.id === undefined || msg.id === null;
    try {
      const result = await dispatch(msg, deps, auth);
      if (!isNotification) responses.push({ jsonrpc: "2.0", id: msg.id, result });
    } catch (err: any) {
      if (isNotification) continue; // notifications get no response, per JSON-RPC
      responses.push({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: err?.rpcCode ?? -32603, message: err?.message || "Internal error" },
      });
    }
  }

  // Notification-only payloads (e.g. notifications/initialized) get 202.
  if (!responses.length) return new Response(null, { status: 202 });
  return json(Array.isArray(payload) ? responses : responses[0]);
}
