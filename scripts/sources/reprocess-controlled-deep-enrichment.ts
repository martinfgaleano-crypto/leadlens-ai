// Offline adjudication of the latest controlled artifact. Makes zero provider calls.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessClaim, assessEntityMatch, buildAccountDossier, buildAccountState, deduplicateEvidence,
  type CanonicalEvidence, type ClientContext,
} from "@/lib/intelligence/evidence-temporal";

const dir = join(process.cwd(), "ml/data/evidence-temporal");
const file = readdirSync(dir).filter((f) => /^amor-de-gea-.*\.json$/.test(f)).sort().at(-1);
if (!file) throw new Error("No controlled enrichment artifact.");
const path = join(dir, file);
const artifact = JSON.parse(readFileSync(path, "utf8")) as {
  summary: Record<string, unknown>; client_context: ClientContext;
  accounts: Array<{ account: string; domain: string; evidence: CanonicalEvidence[]; state: { structural_score: number | null }; dossier: { structural: { segment: string | null } } }>;
};
const observedAt = String(artifact.summary.run_at);
const accounts = artifact.accounts.map((account) => {
  const evidence = deduplicateEvidence(account.evidence.map((item) => ({
    ...item,
    entity_match_confidence: assessEntityMatch({ company: account.account, domain: account.domain, url: item.canonical_url, title: item.title, excerpt: item.excerpt }),
  })));
  const structural = evidence.filter((e) => e.claim_type === "structural_fit");
  const signals = evidence.filter((e) => e.claim_type === "commercial_signal" && /\b(apertura|expansi[oó]n|alianza|lanzamiento|nueva|nuevo|crecimiento)\b/i.test(`${e.title ?? ""} ${e.excerpt ?? ""}`));
  const claims = [
    assessClaim({ scope: "account", scope_key: account.domain, category: "structural_fit", statement: `${account.account} presenta encaje estructural con el segmento ${account.dossier.structural.segment ?? "no clasificado"}.`, links: structural.map((e) => ({ evidence: e, relation: "supports" as const })), now: observedAt }),
    ...(signals.length ? [assessClaim({ scope: "account", scope_key: account.domain, category: "commercial_signal", statement: `${account.account} presenta una señal comercial que requiere revisión humana.`, links: signals.map((e) => ({ evidence: e, relation: "supports" as const })), now: observedAt })] : []),
  ];
  const state = buildAccountState({ account_key: account.domain, client_id: artifact.client_context.client_id, observed_at: observedAt, claims, structural_score: account.state.structural_score });
  const dossier = buildAccountDossier({ name: account.account, domain: account.domain, country: "Colombia", segment: account.dossier.structural.segment, state, context: artifact.client_context });
  return { ...account, evidence, claims, state, dossier, database_persistence: { ok: false, persisted: false, reason: "Offline readjudication; migration 042 pending." } };
});
Object.assign(artifact.summary, {
  version: "controlled-deep-enrichment-v1.1-entity-guard",
  offline_readjudicated_at: new Date().toISOString(),
  provider_calls: artifact.summary.provider_calls,
  additional_provider_calls: 0,
  evidence_items: accounts.reduce((n, a) => n + a.evidence.length, 0),
  dated_evidence_items: accounts.reduce((n, a) => n + a.evidence.filter((e) => !!e.publication_date).length, 0),
  source_classes: new Set(accounts.flatMap((a) => a.evidence.map((e) => e.source_type ?? "unknown"))).size,
  provider_reported_cost_usd: null,
  provider_cost_measurement: "not_measured",
  claims: accounts.reduce((n, a) => n + a.claims.length, 0),
  corroborated_claims: accounts.reduce((n, a) => n + a.claims.filter((c) => ["corroborated", "strongly_corroborated"].includes(c.corroboration_state)).length, 0),
  contradicted_claims: accounts.reduce((n, a) => n + a.claims.filter((c) => c.corroboration_state === "contradicted").length, 0),
  current_opportunities: accounts.filter((a) => a.state.timing_state === "current_opportunity").length,
  monitor_accounts: accounts.filter((a) => a.state.timing_state === "monitor").length,
  review_candidates: accounts.filter((a) => a.dossier.decision.state === "review_candidate").length,
});
writeFileSync(path, `${JSON.stringify({ ...artifact, accounts }, null, 2)}\n`);
console.log(JSON.stringify({ path, summary: artifact.summary }, null, 2));
