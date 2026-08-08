import { loadCliEnv } from "../../lib/discovery/source-intelligence/provider-env";
loadCliEnv(process.cwd());
type H = { provider: string; configured: boolean; runtime_visible: boolean; http_status: number | string; state: string };
const out: H[] = [];
const timeout = (ms: number) => new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms));
const redact = (value: string) => value.replace(/([?&](?:api_key|apiKey|key|token)=)[^&\s]+/gi, "$1[REDACTED]").replace(/((?:authorization|x-api-key)\s*[:=]\s*)[^,\s}]+/gi, "$1[REDACTED]");
async function call(name: string, key: string | undefined, fn: () => Promise<Response>): Promise<H> {
  const configured = Boolean(key);
  if (!configured) return { provider: name, configured, runtime_visible: false, http_status: "n/a", state: "not_configured" };
  try {
    const res = (await Promise.race([fn(), timeout(12000)])) as Response;
    const s = res.status;
    const state = s === 200 || s === 201 ? "configured_operational" : s === 401 || s === 403 ? "configured_auth_failed" : s === 429 ? "configured_quota_exhausted" : `configured_http_${s}`;
    return { provider: name, configured, runtime_visible: true, http_status: s, state };
  } catch (e) { return { provider: name, configured, runtime_visible: true, http_status: redact(String((e as Error).message)), state: "configured_runtime_error" }; }
}
(async () => {
  out.push(await call("tavily", process.env.TAVILY_API_KEY, () => fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: "colombia retail", max_results: 1 }) })));
  out.push(await call("brave", process.env.BRAVE_SEARCH_API_KEY, () => fetch("https://api.search.brave.com/res/v1/web/search?q=colombia+retail&count=1", { headers: { "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? "", "Accept": "application/json" } })));
  out.push(await call("firecrawl", process.env.FIRECRAWL_API_KEY, () => fetch("https://api.firecrawl.dev/v1/scrape", { method: "POST", headers: { "content-type": "application/json", "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}` }, body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }) })));
  out.push(await call("serper", process.env.SERPER_API_KEY, () => fetch("https://google.serper.dev/search", { method: "POST", headers: { "content-type": "application/json", "X-API-KEY": process.env.SERPER_API_KEY ?? "" }, body: JSON.stringify({ q: "colombia retail", num: 1 }) })));
  out.push(await call("exa", process.env.EXA_API_KEY, () => fetch("https://api.exa.ai/search", { method: "POST", headers: { "content-type": "application/json", "x-api-key": process.env.EXA_API_KEY ?? "" }, body: JSON.stringify({ query: "LeadLens diagnostic", type: "fast", category: "company", numResults: 1, contents: { highlights: true } }) })));
  const samParams = new URLSearchParams({ api_key: process.env.DATA_GOV_API_KEY ?? "", ueiSAM: "F5V8F1J4D2K3", includeSections: "entityRegistration" });
  out.push(await call("sam_gov", process.env.DATA_GOV_API_KEY, () => fetch(`https://api.sam.gov/entity-information/v3/entities?${samParams}`, { headers: { Accept: "application/json" } })));
  out.push(await call("sec_edgar", process.env.SEC_EDGAR_CONTACT, () => fetch("https://data.sec.gov/submissions/CIK0000320193.json", { headers: { "User-Agent": `LeadLens research application ${process.env.SEC_EDGAR_CONTACT ?? ""}`, "Accept-Encoding": "gzip, deflate" } })));
  for (const h of out) console.log(`${h.provider}: configured=${h.configured} visible=${h.runtime_visible} status=${h.http_status} -> ${h.state}`);
})();
