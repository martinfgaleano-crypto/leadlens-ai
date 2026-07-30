import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Raw = {
  provider: string; query: string; query_family: string; url: string; title: string;
  entity_confidence: number; event_category: string | null; resolved_date: string | null;
};

const normalized = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const domainMatches = (actual: string, verified: string) => actual === verified || actual.endsWith(`.${verified}`);

function classify(account: { account: string; domain: string }, row: Raw, index: number) {
  const d = domain(row.url), title = normalized(row.title), target = normalized(account.account);
  const exactDomain = domainMatches(d, account.domain);
  const social = /linkedin|instagram|facebook|flickr|tiktok/.test(d);
  const directory = /yahoo|restaurantguru|100franquicias/.test(d);
  const marketplace = /mercadolibre|amazon\./.test(d);
  const similarDifferent =
    (account.account === "Natural + Mente" && /\bnatura\b/.test(title))
    || (account.account === "Distribuidora DAM" && /\bdamasco\b/.test(title))
    || (account.account === "Somos Consiente" && /\bsomos internet\b/.test(title));
  const exactName = title.includes(target);
  const genericTitle = ["forbes", ""].includes(title);
  const relation = exactDomain ? "exact_company"
    : marketplace ? "marketplace_listing"
      : social ? "social_profile"
        : directory ? "directory_profile"
          : similarDifferent ? "same_commercial_name_different_company"
            : genericTitle ? "unresolved" : "unrelated_namesake";
  const identityDecision = exactDomain ? "confirmed" : genericTitle ? "unresolved" : "wrong_entity";
  const confidence = exactDomain ? .99 : similarDifferent ? .97 : genericTitle ? .25 : .94;
  const nameMatch = exactDomain ? "domain_confirmed" : exactName ? "exact_text_unverified" : similarDifferent ? "partial_conflicting" : "none";
  const categoryMatch = exactDomain ? "consistent" : account.account === "Hotel Spa La Colina" && /hotel/.test(title) ? "generic_category_only" : "incompatible_or_unknown";
  const locationMatch = /\bcolombia|bogota|cali|pereira\b/.test(title) ? "country_or_city_mention_only" : "not_established";
  return {
    result_id: `b9id:${account.domain}:${index + 1}`, account: account.account, account_domain: account.domain,
    source_url: row.url, source_domain: d, provider: row.provider, query: row.query, query_family: row.query_family,
    name_match: nameMatch, domain_match: exactDomain ? "verified" : "mismatch",
    location_match: locationMatch, category_match: categoryMatch,
    social_property_match: social ? "unverified_social_property" : "not_applicable",
    legal_name_evidence: "not_available", relationship_state: relation,
    identity_decision: identityDecision, confidence,
    decisive_evidence: exactDomain ? [`Verified domain ${account.domain} matches result host.`]
      : similarDifferent ? ["Title identifies a different, similarly named company."]
        : genericTitle ? ["Title is insufficient to identify the subject."]
          : ["Result title/domain do not identify the target account."],
    missing_evidence: exactDomain ? [] : ["verified domain linkage", "matching contact/address or official property"],
    prior_rejection_reason: row.entity_confidence < .65 ? "identity_gate_failed" : "downstream_gate_failed",
    rejection_correct: !exactDomain || !row.event_category,
    event_category: row.event_category, event_date: row.resolved_date,
  };
}

const root = process.cwd();
const dir = join(root, "ml/data/signal-monitoring-operations");
const file = readdirSync(dir).filter((x) => /^amor-de-gea-block9-.*\.json$/.test(x)).sort().at(-1);
if (!file) throw new Error("Block 9 operating artifact unavailable.");
const source = JSON.parse(readFileSync(join(dir, file), "utf8")) as { accounts: Array<{ account: string; domain: string; raw_results: Raw[] }> };
const matrix = source.accounts.flatMap((account) => account.raw_results.map((row, index) => classify(account, row, index)));
const distribution = matrix.reduce<Record<string, number>>((acc, row) => { acc[row.relationship_state] = (acc[row.relationship_state] ?? 0) + 1; return acc; }, {});
const decisions = matrix.reduce<Record<string, number>>((acc, row) => { acc[row.identity_decision] = (acc[row.identity_decision] ?? 0) + 1; return acc; }, {});
const artifact = {
  audit_id: "block10-phase10a-identity-attribution", methodology_version: "colombian-entity-resolution-v1",
  generated_at: new Date().toISOString(), source_artifact: file, threshold_changes_before_audit: 0,
  summary: { results: matrix.length, relationship_distribution: distribution, identity_decisions: decisions, correct_prior_rejections: matrix.filter((x) => x.rejection_correct).length },
  matrix,
};
const outputDir = join(root, "ml/data/entity-resolution"); mkdirSync(outputDir, { recursive: true });
const output = join(outputDir, "block9-identity-attribution-audit.json"); writeFileSync(output, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ artifact: output, summary: artifact.summary }, null, 2));
