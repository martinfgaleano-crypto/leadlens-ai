// Offline Block 7 source-ownership correction. Zero provider/extraction calls.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { qualifyAccount, recoverAtomicClaims, type AccountResearchProfile, type EvidenceDecision } from "@/lib/intelligence/research-quality";
import {
  assessClaim, buildAccountDossier, buildAccountState, canonicalizeEvidence,
  type ClientContext, type CanonicalEvidence,
} from "@/lib/intelligence/evidence-temporal";
import { persistEvidenceBundle } from "@/lib/intelligence/evidence-store";

loadEnvConfig(process.cwd());

async function main() {
  const dir = join(process.cwd(), "ml/data/research-quality");
  const file = readdirSync(dir).filter((f) => /^amor-de-gea-block7-.*\.json$/.test(f)).sort().at(-1);
  if (!file) throw new Error("No Block 7 artifact.");
  const path = join(dir, file);
  const artifact = JSON.parse(readFileSync(path, "utf8")) as {
    summary: Record<string, unknown>; comparison: unknown; client_context: ClientContext;
    accounts: Array<{
      account: string; domain: string; profile: AccountResearchProfile; evidence_decisions: EvidenceDecision[];
      queries_executed: unknown[]; corroboration_attempts: unknown[]; dossier: Record<string, unknown>;
      database_persistence: { persisted: boolean };
    }>;
  };
  const now = String(artifact.summary.run_at);
  const accounts = [];
  for (const account of artifact.accounts) {
    const claims = recoverAtomicClaims(account.profile, account.evidence_decisions, now);
    const counterChecked = (account.dossier.counterevidence_search as { executed?: boolean } | undefined)?.executed === true;
    const qualification = qualifyAccount({
      profile: account.profile, claims, decisions: account.evidence_decisions, context: artifact.client_context,
      structural_relevance: (account.profile.structural_score ?? 0) >= 70 ? "strong" : (account.profile.structural_score ?? 0) >= 55 ? "moderate" : "weak",
      counterevidence_checked: counterChecked,
      decision_changing_question: claims.some((c) => c.category === "current_activity" && c.independent_source_count < 2) ? "Confirmar independientemente la fecha, alcance y entidad del evento actual." : null,
    });
    const accepted = account.evidence_decisions.filter((d) => d.accepted);
    const canonical: CanonicalEvidence[] = accepted.map((d) => canonicalizeEvidence({
      scope: "account", scope_key: account.domain, url: d.candidate.url, provider: d.candidate.provider,
      provider_result_id: `${d.decision_id}:rq-v1.1`, title: d.candidate.title, excerpt: d.candidate.excerpt,
      publisher: d.entity_state === "confirmed" || (d.source_tier === "C" && /instagram|facebook|linkedin|youtube|tiktok/i.test(d.candidate.canonical_url)) ? `account-controlled:${account.domain}` : null,
      claim_text: null, claim_type: d.commercial_relevance === "high" ? "commercial_signal" : "structural_fit",
      publication_date: d.candidate.publication_date, retrieved_at: d.candidate.retrieved_at, verified_at: now,
      language: "es", country: "Colombia", entity_match: account.account, entity_match_confidence: d.entity_confidence,
      source_quality: ({ A: .95, B: .82, C: .65, D: .3 } as const)[d.source_tier],
      extraction_method: "block7_offline_source_owner_readjudication", raw_reference: `decision:${d.decision_id}`,
      methodology_version: "evidence-temporal-v1.1-source-owner",
    }));
    const byDecision = new Map(accepted.map((d, i) => [d.decision_id, canonical[i]]));
    const registryClaims = claims.map((claim) => assessClaim({
      claim_id: `${claim.claim_id}_v11`, scope: "account", scope_key: account.domain,
      category: claim.category === "current_activity" ? "commercial_signal" : claim.category === "negative_event" ? "risk" : "structural_fit",
      statement: claim.statement, now, links: claim.evidence_decision_ids.flatMap((id) => byDecision.has(id) ? [{ evidence: byDecision.get(id)!, relation: claim.category === "negative_event" ? "contradicts" as const : "supports" as const }] : []),
      change_reason: "Source ownership correction: account-controlled channels count once.",
    }));
    const state = buildAccountState({ account_key: account.domain, client_id: artifact.client_context.client_id, observed_at: new Date().toISOString(), claims: registryClaims, structural_score: account.profile.structural_score });
    const base = buildAccountDossier({ name: account.account, domain: account.domain, country: "Colombia", segment: account.profile.segment, state, context: artifact.client_context });
    const dossier = {
      ...base, ...account.dossier, evidence: base.evidence, temporal: base.temporal,
      claims_generated: claims, qualification, monitoring_triggers: qualification.monitoring_triggers,
      decision: base.decision, confidence: base.confidence,
      source_independence_method: "account-controlled website and social channels count as one source owner",
      limitations: Array.from(new Set([...(base.limitations ?? []), ...qualification.remaining_uncertainty.slice(0, 5)])),
      methodology_version: "research-quality-v1.1-source-owner",
    };
    const persistence = await persistEvidenceBundle({ tenant_user_id: null, client_id: artifact.client_context.client_id, evidence: canonical, claims: registryClaims, state, dossier, context: artifact.client_context });
    accounts.push({ ...account, claims, qualification, dossier, database_persistence: persistence });
  }
  const claims = accounts.flatMap((a) => a.claims);
  const qualifications = accounts.map((a) => a.qualification);
  Object.assign(artifact.summary, {
    version: "block7-controlled-research-v1.1-source-owner",
    offline_readjudicated_at: new Date().toISOString(), additional_provider_calls: 0, additional_extractions: 0,
    corroborated_claims: claims.filter((c) => c.independent_source_count >= 2).length,
    commercially_relevant_claims: claims.filter((c) => c.commercial_relevance === "high").length,
    decision_distribution: Object.fromEntries(["act_now", "investigate_now", "prioritize", "monitor", "low_priority", "exclude"].map((s) => [s, qualifications.filter((q) => q.state === s).length])),
    actionable_accounts: qualifications.filter((q) => ["act_now", "investigate_now"].includes(q.state)).length,
    monitor_accounts: qualifications.filter((q) => q.state === "monitor").length,
    excluded_accounts: qualifications.filter((q) => q.state === "exclude").length,
    database_persisted_accounts: accounts.filter((a) => a.database_persistence.persisted).length,
  });
  writeFileSync(path, `${JSON.stringify({ ...artifact, accounts }, null, 2)}\n`);
  console.log(JSON.stringify({ path, summary: artifact.summary }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
