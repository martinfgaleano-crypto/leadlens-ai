// ─── Task-aware provider routing policy V1 (deterministic, inspectable) ───────
//
// Chooses the cheapest SUFFICIENT provider route for an intelligence task, using
// task type + geography/language + provider health + an escalation ladder. It
// returns inspectable decisions (ordered steps with reasons, a task-specific
// fallback, an explicit early-stop rule, and a technical budget) — NEVER an opaque
// provider score. No new providers. Known-unavailable providers are skipped up
// front (no wasted latency). Quality floors are never traded for cost — the router
// only orders/limits calls; the deterministic validation gates remain final.

export type ProviderId = "brave" | "tavily" | "serper" | "exa" | "firecrawl";
export type ProviderRole = "broad_discovery" | "news_temporal" | "account_specific" | "semantic_retrieval" | "extraction";
export type ResearchTask = "lead_hunter_discovery" | "initial_research" | "monitor_delta" | "full_text_extraction" | "corroboration";
export type QueryMode = "web" | "news" | "extract";

export type ProviderStatus = "available" | "degraded" | "quota_exhausted" | "unavailable";

export interface ResearchRoutingContext {
  task: ResearchTask;
  accountKnown: boolean;
  geography?: "us" | "co" | "other" | null;
  language?: "en" | "es";
  temporal: boolean;           // task explicitly needs recent-event discovery
  needsFullText: boolean;
  /** Provider already used by the primary step, so corroboration picks a different one. */
  primaryProviderUsed?: ProviderId | null;
}

export type EarlyStopKind =
  | "enough_unique_eligible_candidates"
  | "sufficient_evidence_for_case"
  | "decision_critical_resolved_or_sufficient_no_change"
  | "event_date_validated"
  | "independent_support_achieved";

export interface ProviderStep { provider: ProviderId; role: ProviderRole; queryMode: QueryMode; reason: string }

export interface RoutingBudget {
  maxProviderCalls: number;
  maxFallbackCalls: number;
  maxParallelProviders: number;
  maxFullTextFetches: number;
  maxLlmExtractionCalls: number;
  providerTimeoutMs: number;
}
export const DEFAULT_ROUTING_BUDGET: RoutingBudget = { maxProviderCalls: 6, maxFallbackCalls: 2, maxParallelProviders: 2, maxFullTextFetches: 4, maxLlmExtractionCalls: 3, providerTimeoutMs: 15_000 };

export interface RoutingPlan {
  task: ResearchTask;
  primary: ProviderStep[];
  fallback: ProviderStep[];
  earlyStop: EarlyStopKind;
  budget: RoutingBudget;
  skipped: Array<{ provider: ProviderId; reason: string }>;
  language: "en" | "es";
  geography: "us" | "co" | "other";
  reasons: string[];
}

export type HealthMap = Partial<Record<ProviderId, ProviderStatus>>;
const usable = (s: ProviderStatus | undefined): boolean => s === "available" || s === "degraded";

/** Deterministic route planner. Orders providers by task role; drops unhealthy
 *  ones; sets a task-specific early-stop + fallback + budget. */
export function planRoute(ctx: ResearchRoutingContext, health: HealthMap = {}, budget: RoutingBudget = DEFAULT_ROUTING_BUDGET): RoutingPlan {
  const language: "en" | "es" = ctx.language ?? (ctx.geography === "co" ? "es" : "en");
  const geography = ctx.geography ?? "us";
  const skipped: Array<{ provider: ProviderId; reason: string }> = [];
  const reasons: string[] = [];

  // Health filter: never spend latency on a known-unavailable/exhausted provider.
  const ok = (p: ProviderId): boolean => {
    const s = health[p];
    if (s === undefined) return true;            // unknown → treat as usable, engine handles at call time
    if (!usable(s)) { skipped.push({ provider: p, reason: `${p}_${s}` }); return false; }
    return true;
  };

  // Preference order per role (cheapest-sufficient first). Serper is de-prioritized
  // (historically quota-fragile) and only used when explicitly healthy.
  const broad: ProviderId[] = (["brave", "tavily", "serper"] as ProviderId[]).filter(ok);
  const temporal: ProviderId[] = (["tavily", "brave", "serper"] as ProviderId[]).filter(ok); // Tavily news mode leads temporal
  const account: ProviderId[] = (["tavily", "brave", "exa"] as ProviderId[]).filter(ok);
  const extraction: ProviderId[] = (["firecrawl", "tavily"] as ProviderId[]).filter(ok);

  const step = (provider: ProviderId, role: ProviderRole, queryMode: QueryMode, reason: string): ProviderStep => ({ provider, role, queryMode, reason });

  let primary: ProviderStep[] = [];
  let fallback: ProviderStep[] = [];
  let earlyStop: EarlyStopKind;

  switch (ctx.task) {
    case "lead_hunter_discovery": {
      reasons.push("lead_hunter: broad recall + identity quality; stop when enough unique eligible candidates");
      primary = broad.slice(0, 2).map((p) => step(p, "broad_discovery", ctx.temporal ? "news" : "web", "broad candidate discovery"));
      fallback = broad.slice(2).map((p) => step(p, "broad_discovery", "web", "additional recall if primary low-yield"));
      earlyStop = "enough_unique_eligible_candidates";
      break;
    }
    case "initial_research": {
      reasons.push("initial_research: account-specific evidence + temporal where available; stop at sufficient evidence");
      primary = account.slice(0, ctx.temporal ? 2 : 1).map((p, i) => step(p, i === 0 && ctx.temporal ? "news_temporal" : "account_specific", ctx.temporal ? "news" : "web", "account-specific evidence"));
      fallback = account.slice(primary.length).map((p) => step(p, "account_specific", "web", "additional evidence / counterevidence search"));
      earlyStop = "sufficient_evidence_for_case";
      break;
    }
    case "monitor_delta": {
      reasons.push("monitor_delta: prefer recent-event routes answering unresolved questions; escalate full-text only if ambiguous");
      primary = temporal.slice(0, 1).map((p) => step(p, "news_temporal", "news", "targeted recent-change discovery"));
      fallback = temporal.slice(1).map((p) => step(p, "broad_discovery", "web", "broader retry only if targeted route insufficient"));
      earlyStop = "decision_critical_resolved_or_sufficient_no_change";
      break;
    }
    case "full_text_extraction": {
      reasons.push("full_text: fetch + extract only when snippet is materially promising; stop when event date validated");
      primary = extraction.slice(0, 1).map((p) => step(p, "extraction", "extract", "direct source retrieval"));
      fallback = extraction.slice(1).map((p) => step(p, "extraction", "extract", "extraction fallback"));
      earlyStop = "event_date_validated";
      break;
    }
    case "corroboration": {
      reasons.push("corroboration: one targeted follow-up on a DIFFERENT provider (provider diversity ≠ origin independence — still validate origin)");
      const others = broad.filter((p) => p !== ctx.primaryProviderUsed);
      primary = others.slice(0, 1).map((p) => step(p, "broad_discovery", ctx.temporal ? "news" : "web", "independent corroboration source"));
      fallback = [];
      earlyStop = "independent_support_achieved";
      break;
    }
  }

  if (primary.length === 0) reasons.push("no healthy provider for the primary role — caller must degrade gracefully / mark insufficient");
  return { task: ctx.task, primary, fallback, earlyStop, budget, skipped, language, geography, reasons };
}
