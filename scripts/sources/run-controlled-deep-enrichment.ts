// Block 6 controlled pass: current verified shortlist only.
// Hard limits: 6 accounts, 2 queries/account, 12 provider calls, 5 results/call.
// Search results become evidence candidates, never automatic buying intent.
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assessClaim, assessEntityMatch, buildAccountDossier, buildAccountState, buildClientContext, canonicalizeEvidence, deduplicateEvidence } from "@/lib/intelligence/evidence-temporal";
import { persistEvidenceBundle } from "@/lib/intelligence/evidence-store";
import { braveProvider, serperProvider, tavilyProvider } from "@/lib/sources/access/providers";

loadEnvConfig(process.cwd());

const MAX_ACCOUNTS = 6;
const MAX_QUERIES_PER_ACCOUNT = 2;
const MAX_PROVIDER_CALLS = 12;
const MAX_RESULTS = 5;
const MAX_COST_USD = Number(process.env.BLOCK6_ENRICHMENT_MAX_USD ?? "0.75");
if (!Number.isFinite(MAX_COST_USD) || MAX_COST_USD <= 0 || MAX_COST_USD > 1) throw new Error("BLOCK6_ENRICHMENT_MAX_USD must be > 0 and <= 1.");

const pilotRoot = join(process.cwd(), "ml/data/pilot-amor-de-gea");
const latest = readdirSync(pilotRoot).filter((d) => /^\d{4}-/.test(d) && existsSync(join(pilotRoot, d, "staged-pipeline.json"))).sort().at(-1);
if (!latest) throw new Error("No current staged Amor de Gea shortlist.");
const staged = JSON.parse(readFileSync(join(pilotRoot, latest, "staged-pipeline.json"), "utf8")) as {
  shortlist: Array<{ company: string; domain: string | null; sector: string | null; segment?: { primarySegment?: string; segmentFit?: number; segmentEvidence?: string } }>;
};
const accounts = staged.shortlist.filter((a) => !!a.domain).slice(0, MAX_ACCOUNTS);
if (accounts.length < 5) throw new Error(`Controlled pass requires 5–6 verified-domain accounts; found ${accounts.length}.`);

async function main() {
const providers = [braveProvider, serperProvider, tavilyProvider];
const health = await Promise.all(providers.map(async (provider) => ({ provider, health: await provider.health() })));
const available = health.filter((x) => x.health.status === "available").map((x) => x.provider);
if (!available.length) throw new Error(`No bounded search provider available: ${health.map((x) => `${x.provider.id}=${x.health.reason}`).join("; ")}`);

const now = new Date().toISOString();
const context = buildClientContext({
  client_id: "amor-de-gea", captured_at: now, region: "Colombia",
  offering: "Infusiones y bebidas botánicas funcionales de bienestar",
  objective: "Identificar compradores o canales colombianos con encaje estructural y evidencia comercial verificable",
  priority_segments: ["retail", "distribution", "hospitality", "wellness"],
  excluded_segments: ["government", "medical_provider"],
  explicit_constraints: ["Colombia primero", "cuentas obvias no constituyen por sí solas valor pagado", "no inferir intención de compra"],
});

let providerCalls = 0;
let reportedCost = 0;
let costMeasuredCalls = 0;
const results = [];
for (let accountIndex = 0; accountIndex < accounts.length; accountIndex++) {
  const account = accounts[accountIndex];
  const queries = [
    `"${account.company}" Colombia productos naturales bienestar`,
    `"${account.company}" Colombia apertura expansión alianza lanzamiento 2025 2026`,
  ].slice(0, MAX_QUERIES_PER_ACCOUNT);
  const raw = [];
  for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
    if (providerCalls >= MAX_PROVIDER_CALLS) break;
    const provider = available[(accountIndex + queryIndex) % available.length];
    const response = await provider.search({ query: queries[queryIndex], region: "co", language: "es", max_results: MAX_RESULTS, query_type: queryIndex ? "signal_specific" : "company_specific", freshness_days: queryIndex ? 730 : null });
    providerCalls++;
    if (response.cost_estimate_usd != null) {
      costMeasuredCalls++;
      reportedCost += response.cost_estimate_usd;
      if (reportedCost > MAX_COST_USD) throw new Error(`Provider-reported cost cap exceeded: $${reportedCost.toFixed(4)} > $${MAX_COST_USD}.`);
    }
    if (!response.ok) continue;
    raw.push(...response.results.map((item) => canonicalizeEvidence({
      scope: "account", scope_key: account.domain!, url: item.url, provider: item.provider,
      provider_result_id: `${providerCalls}:${item.rank}`, publisher: null, source_type: item.source_type,
      title: item.title, excerpt: item.snippet, claim_text: queryIndex ? "Posible señal comercial o temporal reciente." : "La empresa opera en una categoría compatible.",
      claim_type: queryIndex ? "commercial_signal" : "structural_fit", publication_date: item.published_date,
      retrieved_at: item.retrieved_at, verified_at: now, language: item.locale ?? "es", country: "Colombia",
      entity_match: account.company, entity_match_confidence: assessEntityMatch({ company: account.company, domain: account.domain, url: item.canonical_url, title: item.title, excerpt: item.snippet }),
      source_quality: item.source_type === "regulatory" ? .9 : item.source_type === "news" ? .8 : item.canonical_url.includes(account.domain!) ? .82 : .62,
      extraction_method: "provider_search_result", raw_reference: `query:${queries[queryIndex]}`,
    })));
  }
  const evidence = deduplicateEvidence(raw);
  const structuralLinks = evidence.filter((e) => e.claim_type === "structural_fit").map((e) => ({ evidence: e, relation: "supports" as const }));
  const signalEvidence = evidence.filter((e) => e.claim_type === "commercial_signal" && /\b(apertura|expansi[oó]n|alianza|lanzamiento|nueva|nuevo|crecimiento)\b/i.test(`${e.title ?? ""} ${e.excerpt ?? ""}`));
  const claims = [
    assessClaim({ scope: "account", scope_key: account.domain!, category: "structural_fit", statement: `${account.company} presenta encaje estructural con el segmento ${account.segment?.primarySegment ?? "no clasificado"}.`, links: structuralLinks, now }),
    ...(signalEvidence.length ? [assessClaim({ scope: "account", scope_key: account.domain!, category: "commercial_signal", statement: `${account.company} presenta una señal comercial que requiere revisión humana.`, links: signalEvidence.map((e) => ({ evidence: e, relation: "supports" as const })), now })] : []),
  ];
  const state = buildAccountState({ account_key: account.domain!, client_id: context.client_id, observed_at: now, claims, structural_score: account.segment?.segmentFit ?? null });
  const dossier = buildAccountDossier({ name: account.company, domain: account.domain, country: "Colombia", segment: account.segment?.primarySegment ?? null, state, context });
  const persistence = await persistEvidenceBundle({ tenant_user_id: null, client_id: context.client_id, evidence, claims, state, dossier, context });
  results.push({ account: account.company, domain: account.domain, queries, evidence, claims, state, dossier, database_persistence: persistence });
}

const summary = {
  version: "controlled-deep-enrichment-v1", run_at: now, source_shortlist_run: latest,
  limits: { max_accounts: MAX_ACCOUNTS, max_queries_per_account: MAX_QUERIES_PER_ACCOUNT, max_provider_calls: MAX_PROVIDER_CALLS, max_results_per_call: MAX_RESULTS, max_cost_usd: MAX_COST_USD },
  providers_available: available.map((p) => p.id), provider_calls: providerCalls,
  provider_reported_cost_usd: costMeasuredCalls ? Number(reportedCost.toFixed(6)) : null,
  provider_cost_measurement: costMeasuredCalls ? `${costMeasuredCalls}/${providerCalls} calls reported cost` : "not_measured",
  accounts_researched: results.length,
  evidence_items: results.reduce((n, r) => n + r.evidence.length, 0),
  dated_evidence_items: results.reduce((n, r) => n + r.evidence.filter((e) => !!e.publication_date).length, 0),
  source_classes: new Set(results.flatMap((r) => r.evidence.map((e) => e.source_type ?? "unknown"))).size,
  claims: results.reduce((n, r) => n + r.claims.length, 0),
  corroborated_claims: results.reduce((n, r) => n + r.claims.filter((c) => ["corroborated", "strongly_corroborated"].includes(c.corroboration_state)).length, 0),
  contradicted_claims: results.reduce((n, r) => n + r.claims.filter((c) => c.corroboration_state === "contradicted").length, 0),
  current_opportunities: results.filter((r) => r.state.timing_state === "current_opportunity").length,
  monitor_accounts: results.filter((r) => r.state.timing_state === "monitor").length,
  review_candidates: results.filter((r) => r.dossier.decision.state === "review_candidate").length,
  database_persisted_accounts: results.filter((r) => r.database_persistence.persisted).length,
  database_note: results.every((r) => r.database_persistence.persisted) ? null : "Migration 042 is not applied or Supabase is unavailable; canonical JSON artifact is the controlled-pass persistence.",
};
const outDir = join(process.cwd(), "ml/data/evidence-temporal");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `amor-de-gea-${now.replace(/[:.]/g, "-")}.json`);
writeFileSync(outPath, `${JSON.stringify({ summary, client_context: context, accounts: results }, null, 2)}\n`);
console.log(JSON.stringify({ output: outPath, summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
