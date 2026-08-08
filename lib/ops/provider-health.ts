// ─── Provider health & credits (provider-health-v1) ──────────────────────────
// Central registry + live probes for every external provider LeadLens depends
// on. Rules: never expose secrets; never invent credits — every datum carries
// its kind (confirmed_by_provider / observed_by_leadlens / estimated /
// unavailable). Probes are minimal (no token burn beyond ~1 token for
// Anthropic) and cached; the admin console rate-limits manual tests.

import { getUsage, type ProviderUsage } from "./usage-ledger";

export const PROVIDER_HEALTH_VERSION = "provider-health-v1";

export type ProviderState = "ok" | "degraded" | "exhausted" | "invalid" | "rate_limited" | "missing" | "unknown" | "not_tested";
export type DataKind = "confirmed_by_provider" | "observed_by_leadlens" | "estimated" | "unavailable";

/** Classify a failed search/extraction response into the shared ProviderState,
 *  from the error string a provider adapter returns (no HTTP status in-band).
 *  Lets discovery distinguish quota_exhausted from a plain request_failure so
 *  coverage diagnosis never conflates "provider down" with "no results". */
export function classifyProviderError(error: string | null | undefined): Extract<ProviderState, "exhausted" | "invalid" | "rate_limited" | "unknown"> {
  const e = (error ?? "").toLowerCase();
  if (/not enough credits|quota|exhaust|payment required|\b402\b|\b432\b|insufficient (balance|credit)|usage limit/.test(e)) return "exhausted";
  if (/unauthor|forbidden|invalid (api )?key|auth|\b401\b|\b403\b/.test(e)) return "invalid";
  if (/rate.?limit|too many requests|\b429\b/.test(e)) return "rate_limited";
  return "unknown"; // request_failed / transport / timeout
}

export interface ProviderStatus {
  id: string; name: string; role: string;
  configured: boolean;
  state: ProviderState;
  state_kind: DataKind;
  detail: string | null;             // e.g. "reset 2026-08-01 00:00 UTC" — never a secret
  latency_ms: number | null;
  credits: { value: string | null; kind: DataKind };
  usage: ProviderUsage | null;       // observed_by_leadlens
  fallback: string;                  // what happens if this provider is down
  impact: string;                    // which functions degrade
  probed_at: string | null;
}

interface ProviderDef {
  id: string; name: string; role: string; fallback: string; impact: string;
  envKeys: string[];
  probe: () => Promise<{ state: ProviderState; detail: string | null; latency_ms: number | null; credits?: { value: string; kind: DataKind } }>;
}

const t0 = () => Date.now();
const ms = (s: number) => Date.now() - s;
const redactDiagnostic = (value: string) => value.replace(/([?&](?:api_key|apiKey|key|token)=)[^&\s]+/gi, "$1[REDACTED]").replace(/((?:authorization|x-api-key)\s*[:=]\s*)[^,\s}]+/gi, "$1[REDACTED]");

function key(...names: string[]): string | undefined {
  for (const n of names) if (process.env[n]) return process.env[n];
  return undefined;
}

async function http(url: string, init: RequestInit, timeoutMs = 10_000): Promise<{ status: number; body: string }> {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const body = await r.text();
    return { status: r.status, body: body.slice(0, 500) };
  } finally { clearTimeout(to); }
}

export const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: "exa", name: "Exa", role: "Semantic company discovery / escalation search",
    fallback: "Brave/Tavily and specialized sources continue; semantic long-tail coverage degrades.",
    impact: "No hard failure: fewer incremental company candidates after normal coverage stalls.",
    envKeys: ["EXA_API_KEY"],
    probe: async () => {
      const k=key("EXA_API_KEY"); if(!k)return {state:"missing",detail:null,latency_ms:null};
      const s=t0(); const r=await http("https://api.exa.ai/search",{method:"POST",headers:{"x-api-key":k,"content-type":"application/json"},body:JSON.stringify({query:"LeadLens provider diagnostic",type:"fast",category:"company",numResults:1,contents:{highlights:true}})}); const lat=ms(s);
      if(r.status===200)return {state:"ok",detail:null,latency_ms:lat};
      if(r.status===401||r.status===403)return {state:"invalid",detail:`HTTP ${r.status}`,latency_ms:lat};
      if(r.status===402)return {state:"exhausted",detail:"402 — quota/payment required",latency_ms:lat};
      if(r.status===429)return {state:"rate_limited",detail:"429",latency_ms:lat};
      return {state:"unknown",detail:`HTTP ${r.status}`,latency_ms:lat};
    },
  },
  {
    id: "sam_gov", name: "SAM.gov / Data.gov", role: "USA structured entity and procurement evidence",
    fallback: "USA foundation/state/SEC/industry sources plus web search continue.",
    impact: "Government registration and contractor context unavailable; never blocks general Discovery.",
    envKeys: ["DATA_GOV_API_KEY"],
    probe: async () => {
      const k=key("DATA_GOV_API_KEY"); if(!k)return {state:"missing",detail:null,latency_ms:null};
      const s=t0(), params=new URLSearchParams({api_key:k,ueiSAM:"F5V8F1J4D2K3",includeSections:"entityRegistration"});
      const r=await http(`https://api.sam.gov/entity-information/v3/entities?${params}`,{headers:{Accept:"application/json"}}); const lat=ms(s);
      if(r.status===200)return {state:"ok",detail:null,latency_ms:lat};
      if(r.status===401||r.status===403)return {state:"invalid",detail:`HTTP ${r.status}`,latency_ms:lat};
      if(r.status===429)return {state:"rate_limited",detail:"429",latency_ms:lat};
      return {state:"unknown",detail:`HTTP ${r.status}`,latency_ms:lat};
    },
  },
  {
    id: "sec_edgar", name: "SEC EDGAR", role: "Public-company identity, filings and signal evidence",
    fallback: "Company websites and search providers supply evidence; private-company discovery unaffected.",
    impact: "SEC filing evidence unavailable; not treated as universal USA coverage.",
    envKeys: ["SEC_EDGAR_CONTACT"],
    probe: async () => {
      const contact=key("SEC_EDGAR_CONTACT"); if(!contact)return {state:"missing",detail:"SEC_EDGAR_CONTACT required for fair-access User-Agent",latency_ms:null};
      const s=t0(), r=await http("https://data.sec.gov/submissions/CIK0000320193.json",{headers:{"User-Agent":`LeadLens research application ${contact}`,"Accept-Encoding":"gzip, deflate",Accept:"application/json"}}); const lat=ms(s);
      if(r.status===200)return {state:"ok",detail:"No API key required",latency_ms:lat};
      if(r.status===403||r.status===429)return {state:"rate_limited",detail:`HTTP ${r.status}`,latency_ms:lat};
      return {state:"unknown",detail:`HTTP ${r.status}`,latency_ms:lat};
    },
  },
  {
    id: "anthropic", name: "Anthropic (Claude)", role: "Needs-map, extracción de universo, agentes de reporte",
    fallback: "Vertical packs → needs-map y seed universe determinísticos; reportes E2E NO disponibles (fail-closed).",
    impact: "Sin Claude: discovery corre en modo degradado (packs); Preview/Brief E2E bloqueados; Premium no ejecutable.",
    envKeys: ["ANTHROPIC_API_KEY"],
    probe: async () => {
      const k = key("ANTHROPIC_API_KEY"); if (!k) return { state: "missing", detail: null, latency_ms: null };
      const s = t0();
      const r = await http("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "." }] }) });
      const lat = ms(s);
      if (r.status === 200) return { state: "ok", detail: null, latency_ms: lat };
      if (r.status === 401) return { state: "invalid", detail: "credencial rechazada", latency_ms: lat };
      if (r.status === 429) return { state: "rate_limited", detail: "429 rate limit", latency_ms: lat };
      if (/usage limits/i.test(r.body)) {
        const m = r.body.match(/regain access on ([0-9-]+ at [0-9:]+ UTC|[0-9-]+T[0-9:]+Z?)/i);
        return { state: "exhausted", detail: m ? `límite alcanzado — reset ${m[1]}` : "límite de uso alcanzado", latency_ms: lat };
      }
      return { state: "unknown", detail: `HTTP ${r.status}`, latency_ms: lat };
    },
  },
  {
    id: "brave", name: "Brave Search", role: "Búsqueda de señales + resolución de dominio (1 de 3)",
    fallback: "Serper + Tavily cubren búsqueda e identidad (ya en paralelo).",
    impact: "Menor cobertura de resultados; sin impacto fail-closed (fallback activo).",
    envKeys: ["BRAVE_SEARCH_API_KEY", "BRAVE_API_KEY"],
    probe: async () => {
      const k = key("BRAVE_SEARCH_API_KEY", "BRAVE_API_KEY"); if (!k) return { state: "missing", detail: null, latency_ms: null };
      const s = t0();
      const r = await http("https://api.search.brave.com/res/v1/web/search?q=ping&count=1", { headers: { "X-Subscription-Token": k, Accept: "application/json" } });
      const lat = ms(s);
      if (r.status === 200) return { state: "ok", detail: null, latency_ms: lat };
      if (r.status === 402) return { state: "exhausted", detail: "402 — plan sin crédito/pago requerido", latency_ms: lat };
      if (r.status === 401 || r.status === 403) return { state: "invalid", detail: `HTTP ${r.status}`, latency_ms: lat };
      if (r.status === 429) return { state: "rate_limited", detail: "429", latency_ms: lat };
      return { state: "unknown", detail: `HTTP ${r.status}`, latency_ms: lat };
    },
  },
  {
    id: "serper", name: "Serper (Google)", role: "Búsqueda de señales + identidad (2 de 3)",
    fallback: "Vertical Packs + targeted corporate research + reused verified evidence.",
    impact: "Menor cobertura de mercado — NO bloqueo total (modos targeted/provider_limited operan sin search).",
    envKeys: ["SERPER_API_KEY"],
    probe: async () => {
      const k = key("SERPER_API_KEY"); if (!k) return { state: "missing", detail: null, latency_ms: null };
      const s = t0();
      const r = await http("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": k, "Content-Type": "application/json" }, body: JSON.stringify({ q: "ping", num: 1 }) });
      const lat = ms(s);
      if (r.status === 200) return { state: "ok", detail: null, latency_ms: lat };
      if (r.status === 400 && /not enough credits/i.test(r.body)) return { state: "exhausted", detail: "sin créditos (Serper)", latency_ms: lat };
      if (r.status === 401 || r.status === 403) return { state: "invalid", detail: `HTTP ${r.status}`, latency_ms: lat };
      if (r.status === 429) return { state: "rate_limited", detail: "429", latency_ms: lat };
      return { state: "unknown", detail: `HTTP ${r.status}`, latency_ms: lat };
    },
  },
  {
    id: "tavily", name: "Tavily", role: "Búsqueda (3 de 3) + extracción primaria — clave para prensa CO",
    fallback: "Firecrawl para extracción; Brave/Serper para búsqueda.",
    impact: "Pierde la mejor fuente de prensa colombiana; recall de eventos reales baja fuerte.",
    envKeys: ["TAVILY_API_KEY"],
    probe: async () => {
      const k = key("TAVILY_API_KEY"); if (!k) return { state: "missing", detail: null, latency_ms: null };
      const s = t0();
      const r = await http("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: k, query: "ping", max_results: 1 }) });
      const lat = ms(s);
      if (r.status === 200) return { state: "ok", detail: null, latency_ms: lat };
      if (r.status === 401 || r.status === 403) return { state: "invalid", detail: `HTTP ${r.status}`, latency_ms: lat };
      if (r.status === 432) return { state: "exhausted", detail: "432 — límite del plan Tavily alcanzado", latency_ms: lat };
      if (r.status === 429) return { state: "rate_limited", detail: "429", latency_ms: lat };
      return { state: "unknown", detail: `HTTP ${r.status}`, latency_ms: lat };
    },
  },
  {
    id: "firecrawl", name: "Firecrawl", role: "Extracción de páginas (fallback de Tavily)",
    fallback: "Solo Tavily extract; páginas anti-bot se pierden.",
    impact: "Menos extracciones exitosas.",
    envKeys: ["FIRECRAWL_API_KEY"],
    probe: async () => {
      const k = key("FIRECRAWL_API_KEY"); if (!k) return { state: "missing", detail: null, latency_ms: null };
      const s = t0();
      // Credit endpoint: real balance, no scrape cost.
      const r = await http("https://api.firecrawl.dev/v1/team/credit-usage", { headers: { Authorization: `Bearer ${k}` } });
      const lat = ms(s);
      if (r.status === 200) {
        const m = r.body.match(/"remaining_credits"\s*:\s*(\d+)/) ?? r.body.match(/"remainingCredits"\s*:\s*(\d+)/);
        return { state: "ok", detail: null, latency_ms: lat, credits: m ? { value: `${m[1]} créditos`, kind: "confirmed_by_provider" as DataKind } : undefined };
      }
      if (r.status === 401 || r.status === 403) return { state: "invalid", detail: `HTTP ${r.status}`, latency_ms: lat };
      if (r.status === 402) return { state: "exhausted", detail: "402 — sin créditos", latency_ms: lat };
      return { state: "unknown", detail: `HTTP ${r.status}`, latency_ms: lat };
    },
  },
  {
    id: "supabase", name: "Supabase", role: "Base de datos, auth, RLS, storage",
    fallback: "Ninguno — proveedor crítico sin fallback.",
    impact: "Sin Supabase: la plataforma no opera (fail-closed total).",
    envKeys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    probe: async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL; if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { state: "missing", detail: null, latency_ms: null };
      const s = t0();
      const r = await http(`${url}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
      const lat = ms(s);
      if (r.status === 200) return { state: "ok", detail: null, latency_ms: lat };
      return { state: "unknown", detail: `HTTP ${r.status}`, latency_ms: lat };
    },
  },
  {
    id: "lemonsqueezy", name: "Lemon Squeezy", role: "Pagos (INACTIVO por diseño en esta fase)",
    fallback: "N/A — pagos no conectados.",
    impact: "Ninguno hoy: checkout deshabilitado intencionalmente.",
    envKeys: ["LEMON_SQUEEZY_API_KEY", "LEMONSQUEEZY_API_KEY"],
    probe: async () => {
      const k = key("LEMON_SQUEEZY_API_KEY", "LEMONSQUEEZY_API_KEY");
      return k ? { state: "not_tested", detail: "configurado; no se prueba (inactivo)", latency_ms: null } : { state: "missing", detail: "no configurado (esperado: pagos inactivos)", latency_ms: null };
    },
  },
];

// 5-minute probe cache so the console never hammers providers.
const cache = new Map<string, { at: number; st: ProviderStatus }>();
const CACHE_MS = 5 * 60 * 1000;

export async function probeAll(force = false): Promise<ProviderStatus[]> {
  const usage = getUsage();
  const out: ProviderStatus[] = [];
  for (const def of PROVIDER_DEFS) {
    const cached = cache.get(def.id);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) { out.push({ ...cached.st, usage: usage[def.id] ?? null }); continue; }
    const configured = def.envKeys.some((k) => !!process.env[k]);
    let st: ProviderStatus;
    try {
      const p = await def.probe();
      st = {
        id: def.id, name: def.name, role: def.role, configured,
        state: p.state, state_kind: "confirmed_by_provider",
        detail: p.detail, latency_ms: p.latency_ms,
        credits: p.credits ?? { value: null, kind: "unavailable" },
        usage: usage[def.id] ?? null, fallback: def.fallback, impact: def.impact,
        probed_at: new Date().toISOString(),
      };
    } catch (e) {
      st = { id: def.id, name: def.name, role: def.role, configured, state: "unknown", state_kind: "observed_by_leadlens", detail: e instanceof Error ? redactDiagnostic(e.message).slice(0, 120) : "probe failed", latency_ms: null, credits: { value: null, kind: "unavailable" }, usage: usage[def.id] ?? null, fallback: def.fallback, impact: def.impact, probed_at: new Date().toISOString() };
    }
    cache.set(def.id, { at: Date.now(), st });
    out.push(st);
  }
  return out;
}

/** Which providers each run type REQUIRES vs degrades without. */
export const RUN_REQUIREMENTS: Record<string, { requires: string[]; degraded_without: string[]; note: string }> = {
  preview_or_brief_report: { requires: ["anthropic", "supabase"], degraded_without: ["brave", "serper", "tavily"], note: "Sin Anthropic los reportes NO corren (fail-closed). Sin search: discovery en modo packs (cobertura mínima)." },
  discovery_benchmark: { requires: ["supabase"], degraded_without: ["anthropic", "brave", "serper", "tavily", "firecrawl"], note: "Corre degradado con packs, pero sin search providers el recall es ~0: presupuestar Serper/Tavily antes." },
  provider_limited_validation: { requires: ["firecrawl"], degraded_without: [], note: "Valida el pipeline profundo con URLs conocidas/newsrooms — sin search ni LLM." },
};

export const DISCOVERY_PROVIDER_ROUTES = {
  CO: { base: ["specialized_local_sources", "brave", "tavily"], escalation: ["exa"], extraction: ["firecrawl"] },
  US: { base: ["foundation_state_sources", "sam_gov", "sec_edgar", "industry_sources", "brave", "tavily"], escalation: ["exa"], extraction: ["firecrawl"] },
} as const;

/** Recommended action per state — shown in the console. */
export function recommendedAction(s: ProviderStatus): string | null {
  if (s.id === "anthropic" && s.state === "exhausted") return "Es un LÍMITE DE USO configurado (no falta de saldo): súbelo en console.anthropic.com → Settings → Limits, o espera el reset.";
  if (s.id === "serper" && s.state === "exhausted") return "Optional — do not recharge until search-provider ROI is validated. Coste mínimo conocido: $50 (dato manual 2026-07-22, no consultado por API).";
  if (s.id === "tavily" && s.state === "exhausted") return "Límite del plan: subir plan o esperar ciclo en app.tavily.com.";
  if (s.id === "brave" && s.state === "exhausted") return "Plan sin pago: activar suscripción en api.search.brave.com (opcional — Serper+Tavily cubren).";
  if (s.state === "invalid") return "Revisar/rotar la credencial en .env.local.";
  return null;
}

/** Search-coverage readiness: how many of the 3 web-search providers are
 *  actually HEALTHY right now (not merely configured). Used to decide whether a
 *  pilot run would reach full_discovery or waste LLM spend in provider_limited.
 *  Reuses the cached probe sweep (no extra calls within the 5-min window). */
export async function searchCoverageReadiness(force = false): Promise<{
  healthy_search: string[]; exhausted_search: string[]; sufficient: boolean; detail: string;
}> {
  const statuses = await probeAll(force);
  const search = statuses.filter((s) => ["brave", "serper", "tavily"].includes(s.id));
  const healthy = search.filter((s) => s.state === "ok").map((s) => s.id);
  const exhausted = search.filter((s) => s.state === "exhausted" || s.state === "rate_limited" || s.state === "invalid").map((s) => s.id);
  const sufficient = healthy.length >= 2; // matches full_discovery threshold
  return {
    healthy_search: healthy, exhausted_search: exhausted, sufficient,
    detail: sufficient
      ? `Cobertura de búsqueda suficiente: ${healthy.join("/")} saludables.`
      : `Cobertura insuficiente para full_discovery: ${healthy.length} saludable(s) [${healthy.join("/") || "ninguno"}], agotados: ${exhausted.join("/") || "ninguno"}. Se requieren ≥2.`,
  };
}

/** Alert derivation — pure, testable. */
export function deriveAlerts(statuses: ProviderStatus[]): Array<{ level: "red" | "yellow"; provider: string; message: string }> {
  const alerts: Array<{ level: "red" | "yellow"; provider: string; message: string }> = [];
  for (const s of statuses) {
    if (s.id === "lemonsqueezy") continue; // intentionally inactive
    if (s.state === "exhausted") alerts.push({ level: "red", provider: s.name, message: `Agotado${s.detail ? ` — ${s.detail}` : ""}. Fallback: ${s.fallback}` });
    else if (s.state === "invalid") alerts.push({ level: "red", provider: s.name, message: "Credencial inválida." });
    else if (s.state === "rate_limited") alerts.push({ level: "yellow", provider: s.name, message: "Rate limit activo." });
    else if (s.state === "missing" && s.id !== "brave") alerts.push({ level: "yellow", provider: s.name, message: "No configurado." });
    else if (s.state === "missing") alerts.push({ level: "yellow", provider: s.name, message: "No configurado — Serper+Tavily cubren búsqueda." });
    if (s.usage && s.usage.errors_today >= 5 && s.usage.errors_today > s.usage.calls_today * 0.3) alerts.push({ level: "yellow", provider: s.name, message: `${s.usage.errors_today} errores hoy (${s.usage.calls_today} llamadas).` });
    if (s.id === "supabase" && s.state !== "ok") alerts.push({ level: "red", provider: s.name, message: "Proveedor crítico SIN fallback degradado." });
  }
  return alerts;
}
