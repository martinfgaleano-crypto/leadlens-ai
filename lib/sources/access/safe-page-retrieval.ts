import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export type RetrievalFailure =
  | "PROVIDER_UNAVAILABLE"
  | "PAYMENT_EXHAUSTED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "FETCH_BLOCKED"
  | "CONTENT_UNUSABLE"
  | "PAGE_NOT_FOUND"
  | "ACCESS_RESTRICTED";

export interface RetrievalProvenance {
  original_url: string;
  final_url: string | null;
  domain: string;
  retrieval_method: "direct_http";
  retrieved_at: string;
  http_status: number | null;
  content_type: string | null;
  extractor: "basic_html" | "plain_text" | "none";
  source_title: string | null;
  publication_date: string | null;
  event_date: string | null;
  content_sha256: string | null;
  redirects: string[];
}

export interface SafePageResult {
  ok: boolean;
  content: string | null;
  error: string | null;
  failure: RetrievalFailure | null;
  latency_ms: number;
  provenance: RetrievalProvenance;
}

export interface SafePageDependencies {
  fetchImpl?: typeof fetch;
  lookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

function isBlockedIp(address: string): boolean {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(value) === 4 ? value : null);
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function validatePublicHttpUrl(raw: string, lookup: SafePageDependencies["lookup"] = async (hostname) => dnsLookup(hostname, { all: true })): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("FETCH_BLOCKED: invalid URL"); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("FETCH_BLOCKED: unsafe URL scheme or credentials");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("FETCH_BLOCKED: local hostname");
  const literal = isIP(host);
  const addresses = literal ? [{ address: host, family: literal }] : await lookup(host);
  if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) throw new Error("FETCH_BLOCKED: private or non-routable address");
  return url;
}

function decodeEntities(value: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, token: string) => {
    if (token[0] === "#") {
      const hex = token[1]?.toLowerCase() === "x";
      const number = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : " ";
    }
    return entities[token.toLowerCase()] ?? " ";
  });
}

export function extractUsefulHtml(html: string): { text: string; title: string | null; publicationDate: string | null } {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim() || null;
  const publicationDate = html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|date)["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? html.match(/<time[^>]+datetime=["']([^"']+)/i)?.[1]
    ?? null;
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|main|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(cleaned).replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, title, publicationDate };
}

function classifyStatus(status: number): RetrievalFailure {
  if (status === 404 || status === 410) return "PAGE_NOT_FOUND";
  if (status === 401 || status === 403 || status === 407 || status === 451) return "ACCESS_RESTRICTED";
  if (status === 402) return "PAYMENT_EXHAUSTED";
  if (status === 429) return "RATE_LIMITED";
  return "PROVIDER_UNAVAILABLE";
}

export async function retrievePublicPage(rawUrl: string, deps: SafePageDependencies = {}): Promise<SafePageResult> {
  const started = performance.now();
  const now = deps.now ?? (() => new Date());
  const provenance: RetrievalProvenance = { original_url: rawUrl, final_url: null, domain: "", retrieval_method: "direct_http", retrieved_at: now().toISOString(), http_status: null, content_type: null, extractor: "none", source_title: null, publication_date: null, event_date: null, content_sha256: null, redirects: [] };
  try {
    let current = await validatePublicHttpUrl(rawUrl, deps.lookup);
    provenance.domain = current.hostname.toLowerCase();
    const fetchImpl = deps.fetchImpl ?? fetch;
    for (let redirects = 0; redirects <= (deps.maxRedirects ?? 4); redirects += 1) {
      const response = await fetchImpl(current, { redirect: "manual", signal: AbortSignal.timeout(deps.timeoutMs ?? 20_000), headers: { "user-agent": "LeadLensEvidenceBot/1.0 (+https://leadlens.ai)", accept: "text/html, text/plain;q=0.9" } });
      provenance.http_status = response.status;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === (deps.maxRedirects ?? 4)) throw new Error("FETCH_BLOCKED: unsafe or excessive redirect");
        current = await validatePublicHttpUrl(new URL(location, current).toString(), deps.lookup);
        provenance.redirects.push(current.toString());
        continue;
      }
      provenance.final_url = current.toString();
      provenance.domain = current.hostname.toLowerCase();
      provenance.content_type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? null;
      if (!response.ok) return { ok: false, content: null, error: `HTTP ${response.status}`, failure: classifyStatus(response.status), latency_ms: Math.round(performance.now() - started), provenance };
      if (!provenance.content_type || !["text/html", "text/plain", "application/xhtml+xml"].includes(provenance.content_type)) return { ok: false, content: null, error: `Unsupported content type: ${provenance.content_type ?? "missing"}`, failure: "CONTENT_UNUSABLE", latency_ms: Math.round(performance.now() - started), provenance };
      const declared = Number(response.headers.get("content-length") ?? 0);
      const maxBytes = deps.maxBytes ?? 2_000_000;
      if (declared > maxBytes) return { ok: false, content: null, error: "Content exceeds size limit", failure: "CONTENT_UNUSABLE", latency_ms: Math.round(performance.now() - started), provenance };
      const body = await response.text();
      if (Buffer.byteLength(body) > maxBytes) return { ok: false, content: null, error: "Content exceeds size limit", failure: "CONTENT_UNUSABLE", latency_ms: Math.round(performance.now() - started), provenance };
      const extracted = provenance.content_type === "text/plain" ? { text: body.trim(), title: null, publicationDate: null } : extractUsefulHtml(body);
      if (extracted.text.length < 80) return { ok: false, content: null, error: "Extracted content too short", failure: "CONTENT_UNUSABLE", latency_ms: Math.round(performance.now() - started), provenance };
      provenance.extractor = provenance.content_type === "text/plain" ? "plain_text" : "basic_html";
      provenance.source_title = extracted.title;
      provenance.publication_date = extracted.publicationDate;
      provenance.content_sha256 = createHash("sha256").update(extracted.text).digest("hex");
      return { ok: true, content: extracted.text, error: null, failure: null, latency_ms: Math.round(performance.now() - started), provenance };
    }
    throw new Error("FETCH_BLOCKED: excessive redirects");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeout = /timeout|aborted/i.test(message) || (error instanceof Error && error.name === "TimeoutError");
    return { ok: false, content: null, error: message.slice(0, 180), failure: timeout ? "TIMEOUT" : message.startsWith("FETCH_BLOCKED") ? "FETCH_BLOCKED" : "PROVIDER_UNAVAILABLE", latency_ms: Math.round(performance.now() - started), provenance };
  }
}
