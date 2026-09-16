import dns from "node:dns/promises";
import net from "node:net";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", middot: "\u00b7",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m);
}

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() : null;
}

export function htmlToText(html: string): string {
  let body = html;
  const main = body.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (main && main[1].length > 400) body = main[1];

  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(nav|footer|aside|header)\b[\s\S]*?<\/\1>/gi, " ");

  body = body
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => `\n\n${"#".repeat(Number(n))} `)
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|tr|table|ul|ol|blockquote)>/gi, "\n\n")
    .replace(/<td[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(body)
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function extractLinks(html: string, baseUrl: string, limit = 25) {
  const out: { label: string; href: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    let href = m[1];
    try {
      href = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    const label = decodeEntities(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (label) out.push({ label, href });
  }
  return out;
}

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = address.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.replace("::ffff:", ""));
  return false;
}

/**
 * This runs on the wiki's own server, so an attacker-supplied URL could reach
 * internal services. Resolve DNS first and refuse private address space; follow
 * redirects manually so each hop is checked too.
 */
async function assertPublicUrl(url: URL) {
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("http 또는 https URL만 읽을 수 있습니다.");
  }
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!records.length) throw new Error(`호스트를 찾을 수 없습니다: ${url.hostname}`);
  if (records.some((r) => isPrivateAddress(r.address))) {
    throw new Error("내부 네트워크 주소는 읽을 수 없습니다.");
  }
}

export async function fetchSource(rawUrl: string, maxChars = 12000) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`유효한 URL이 아닙니다: ${rawUrl}`);
  }

  let hops = 0;
  let response: Response;
  for (;;) {
    await assertPublicUrl(url);
    response = await fetch(url, {
      redirect: "manual",
      headers: { accept: "text/html,*/*", "user-agent": "curi-wiki-mcp/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (++hops > 5) throw new Error("리다이렉트가 너무 많습니다.");
      url = new URL(location, url);
      continue;
    }
    break;
  }

  if (!response.ok) {
    throw new Error(`소스를 가져오지 못했습니다 (HTTP ${response.status}) - ${url.href}`);
  }
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  if (!/html|xml|text|json/.test(contentType)) {
    return { url: url.href, content_type: contentType, note: "텍스트가 아닌 응답이라 본문을 추출하지 않았습니다." };
  }

  const title =
    pick(raw, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    pick(raw, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    pick(raw, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    pick(raw, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const text = htmlToText(raw);

  return {
    url: url.href,
    title,
    description,
    truncated: text.length > maxChars,
    text: text.slice(0, maxChars),
    links: extractLinks(raw, url.href),
  };
}
