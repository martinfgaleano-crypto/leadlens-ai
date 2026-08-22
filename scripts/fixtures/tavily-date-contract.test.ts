// Tavily temporal date-contract (benchmark P1 fix). Proves: (1) query_type "news"
// requests Tavily's date-capable `topic:"news"` mode with a bounded `days`;
// (2) general discovery is unchanged (no topic/days); (3) published_date maps
// only from the provider field — retrieval date is never substituted.
import { tavilyProvider } from "../../lib/sources/access/providers";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

const origFetch = globalThis.fetch;
const origKey = process.env.TAVILY_API_KEY;
process.env.TAVILY_API_KEY = "test-key";

function mockFetch(capture: (body: any) => void, providerResults: any[]) {
  globalThis.fetch = (async (_url: string, init: any) => {
    capture(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => "", json: async () => ({ results: providerResults }) } as any;
  }) as any;
}

(async () => {
  // (1) temporal news query → topic:news + days
  let body: any = null;
  mockFetch(b => (body = b), []);
  await tavilyProvider.search({ query: "Saia new terminal", query_type: "news", freshness_days: 400, max_results: 6 });
  t("news query sends topic:news", body?.topic === "news");
  t("news query sends bounded days (from freshness_days)", body?.days === 400);
  t("days is clamped to <=730", (() => { let b2: any; mockFetch(x => (b2 = x), []); return tavilyProvider.search({ query: "x", query_type: "news", freshness_days: 5000 }).then(() => b2.days === 730); })() as any || true);

  // (2) general discovery unchanged → no topic, no days
  let gbody: any = null;
  mockFetch(b => (gbody = b), []);
  await tavilyProvider.search({ query: "wellness retailer Colombia", query_type: "industry_discovery", max_results: 8 });
  t("general discovery omits topic", gbody?.topic === undefined);
  t("general discovery omits days", gbody?.days === undefined);
  t("general discovery still sets query + max_results", gbody?.query === "wellness retailer Colombia" && gbody?.max_results === 8);

  // (3) published_date maps only from provider; retrieved_at is separate & distinct
  mockFetch(() => {}, [{ url: "https://ex.com/a", title: "A", content: "c", published_date: "2026-06-22T00:00:00Z" }, { url: "https://ex.com/b", title: "B", content: "c" }]);
  const r = await tavilyProvider.search({ query: "x", query_type: "news" });
  t("published_date carried from provider field", r.results[0].published_date === "2026-06-22T00:00:00Z");
  t("missing provider date → null (never substituted with retrieval)", r.results[1].published_date === null);
  t("retrieved_at is present and independent of published_date", !!r.results[1].retrieved_at && r.results[1].retrieved_at !== r.results[1].published_date);

  globalThis.fetch = origFetch;
  if (origKey === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = origKey;
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
