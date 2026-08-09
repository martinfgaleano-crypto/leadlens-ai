import { loadCliEnv } from "../../lib/discovery/source-intelligence/provider-env";
import { exaProvider } from "../../lib/sources/access/providers";
import { getSecCompanySubmissions, searchSamEntities, type StructuredSourceResponse } from "../../lib/sources/access/us-government-sources";
import { classifyProviderError } from "../../lib/ops/provider-health";
import { getUsage } from "../../lib/ops/usage-ledger";
loadCliEnv(process.cwd());
type H = { provider: string; configured: boolean; runtime_visible: boolean; http_status: number | string; state: string; normalized_results?: number; ledger_recorded?: boolean };
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
function adapterState(ok: boolean, error: string | null): string {
  if (ok) return "configured_operational";
  const state = classifyProviderError(error);
  return state === "invalid" ? "configured_auth_failed" : state === "exhausted" || state === "rate_limited" ? "configured_quota_exhausted" : "configured_provider_error";
}
function lastObserved(provider: string): string | null {
  const usage = getUsage()[provider];
  if (!usage) return null;
  return [usage.last_success, usage.last_failure].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}
async function callExa(): Promise<H> {
  const configured = Boolean(process.env.EXA_API_KEY);
  if (!configured) return { provider: "exa", configured, runtime_visible: false, http_status: "n/a", state: "not_configured", normalized_results: 0, ledger_recorded: false };
  const before = lastObserved("exa");
  const result = await exaProvider.search({ query: "B2B manufacturing companies United States", max_results: 3, query_type: "industry_discovery", search_mode: "standard" });
  return { provider: "exa", configured, runtime_visible: true, http_status: result.ok ? "provider_ok" : "provider_error", state: adapterState(result.ok, result.error), normalized_results: result.results.length, ledger_recorded: lastObserved("exa") !== before };
}
async function callStructured<T>(provider: "sam_gov" | "sec_edgar", configured: boolean, fn: () => Promise<StructuredSourceResponse<T>>): Promise<H> {
  if (!configured) return { provider, configured, runtime_visible: false, http_status: "n/a", state: provider === "sec_edgar" ? "configuration_pending_contact" : "not_configured", normalized_results: 0, ledger_recorded: false };
  const ledgerId = provider === "sam_gov" ? "sam_gov_direct" : "sec_edgar_direct";
  const before = lastObserved(ledgerId);
  const result = await fn();
  return { provider, configured, runtime_visible: true, http_status: result.ok ? "provider_ok" : "provider_error", state: adapterState(result.ok, result.error), normalized_results: result.records.length, ledger_recorded: lastObserved(ledgerId) !== before };
}
(async () => {
  out.push(await call("tavily", process.env.TAVILY_API_KEY, () => fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: "colombia retail", max_results: 1 }) })));
  out.push(await call("brave", process.env.BRAVE_SEARCH_API_KEY, () => fetch("https://api.search.brave.com/res/v1/web/search?q=colombia+retail&count=1", { headers: { "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? "", "Accept": "application/json" } })));
  out.push(await call("firecrawl", process.env.FIRECRAWL_API_KEY, () => fetch("https://api.firecrawl.dev/v1/scrape", { method: "POST", headers: { "content-type": "application/json", "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}` }, body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }) })));
  out.push(await call("serper", process.env.SERPER_API_KEY, () => fetch("https://google.serper.dev/search", { method: "POST", headers: { "content-type": "application/json", "X-API-KEY": process.env.SERPER_API_KEY ?? "" }, body: JSON.stringify({ q: "colombia retail", num: 1 }) })));
  out.push(await callExa());
  // Known public UEI from the official SAM Entity API examples. Do not add a
  // registration-status filter: entity status can change and turn a valid auth
  // probe into a false 404 while the canonical UEI remains resolvable.
  out.push(await callStructured("sam_gov", Boolean(process.env.DATA_GOV_API_KEY), () => searchSamEntities({ uei: "DE95TS6Y5XR6", limit: 3 })));
  out.push(await callStructured("sec_edgar", Boolean(process.env.SEC_EDGAR_CONTACT), () => getSecCompanySubmissions("320193")));
  for (const h of out) console.log(`${h.provider}: configured=${h.configured} visible=${h.runtime_visible} status=${h.http_status} -> ${h.state}${h.normalized_results === undefined ? "" : ` normalized_results=${h.normalized_results} ledger_recorded=${h.ledger_recorded}`}`);
})();
