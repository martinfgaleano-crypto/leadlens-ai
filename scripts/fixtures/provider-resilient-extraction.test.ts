import assert from "node:assert/strict";
import { extractWithFallback } from "../../lib/sources/access/extractors";
import { extractUsefulHtml, retrievePublicPage, validatePublicHttpUrl } from "../../lib/sources/access/safe-page-retrieval";

let passed = 0;
async function test(name: string, fn: () => unknown | Promise<unknown>) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const response = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...init.headers }, ...init });

async function main() {
await test("blocks localhost before network", async () => {
  await assert.rejects(() => validatePublicHttpUrl("http://localhost/admin", publicLookup), /FETCH_BLOCKED/);
});
await test("blocks private literal IP", async () => {
  await assert.rejects(() => validatePublicHttpUrl("http://169.254.169.254/latest/meta-data", publicLookup), /FETCH_BLOCKED/);
});
await test("blocks hostname resolving to private IP", async () => {
  await assert.rejects(() => validatePublicHttpUrl("https://example.com", async () => [{ address: "10.0.0.2", family: 4 }]), /FETCH_BLOCKED/);
});
await test("blocks non-http URL", async () => {
  await assert.rejects(() => validatePublicHttpUrl("file:///etc/passwd", publicLookup), /FETCH_BLOCKED/);
});
await test("extracts useful HTML and removes scripts/navigation", () => {
  const out = extractUsefulHtml(`<html><head><title>Supplier Portal</title><meta property="article:published_time" content="2026-09-01"></head><body><nav>menu</nav><main><h1>Submit your brand</h1><p>External suppliers may submit products for category review and commercial evaluation.</p></main><script>secret()</script></body></html>`);
  assert.equal(out.title, "Supplier Portal"); assert.equal(out.publicationDate, "2026-09-01"); assert.match(out.text, /External suppliers/); assert.doesNotMatch(out.text, /menu|secret/);
});
await test("follows and validates safe redirects", async () => {
  const calls: string[] = [];
  const result = await retrievePublicPage("https://example.com/start", { lookup: publicLookup, fetchImpl: (async (input) => { const url = String(input); calls.push(url); return calls.length === 1 ? new Response(null, { status: 302, headers: { location: "https://www.example.com/final" } }) : response(`<title>Final</title><main>${"Verified supplier submission route. ".repeat(5)}</main>`); }) as typeof fetch });
  assert.equal(result.ok, true); assert.equal(result.provenance.redirects.length, 1); assert.equal(result.provenance.final_url, "https://www.example.com/final");
});
await test("blocks redirect to private address", async () => {
  const result = await retrievePublicPage("https://example.com/start", { lookup: async (hostname) => hostname === "example.com" ? publicLookup() : [{ address: "127.0.0.1", family: 4 }], fetchImpl: (async () => new Response(null, { status: 302, headers: { location: "http://internal.test/private" } })) as typeof fetch });
  assert.equal(result.ok, false); assert.equal(result.failure, "FETCH_BLOCKED");
});
await test("rejects invalid content type", async () => {
  const result = await retrievePublicPage("https://example.com/file.pdf", { lookup: publicLookup, fetchImpl: (async () => new Response("pdf", { status: 200, headers: { "content-type": "application/pdf" } })) as typeof fetch });
  assert.equal(result.ok, false); assert.equal(result.failure, "CONTENT_UNUSABLE");
});
await test("classifies timeout", async () => {
  const result = await retrievePublicPage("https://example.com/slow", { lookup: publicLookup, fetchImpl: (async () => { throw new DOMException("The operation timed out", "TimeoutError"); }) as typeof fetch });
  assert.equal(result.failure, "TIMEOUT");
});
await test("records complete direct provenance", async () => {
  const result = await retrievePublicPage("https://example.com/supplier", { lookup: publicLookup, now: () => new Date("2026-09-30T12:00:00Z"), fetchImpl: (async () => response(`<title>Supplier Access</title><main>${"Official supplier registration and product submission. ".repeat(4)}</main>`)) as typeof fetch });
  assert.equal(result.ok, true); assert.equal(result.provenance.retrieval_method, "direct_http"); assert.equal(result.provenance.http_status, 200); assert.equal(result.provenance.retrieved_at, "2026-09-30T12:00:00.000Z"); assert.match(result.provenance.content_sha256 ?? "", /^[a-f0-9]{64}$/);
});
await test("provider failures fall through to safe direct retrieval", async () => {
  const oldT = process.env.TAVILY_API_KEY; const oldF = process.env.FIRECRAWL_API_KEY;
  delete process.env.TAVILY_API_KEY; delete process.env.FIRECRAWL_API_KEY;
  const result = await extractWithFallback("https://example.com/supplier", { lookup: publicLookup, fetchImpl: (async () => response(`<title>Supplier Access</title><main>${"Official supplier registration and product submission. ".repeat(4)}</main>`)) as typeof fetch });
  if (oldT) process.env.TAVILY_API_KEY = oldT; if (oldF) process.env.FIRECRAWL_API_KEY = oldF;
  assert.equal(result.ok, true); assert.equal(result.extractor, "direct_http"); assert.equal(result.attempts.length, 3); assert.equal(result.fallback_used, true);
});

console.log(`provider-resilient-extraction: ${passed}/11 passed`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
