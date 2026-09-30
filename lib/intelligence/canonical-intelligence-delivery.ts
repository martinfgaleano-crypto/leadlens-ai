import type { AccountDossier, Claim, InstitutionalOpportunityReportV1 } from "@/lib/reports/institutional-report-types";

export const CANONICAL_INTELLIGENCE_DELIVERY_VERSION = "canonical-intelligence-delivery-v1" as const;
export type IntelligenceKnowledgeState = "known" | "inferred" | "unknown" | "contradicted" | "insufficient_evidence";
export type BenchmarkState = "Strong" | "Moderate" | "Limited" | "Unknown";
export type DecisionState = "prioritize" | "validate" | "monitor" | "hold";

export interface BenchmarkDimensionContract {
  dimension_id: string; label: string; question_answered: string; measurement_basis: string;
  source_fields: string[]; possible_states: BenchmarkState[]; unknown_behavior: "preserve_unknown";
  display_semantics: string; limitations: string;
}
export interface BenchmarkCell {
  dimension_id: string; state: BenchmarkState; known: boolean; source_metric: string;
  underlying_state: string | number | boolean | null; transformation: string; denominator: number | null;
}
export interface AccountBenchmarkRow {
  account: string; route_id: string; decision: DecisionState; cells: BenchmarkCell[];
  coverage: { usable_source: boolean; validated_date: boolean; recent_or_current: boolean; commercial_mechanism: boolean; access_path: boolean; verified_access: boolean; corroborated: boolean; counterevidence_researched: boolean };
}
export interface CommercialRouteIntelligence {
  route_id: string; label: string; definition: string; buyer_types: string[]; observed_accounts: string[];
  decisions: Record<DecisionState, number>; commercial_mechanism_coverage: { numerator: number; denominator: number };
  access_coverage: { numerator: number; denominator: number }; timing_coverage: { numerator: number; denominator: number };
  evidence_coverage: { numerator: number; denominator: number }; opportunity_pattern: Claim;
  barriers: string[]; unknowns: string[]; validation_requirements: string[];
}
export interface BuyerTypeIntelligence {
  buyer_type: string; route_ids: string[]; commercial_function: string; observed_procurement_mechanisms: string[];
  observed_access_mechanisms: string[]; typical_validation_questions: string[]; observed_barriers: string[];
  evidence_accounts: string[]; unknowns: string[];
}
export interface MarketMapNode { id: string; kind: "route" | "buyer_type" | "account"; label: string; decision?: DecisionState; actionability?: boolean; evidence?: BenchmarkState; }
export interface MarketMapEdge { from: string; to: string; relation: "route_has_buyer" | "buyer_has_account"; }
export interface IntelligenceChart {
  chart_id: string; type: "decision_distribution" | "evidence_coverage" | "route_actionability" | "account_benchmark";
  title: string; question_answered: string; population: string; denominator: number; unknown_count: number;
  data: Array<Record<string, string | number | boolean | null>>; empty_state: string | null;
}
export interface CanonicalIntelligenceDeliveryV1 {
  version: typeof CANONICAL_INTELLIGENCE_DELIVERY_VERSION;
  generated_at: string; scope: { population: "selected_accounts"; selected: number; capacity_target: number | null; scope_note: string };
  market_intelligence: { state: "PRESENT" | "INSUFFICIENT_DATA"; claims: Claim[]; routes: CommercialRouteIntelligence[]; buyer_types: BuyerTypeIntelligence[]; limitations: string[] };
  market_map: { state: "PRESENT" | "INSUFFICIENT_DATA"; nodes: MarketMapNode[]; edges: MarketMapEdge[]; scope_note: string };
  benchmark: { dimensions: BenchmarkDimensionContract[]; accounts: AccountBenchmarkRow[]; routes: Array<{ route_id: string; accounts: number; decisions: Record<DecisionState, number>; mechanism_coverage: string; evidence_coverage: string }>; scope_note: string };
  portfolio_intelligence: {
    leadlens_read: Claim; attention_allocation: Array<{ decision: DecisionState; accounts: string[]; guidance: string }>;
    opportunity_patterns: Claim[]; change_patterns: Claim[]; coverage_gaps: string[]; validation_themes: Array<{ theme: string; accounts: string[] }>;
    portfolio_tensions: Claim[]; strategic_guidance: Claim[];
  };
  evidence_coverage: {
    denominator: number; usable_source: number; validated_date: number; recent_or_current: number;
    commercial_mechanism: number; access_path: number; verified_access: number; corroborated: number; counterevidence_researched: number;
  };
  charts: IntelligenceChart[];
}

export const BENCHMARK_DIMENSIONS: BenchmarkDimensionContract[] = [
  { dimension_id: "objective_fit", label: "Objective fit", question_answered: "Does this account fit the commercial objective?", measurement_basis: "Canonical fit dimension", source_fields: ["fit_score", "opportunity_case.fit"], possible_states: ["Strong", "Moderate", "Limited", "Unknown"], unknown_behavior: "preserve_unknown", display_semantics: "Ordinal evidence-backed state", limitations: "Fit is customer-context dependent." },
  { dimension_id: "timing", label: "Timing", question_answered: "Is there a current reason to allocate attention?", measurement_basis: "Validated date or verified current access", source_fields: ["evidence_chain.date", "commercial_intelligence.current_actionability"], possible_states: ["Strong", "Moderate", "Limited", "Unknown"], unknown_behavior: "preserve_unknown", display_semantics: "Current access is not buying intent", limitations: "Undated evidence cannot establish event timing." },
  { dimension_id: "evidence", label: "Evidence", question_answered: "How defensible is the case?", measurement_basis: "Usable sources and corroboration", source_fields: ["evidence_chain", "evidence_grounded"], possible_states: ["Strong", "Moderate", "Limited", "Unknown"], unknown_behavior: "preserve_unknown", display_semantics: "Ordinal source coverage", limitations: "Source count alone does not prove independence." },
  { dimension_id: "commercial_access", label: "Commercial access", question_answered: "Is a concrete commercial mechanism available?", measurement_basis: "Verified mechanism and access path", source_fields: ["commercial_intelligence.commercial_mechanism", "commercial_intelligence.access_verified"], possible_states: ["Strong", "Moderate", "Limited", "Unknown"], unknown_behavior: "preserve_unknown", display_semantics: "Strong only when live access is verified", limitations: "Access does not imply demand or acceptance." },
  { dimension_id: "validation_burden", label: "Validation burden", question_answered: "How much remains unresolved before action?", measurement_basis: "Open validations and limitations", source_fields: ["hypotheses", "actionability_blockers"], possible_states: ["Strong", "Moderate", "Limited", "Unknown"], unknown_behavior: "preserve_unknown", display_semantics: "Strong means lower burden", limitations: "Questions vary in decision criticality." },
];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
const decisionOf = (d: AccountDossier): DecisionState => d.actionability_status === "act_now" ? "prioritize" : d.actionability_status === "validate_first" ? "validate" : d.actionability_status === "exclude" ? "hold" : "monitor";
const counts = (): Record<DecisionState, number> => ({ prioritize: 0, validate: 0, monitor: 0, hold: 0 });
const claim = (basis: Claim["basis"], text: string, evidence: string | null = null): Claim => ({ basis, text, evidence });
const strength = (d: AccountDossier, id: string): BenchmarkState => {
  const ci = d.commercial_intelligence;
  if (id === "objective_fit") return d.opportunity_case?.fit?.value ?? (d.fit_score == null ? "Unknown" : d.fit_score >= 8 ? "Strong" : d.fit_score >= 6 ? "Moderate" : "Limited");
  if (id === "timing") return ci?.current_actionability ? "Strong" : d.evidence_chain.some((e) => e.date) ? "Moderate" : "Unknown";
  if (id === "evidence") return d.evidence_grounded === true ? "Strong" : d.evidence_chain.some((e) => e.url) ? "Moderate" : d.evidence_chain.length ? "Limited" : "Unknown";
  if (id === "commercial_access") return ci?.access_verified ? "Strong" : ci?.commercial_mechanism ? "Moderate" : "Unknown";
  if (id === "validation_burden") return d.hypotheses.length === 0 ? "Unknown" : d.hypotheses.length <= 1 ? "Strong" : d.hypotheses.length <= 3 ? "Moderate" : "Limited";
  return "Unknown";
};

function cell(d: AccountDossier, dimension: BenchmarkDimensionContract, denominator: number): BenchmarkCell {
  const state = strength(d, dimension.dimension_id);
  const underlying = dimension.dimension_id === "objective_fit" ? d.fit_score
    : dimension.dimension_id === "timing" ? (d.commercial_intelligence?.current_actionability || d.evidence_chain.find((e) => e.date)?.date || null)
    : dimension.dimension_id === "evidence" ? d.evidence_chain.filter((e) => e.url).length
    : dimension.dimension_id === "commercial_access" ? d.commercial_intelligence?.commercial_mechanism ?? null
    : d.hypotheses.length;
  return { dimension_id: dimension.dimension_id, state, known: state !== "Unknown", source_metric: dimension.source_fields.join(" + "), underlying_state: underlying, transformation: dimension.measurement_basis, denominator };
}

export function buildCanonicalIntelligenceDelivery(report: InstitutionalOpportunityReportV1, capacityTarget: number | null = null): CanonicalIntelligenceDeliveryV1 {
  const dossiers = report.account_dossiers;
  const denominator = dossiers.length;
  const grouped = new Map<string, AccountDossier[]>();
  for (const d of dossiers) {
    const label = d.commercial_intelligence?.route_label ?? d.industry ?? "Unclassified route";
    const id = slug(label);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push(d);
  }
  const routes: CommercialRouteIntelligence[] = Array.from(grouped.entries()).map(([route_id, ds]) => {
    const decisions = counts(); ds.forEach((d) => decisions[decisionOf(d)]++);
    const buyerTypes = Array.from(new Set(ds.map((d) => d.commercial_intelligence?.buyer_type).filter((x): x is string => Boolean(x))));
    const mechanism = ds.filter((d) => Boolean(d.commercial_intelligence?.commercial_mechanism)).length;
    const access = ds.filter((d) => d.commercial_intelligence?.access_verified === true).length;
    const timing = ds.filter((d) => d.commercial_intelligence?.current_actionability === true || d.evidence_chain.some((e) => e.date)).length;
    const sourced = ds.filter((d) => d.evidence_chain.some((e) => e.url)).length;
    return { route_id, label: ds[0].commercial_intelligence?.route_label ?? ds[0].industry ?? "Unclassified route", definition: `Observed commercial route within the ${denominator}-account researched universe.`, buyer_types: buyerTypes, observed_accounts: ds.map((d) => d.company), decisions, commercial_mechanism_coverage: { numerator: mechanism, denominator: ds.length }, access_coverage: { numerator: access, denominator: ds.length }, timing_coverage: { numerator: timing, denominator: ds.length }, evidence_coverage: { numerator: sourced, denominator: ds.length }, opportunity_pattern: claim(ds.some((d) => decisionOf(d) === "prioritize") ? "inference" : "unknown", ds.some((d) => decisionOf(d) === "prioritize") ? `${route_id} contains at least one evidence-qualified current access path.` : `No evidence-qualified current access pattern was established for ${route_id}.`, ds.map((d) => d.company).join(", ")), barriers: Array.from(new Set(ds.flatMap((d) => d.risks.map((r) => r.text)))).slice(0, 4), unknowns: Array.from(new Set(ds.flatMap((d) => d.hypotheses.filter((h) => h.basis === "unknown" || h.basis === "hypothesis").map((h) => h.text)))).slice(0, 4), validation_requirements: Array.from(new Set(ds.flatMap((d) => d.hypotheses.map((h) => h.text)))).slice(0, 4) };
  });
  const buyerMap = new Map<string, AccountDossier[]>();
  for (const d of dossiers) { const b = d.commercial_intelligence?.buyer_type ?? "Buyer function not established"; if (!buyerMap.has(b)) buyerMap.set(b, []); buyerMap.get(b)!.push(d); }
  const buyer_types: BuyerTypeIntelligence[] = Array.from(buyerMap.entries()).map(([buyer_type, ds]) => ({ buyer_type, route_ids: Array.from(new Set(ds.map((d) => slug(d.commercial_intelligence?.route_label ?? d.industry ?? "Unclassified route")))), commercial_function: buyer_type === "Buyer function not established" ? "Unknown" : buyer_type, observed_procurement_mechanisms: Array.from(new Set(ds.map((d) => d.commercial_intelligence?.commercial_mechanism).filter((x): x is string => Boolean(x)))), observed_access_mechanisms: Array.from(new Set(ds.map((d) => d.commercial_intelligence?.access_path).filter((x): x is string => Boolean(x)))), typical_validation_questions: Array.from(new Set(ds.flatMap((d) => d.hypotheses.map((h) => h.text)))).slice(0, 5), observed_barriers: Array.from(new Set(ds.flatMap((d) => d.risks.map((r) => r.text)))).slice(0, 5), evidence_accounts: ds.map((d) => d.company), unknowns: buyer_type === "Buyer function not established" ? ["The responsible buying function was not established from public evidence."] : [] }));
  const accountBenchmark = dossiers.map((d) => ({ account: d.company, route_id: slug(d.commercial_intelligence?.route_label ?? d.industry ?? "Unclassified route"), decision: decisionOf(d), cells: BENCHMARK_DIMENSIONS.map((dim) => cell(d, dim, denominator)), coverage: { usable_source: d.evidence_chain.some((e) => e.url), validated_date: d.evidence_chain.some((e) => e.date), recent_or_current: d.commercial_intelligence?.current_actionability === true || d.evidence_chain.some((e) => e.date), commercial_mechanism: Boolean(d.commercial_intelligence?.commercial_mechanism), access_path: Boolean(d.commercial_intelligence?.access_path), verified_access: d.commercial_intelligence?.access_verified === true, corroborated: d.commercial_intelligence?.corroborated === true, counterevidence_researched: d.commercial_intelligence?.counterevidence_researched === true } }));
  const evidence = { denominator, usable_source: dossiers.filter((d) => d.evidence_chain.some((e) => e.url)).length, validated_date: dossiers.filter((d) => d.evidence_chain.some((e) => e.date)).length, recent_or_current: dossiers.filter((d) => d.commercial_intelligence?.current_actionability || d.evidence_chain.some((e) => e.date)).length, commercial_mechanism: dossiers.filter((d) => Boolean(d.commercial_intelligence?.commercial_mechanism)).length, access_path: dossiers.filter((d) => Boolean(d.commercial_intelligence?.access_path)).length, verified_access: dossiers.filter((d) => d.commercial_intelligence?.access_verified === true).length, corroborated: dossiers.filter((d) => d.commercial_intelligence?.corroborated === true).length, counterevidence_researched: dossiers.filter((d) => d.commercial_intelligence?.counterevidence_researched === true).length };
  const decisionCounts = counts(); dossiers.forEach((d) => decisionCounts[decisionOf(d)]++);
  const validations = new Map<string, string[]>();
  for (const d of dossiers) for (const h of d.hypotheses) { const theme = /buyer|category|procurement/i.test(h.text) ? "Buyer and category access" : /price|margin|econom|MOQ|minimum/i.test(h.text) ? "Commercial economics" : /import|regulat|certif|logistic/i.test(h.text) ? "Operational feasibility" : "Account-specific validation"; if (!validations.has(theme)) validations.set(theme, []); validations.get(theme)!.push(d.company); }
  const leadlensRead = decisionCounts.prioritize > 0
    ? `Within the ${denominator}-account researched universe, ${decisionCounts.prioritize} account has a verified current commercial-access basis; the remainder require validation, monitoring or hold decisions.`
    : `Within the ${denominator}-account researched universe, no account established an evidence-qualified current commercial-access basis.`;
  const nodes: MarketMapNode[] = [], edges: MarketMapEdge[] = [];
  for (const route of routes) { nodes.push({ id: `route:${route.route_id}`, kind: "route", label: route.label, actionability: route.decisions.prioritize > 0 }); for (const buyer of route.buyer_types.length ? route.buyer_types : ["Buyer function not established"]) { const bid = `buyer:${slug(buyer)}`; if (!nodes.some((n) => n.id === bid)) nodes.push({ id: bid, kind: "buyer_type", label: buyer }); edges.push({ from: `route:${route.route_id}`, to: bid, relation: "route_has_buyer" }); for (const d of grouped.get(route.route_id)!.filter((x) => (x.commercial_intelligence?.buyer_type ?? "Buyer function not established") === buyer)) { const aid = `account:${slug(d.company)}`; nodes.push({ id: aid, kind: "account", label: d.company, decision: decisionOf(d), actionability: d.commercial_intelligence?.current_actionability === true, evidence: strength(d, "evidence") }); edges.push({ from: bid, to: aid, relation: "buyer_has_account" }); } } }
  const charts: IntelligenceChart[] = [
    { chart_id: "decision-distribution", type: "decision_distribution", title: "Decision distribution", question_answered: "How is commercial attention allocated?", population: "selected accounts", denominator, unknown_count: 0, data: Object.entries(decisionCounts).map(([decision, value]) => ({ decision, value })), empty_state: denominator ? null : "No selected accounts." },
    { chart_id: "evidence-coverage", type: "evidence_coverage", title: "Evidence coverage", question_answered: "Where is the portfolio evidenced and where is it incomplete?", population: "selected accounts", denominator, unknown_count: denominator - evidence.usable_source, data: Object.entries(evidence).filter(([k]) => k !== "denominator").map(([metric, value]) => ({ metric, value, denominator })), empty_state: denominator ? null : "No selected accounts." },
    { chart_id: "route-actionability", type: "route_actionability", title: "Route actionability", question_answered: "Which observed routes contain verified access?", population: "selected accounts grouped by route", denominator, unknown_count: routes.filter((r) => r.buyer_types.length === 0).reduce((n, r) => n + r.observed_accounts.length, 0), data: routes.map((r) => ({ route: r.label, accounts: r.observed_accounts.length, prioritize: r.decisions.prioritize, mechanisms: r.commercial_mechanism_coverage.numerator, verified_access: r.access_coverage.numerator })), empty_state: routes.length ? null : "Insufficient route data." },
    { chart_id: "account-benchmark", type: "account_benchmark", title: "Account benchmark", question_answered: "Why does one account deserve more attention than another?", population: "selected accounts", denominator, unknown_count: accountBenchmark.flatMap((r) => r.cells).filter((c) => !c.known).length, data: accountBenchmark.map((r) => ({ account: r.account, decision: r.decision, known_dimensions: r.cells.filter((c) => c.known).length, dimensions: r.cells.length })), empty_state: accountBenchmark.length ? null : "No accounts to compare." },
  ];
  return {
    version: CANONICAL_INTELLIGENCE_DELIVERY_VERSION, generated_at: report.metadata.assembled_at,
    scope: { population: "selected_accounts", selected: denominator, capacity_target: capacityTarget, scope_note: `All market and portfolio statements are limited to the ${denominator}-account researched and selected universe; they do not represent the entire market.` },
    market_intelligence: { state: denominator ? "PRESENT" : "INSUFFICIENT_DATA", claims: [claim("fact", `${denominator} selected accounts were evaluated across ${routes.length} observed commercial routes.`, "selected account set"), claim("inference", leadlensRead, "canonical decisions + verified access")], routes, buyer_types, limitations: ["This is commercial-structure intelligence over the researched universe, not TAM/SAM/SOM or market-share analysis.", "Unknown buyer functions remain unknown and are not treated as negative evidence."] },
    market_map: { state: denominator && routes.length ? "PRESENT" : "INSUFFICIENT_DATA", nodes, edges, scope_note: `Route → buyer type → account map for ${denominator} selected accounts.` },
    benchmark: { dimensions: BENCHMARK_DIMENSIONS, accounts: accountBenchmark, routes: routes.map((r) => ({ route_id: r.route_id, accounts: r.observed_accounts.length, decisions: r.decisions, mechanism_coverage: `${r.commercial_mechanism_coverage.numerator}/${r.commercial_mechanism_coverage.denominator}`, evidence_coverage: `${r.evidence_coverage.numerator}/${r.evidence_coverage.denominator}` })), scope_note: "Benchmark states explain canonical decisions; they never replace or recompute those decisions." },
    portfolio_intelligence: { leadlens_read: claim("inference", leadlensRead, "decision distribution + evidence coverage"), attention_allocation: (["prioritize", "validate", "monitor", "hold"] as DecisionState[]).map((decision) => ({ decision, accounts: dossiers.filter((d) => decisionOf(d) === decision).map((d) => d.company), guidance: decision === "prioritize" ? "Allocate immediate validation and commercial preparation." : decision === "validate" ? "Resolve decision-critical unknowns before outreach." : decision === "monitor" ? "Watch for a material change or stronger access signal." : "Do not allocate active commercial effort without new evidence." })), opportunity_patterns: routes.filter((r) => r.decisions.prioritize + r.decisions.validate >= 2).map((r) => claim("inference", `${r.label} contains ${r.decisions.prioritize + r.decisions.validate} accounts currently worth prioritizing or validating.`, r.observed_accounts.join(", "))), change_patterns: dossiers.some((d) => d.evidence_chain.some((e) => e.date)) ? [claim("fact", `${evidence.validated_date} of ${denominator} selected accounts have validated dated evidence.`, "account evidence chains")] : [claim("unknown", "No portfolio-level dated change pattern was established.")], coverage_gaps: [`${denominator - evidence.validated_date}/${denominator} accounts lack validated dated evidence.`, `${denominator - evidence.corroborated}/${denominator} accounts lack confirmed independent corroboration.`, `${denominator - evidence.verified_access}/${denominator} accounts lack verified commercial access.`], validation_themes: Array.from(validations.entries()).map(([theme, accounts]) => ({ theme, accounts: Array.from(new Set(accounts)) })), portfolio_tensions: [evidence.usable_source > evidence.validated_date ? claim("inference", "Source coverage is materially stronger than dated-change coverage; fit should not be interpreted as timing.", `${evidence.usable_source}/${denominator} sourced vs ${evidence.validated_date}/${denominator} dated`) : null, evidence.verified_access < decisionCounts.validate + decisionCounts.prioritize ? claim("inference", "Several commercially relevant accounts still lack a verified access path.", `${evidence.verified_access}/${denominator} verified access`) : null].filter((x): x is Claim => Boolean(x)), strategic_guidance: [claim("recommendation", decisionCounts.prioritize ? "Protect the verified access route, resolve category/economics questions, and deepen the strongest Validate accounts without diluting evidence standards." : "Continue bounded actionability research before allocating advanced-tier commercial attention.", "canonical actionability state")] },
    evidence_coverage: evidence, charts,
  };
}

/** Tier-scopes an already-built intelligence object without reinterpreting any
 * account. Every denominator becomes the actual selected population. */
export function scopeCanonicalIntelligence(source: CanonicalIntelligenceDeliveryV1 | null | undefined, accountNames: string[]): CanonicalIntelligenceDeliveryV1 | null {
  if (!source) return null;
  const allowed = new Set(accountNames.map((x) => x.toLowerCase()));
  const sourceAccounts = source.benchmark.accounts.filter((row) => allowed.has(row.account.toLowerCase()));
  const denominator = sourceAccounts.length;
  const accounts = sourceAccounts.map((row) => ({ ...row, cells: row.cells.map((c) => ({ ...c, denominator })) }));
  const decisionCounts = counts(); accounts.forEach((row) => decisionCounts[row.decision]++);
  const evidence = {
    denominator,
    usable_source: accounts.filter((a) => a.coverage.usable_source).length,
    validated_date: accounts.filter((a) => a.coverage.validated_date).length,
    recent_or_current: accounts.filter((a) => a.coverage.recent_or_current).length,
    commercial_mechanism: accounts.filter((a) => a.coverage.commercial_mechanism).length,
    access_path: accounts.filter((a) => a.coverage.access_path).length,
    verified_access: accounts.filter((a) => a.coverage.verified_access).length,
    corroborated: accounts.filter((a) => a.coverage.corroborated).length,
    counterevidence_researched: accounts.filter((a) => a.coverage.counterevidence_researched).length,
  };
  const routes = source.market_intelligence.routes.flatMap((route) => {
    const observed = route.observed_accounts.filter((name) => allowed.has(name.toLowerCase()));
    if (!observed.length) return [];
    const rows = accounts.filter((a) => a.route_id === route.route_id);
    const dc = counts(); rows.forEach((r) => dc[r.decision]++);
    return [{ ...route, definition: `Observed commercial route within the ${denominator}-account tier-selected universe.`, observed_accounts: observed, decisions: dc,
      commercial_mechanism_coverage: { numerator: rows.filter((r) => r.coverage.commercial_mechanism).length, denominator: rows.length },
      access_coverage: { numerator: rows.filter((r) => r.coverage.verified_access).length, denominator: rows.length },
      timing_coverage: { numerator: rows.filter((r) => r.coverage.recent_or_current).length, denominator: rows.length },
      evidence_coverage: { numerator: rows.filter((r) => r.coverage.usable_source).length, denominator: rows.length },
      opportunity_pattern: claim(dc.prioritize ? "inference" : "unknown", dc.prioritize ? `${route.route_id} contains at least one evidence-qualified current access path.` : `No evidence-qualified current access pattern was established for ${route.route_id}.`, observed.join(", ")),
    }];
  });
  const routeIds = new Set(routes.map((r) => r.route_id));
  const buyer_types = source.market_intelligence.buyer_types.flatMap((buyer) => {
    const evidence_accounts = buyer.evidence_accounts.filter((name) => allowed.has(name.toLowerCase()));
    return evidence_accounts.length ? [{ ...buyer, evidence_accounts, route_ids: buyer.route_ids.filter((id) => routeIds.has(id)) }] : [];
  });
  const nodeIds = new Set(source.market_map.nodes.filter((node) => node.kind !== "account" || allowed.has(node.label.toLowerCase())).filter((node) => node.kind !== "route" || routeIds.has(node.id.replace(/^route:/, ""))).map((node) => node.id));
  const nodes = source.market_map.nodes.filter((node) => nodeIds.has(node.id));
  const edges = source.market_map.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const charts: IntelligenceChart[] = [
    { chart_id: "decision-distribution", type: "decision_distribution", title: "Decision distribution", question_answered: "How is commercial attention allocated?", population: "tier-selected accounts", denominator, unknown_count: 0, data: Object.entries(decisionCounts).map(([decision, value]) => ({ decision, value })), empty_state: denominator ? null : "No selected accounts." },
    { chart_id: "evidence-coverage", type: "evidence_coverage", title: "Evidence coverage", question_answered: "Where is the portfolio evidenced and where is it incomplete?", population: "tier-selected accounts", denominator, unknown_count: denominator - evidence.usable_source, data: Object.entries(evidence).filter(([key]) => key !== "denominator").map(([metric, value]) => ({ metric, value, denominator })), empty_state: denominator ? null : "No selected accounts." },
    { chart_id: "route-actionability", type: "route_actionability", title: "Route actionability", question_answered: "Which observed routes contain verified access?", population: "tier-selected accounts grouped by route", denominator, unknown_count: 0, data: routes.map((r) => ({ route: r.label, accounts: r.observed_accounts.length, prioritize: r.decisions.prioritize, mechanisms: r.commercial_mechanism_coverage.numerator, verified_access: r.access_coverage.numerator })), empty_state: routes.length ? null : "Insufficient route data." },
    { chart_id: "account-benchmark", type: "account_benchmark", title: "Account benchmark", question_answered: "Why does one account deserve more attention than another?", population: "tier-selected accounts", denominator, unknown_count: accounts.flatMap((r) => r.cells).filter((c) => !c.known).length, data: accounts.map((r) => ({ account: r.account, decision: r.decision, known_dimensions: r.cells.filter((c) => c.known).length, dimensions: r.cells.length })), empty_state: accounts.length ? null : "No accounts to compare." },
  ];
  const leadlensRead = decisionCounts.prioritize > 0
    ? `Within the ${denominator}-account tier-selected universe, ${decisionCounts.prioritize} account has a verified current commercial-access basis; the remainder require validation, monitoring or hold decisions.`
    : `Within the ${denominator}-account tier-selected universe, no account established an evidence-qualified current commercial-access basis.`;
  const validationThemes = source.portfolio_intelligence.validation_themes
    .map((theme) => ({ ...theme, accounts: theme.accounts.filter((name) => allowed.has(name.toLowerCase())) }))
    .filter((theme) => theme.accounts.length > 0);
  const portfolioTensions: Claim[] = [
    evidence.usable_source > evidence.validated_date ? claim("inference", "Source coverage is materially stronger than dated-change coverage; fit should not be interpreted as timing.", `${evidence.usable_source}/${denominator} sourced vs ${evidence.validated_date}/${denominator} dated`) : null,
    evidence.verified_access < decisionCounts.validate + decisionCounts.prioritize ? claim("inference", "Several commercially relevant accounts still lack a verified access path.", `${evidence.verified_access}/${denominator} verified access`) : null,
  ].filter((x): x is Claim => Boolean(x));
  return { ...source,
    scope: { ...source.scope, selected: denominator, scope_note: `All market and portfolio statements are limited to the ${denominator}-account tier-selected universe; they do not represent the entire market.` },
    market_intelligence: { ...source.market_intelligence, state: denominator ? "PRESENT" : "INSUFFICIENT_DATA", claims: [claim("fact", `${denominator} selected accounts were evaluated across ${routes.length} observed commercial routes.`, "tier-selected account set"), claim("inference", leadlensRead, "canonical decisions + verified access")], routes, buyer_types },
    market_map: { ...source.market_map, state: denominator && routes.length ? "PRESENT" : "INSUFFICIENT_DATA", nodes, edges, scope_note: `Route → buyer type → account map for ${denominator} tier-selected accounts.` },
    benchmark: { ...source.benchmark, accounts, routes: routes.map((r) => ({ route_id: r.route_id, accounts: r.observed_accounts.length, decisions: r.decisions, mechanism_coverage: `${r.commercial_mechanism_coverage.numerator}/${r.commercial_mechanism_coverage.denominator}`, evidence_coverage: `${r.evidence_coverage.numerator}/${r.evidence_coverage.denominator}` })) },
    portfolio_intelligence: {
      ...source.portfolio_intelligence,
      leadlens_read: claim("inference", leadlensRead, "tier decision distribution + evidence coverage"),
      attention_allocation: source.portfolio_intelligence.attention_allocation.map((allocation) => ({ ...allocation, accounts: allocation.accounts.filter((name) => allowed.has(name.toLowerCase())) })),
      opportunity_patterns: routes.filter((r) => r.decisions.prioritize + r.decisions.validate >= 2).map((r) => claim("inference", `${r.label} contains ${r.decisions.prioritize + r.decisions.validate} accounts currently worth prioritizing or validating.`, r.observed_accounts.join(", "))),
      change_patterns: evidence.validated_date ? [claim("fact", `${evidence.validated_date} of ${denominator} selected accounts have validated dated evidence.`, "tier account evidence chains")] : [claim("unknown", "No portfolio-level dated change pattern was established.")],
      coverage_gaps: [`${denominator - evidence.validated_date}/${denominator} accounts lack validated dated evidence.`, `${denominator - evidence.corroborated}/${denominator} accounts lack confirmed independent corroboration.`, `${denominator - evidence.verified_access}/${denominator} accounts lack verified commercial access.`],
      validation_themes: validationThemes,
      portfolio_tensions: portfolioTensions,
    },
    evidence_coverage: evidence,
    charts,
  };
}
