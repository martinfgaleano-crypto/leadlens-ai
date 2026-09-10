// ─── Premium Differentiation V1 — Phase 1/2/5 production wiring (persistence envelope + governor) ──
//
// Turns the proven live researcher into production architecture: it derives the bounded research
// input from the confirmed context + evaluated portfolio, runs the (already fail-closed, COGS-ceiling)
// researcher, and packages the result as a durable, versioned, backward-compatible
// PremiumContextEnvelopeV1 persisted INSIDE the report JSON (report._premium_context). No migration:
// the envelope is optional and old reports simply have none (→ fail-closed absence at delivery).
//
// Doctrine: never throws (a Premium-context failure must NEVER fail the paid canonical report);
// eligibility is server-authoritative (premium plan only); zero-result and failure are honest states,
// never filler. COGS is measured, ceiling-stopped inside the researcher, and recorded on the envelope.

import type { PremiumContextV1, PremiumContextResearcher } from "@/lib/intelligence/premium/premium-context";
import { assemblePremiumContext, PREMIUM_BUDGETS } from "@/lib/intelligence/premium/premium-context";

export const PREMIUM_CONTEXT_VERSION = "premium_context_v1" as const;

/** Server-authoritative eligibility: only the Premium one-time tier (legacy plan slug "pro") runs
 *  bounded contextual research. Everything else (preview/brief/portfolio, subscriptions) never does. */
export function isPremiumEligible(plan: string | null | undefined): boolean {
  return plan === "pro" || plan === "premium" || plan === "premium_launch_v0";
}

export type PremiumContextStatus =
  | "present"          // research ran and produced gated context (may still be partial/zero within caps)
  | "unavailable"      // ran but produced nothing defensible (valid zero-result)
  | "failed"           // research errored / ceiling / provider+llm unavailable — fail-closed
  | "not_eligible";    // tier is not Premium (defensive; normally not persisted)

/** Durable, versioned Premium context record persisted with the snapshot. Backward-compatible:
 *  absent on old/non-premium reports; `context` is null unless status === "present". */
export interface PremiumContextEnvelopeV1 {
  version: typeof PREMIUM_CONTEXT_VERSION;
  status: PremiumContextStatus;
  generatedAt: string;                 // ISO — when the research ran (never invented)
  researchScope: { objective: string; portfolioCompanies: string[]; offer: string | null; caps: typeof PREMIUM_BUDGETS };
  context: PremiumContextV1 | null;    // the gated context (present only when status === "present")
  cost: { providerCalls: number; llmCalls: number; estimatedUsd: number | null; measured: boolean };
  latencyMs: number;
  failClosedReasons: string[];         // why capabilities are absent / research did not fully run
  capabilityGeneration: number;        // bump when the research methodology changes
}

export const PREMIUM_CAPABILITY_GENERATION = 1;

export interface ResearchInputSource {
  onboardingData?: { offer_description?: string | null; value_proposition?: string | null; company_description?: string | null; target_customer_description?: string | null } | null;
  criteria?: { target_industries?: string[] | null; target_market_region?: string | null; target_geography?: string[] | null } | null;
  companies: string[];
}

const clean = (s: string | null | undefined) => (typeof s === "string" ? s.trim() : "");

/** Derive the bounded researcher input from the confirmed context + evaluated portfolio. Deterministic. */
export function deriveResearchInput(src: ResearchInputSource): { objective: string; portfolioCompanies: string[]; offer: string | null } {
  const ob = src.onboardingData ?? {};
  const cr = src.criteria ?? {};
  const industries = (cr.target_industries ?? []).filter(Boolean);
  const region = clean(cr.target_market_region) || (cr.target_geography ?? []).filter(Boolean).join(", ");
  const objectiveBase = clean(ob.target_customer_description) || industries.join(", ") || "the evaluated commercial segment";
  const objective = region ? `${objectiveBase} in ${region}` : objectiveBase;
  const offer = clean(ob.offer_description) || clean(ob.value_proposition) || clean(ob.company_description) || null;
  // Dedup + bound the portfolio company list (the researcher anchors adjacency on the first few).
  const portfolioCompanies = Array.from(new Set(src.companies.map(clean).filter(Boolean)));
  return { objective, portfolioCompanies, offer };
}

export interface ProducePremiumContextDeps {
  /** Injected researcher (tests). Default: the live provider+LLM researcher. */
  researcher?: PremiumContextResearcher;
  now?: () => number;
}

function envelope(status: PremiumContextStatus, scope: PremiumContextEnvelopeV1["researchScope"], now: number, over: Partial<PremiumContextEnvelopeV1> = {}): PremiumContextEnvelopeV1 {
  return {
    version: PREMIUM_CONTEXT_VERSION, status, generatedAt: new Date(now).toISOString(), researchScope: scope,
    context: null, cost: { providerCalls: 0, llmCalls: 0, estimatedUsd: null, measured: false }, latencyMs: 0,
    failClosedReasons: [], capabilityGeneration: PREMIUM_CAPABILITY_GENERATION, ...over,
  };
}

/** Produce the Premium context envelope for a report. NEVER throws — a failure returns a fail-closed
 *  envelope so the paid canonical report always completes. The researcher itself enforces the COGS
 *  ceiling (throws → caught here → status "failed"). */
export async function producePremiumContext(
  input: { objective: string; portfolioCompanies: string[]; offer: string | null },
  deps: ProducePremiumContextDeps = {},
): Promise<PremiumContextEnvelopeV1> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const scope: PremiumContextEnvelopeV1["researchScope"] = { objective: input.objective, portfolioCompanies: input.portfolioCompanies, offer: input.offer, caps: PREMIUM_BUDGETS };
  try {
    const researcher = deps.researcher ?? (await defaultResearcher());
    const raw = await researcher.research(input);
    const context = assemblePremiumContext(raw);
    const cost = { providerCalls: raw.cost?.providerCalls ?? 0, llmCalls: raw.cost?.llmCalls ?? 0, estimatedUsd: raw.cost?.estimatedUsd ?? null, measured: raw.cost?.measured ?? false };
    const latencyMs = raw.cost?.elapsedMs ?? (now() - startedAt);
    const hasAny = context.benchmark.state === "PRESENT" || context.competitors.length > 0 || context.additionalOpportunities.length > 0 || context.ecosystem.length > 0;
    const reasons: string[] = [];
    if (!hasAny) reasons.push("no_defensible_context_found");
    const env = envelope(hasAny ? "present" : "unavailable", scope, startedAt, { context: hasAny ? context : null, cost, latencyMs, failClosedReasons: reasons });
    logPremiumObservability(env, context);
    return env;
  } catch (err) {
    const reason = /PREMIUM_COGS_CEILING/.test(String(err)) ? "cogs_ceiling_reached" : "research_error";
    const env = envelope("failed", scope, startedAt, { latencyMs: now() - startedAt, failClosedReasons: [reason] });
    logPremiumObservability(env, null);
    return env;
  }
}

/** Phase 10 — sanitized, deterministic production observability. NEVER emits provider names, raw model
 *  output, URLs, or secrets — only counts, status, cost, latency and fail-closed reasons. Best-effort. */
function logPremiumObservability(env: PremiumContextEnvelopeV1, ctx: PremiumContextV1 | null): void {
  try {
    console.info("[premium-context]", JSON.stringify({
      status: env.status,
      capabilityGeneration: env.capabilityGeneration,
      benchmark: ctx?.benchmark.state ?? "NONE",
      competitors: ctx?.competitors.length ?? 0,
      additionalOpportunities: ctx?.additionalOpportunities.length ?? 0,
      ecosystem: ctx?.ecosystem.length ?? 0,
      providerCalls: env.cost.providerCalls,
      llmCalls: env.cost.llmCalls,
      estimatedUsd: env.cost.estimatedUsd,
      measured: env.cost.measured,
      latencyMs: env.latencyMs,
      failClosedReasons: env.failClosedReasons,
    }));
  } catch { /* observability must never affect the run */ }
}

/** Delivery read: the gated context a renderer should show, or null (fail-closed) for any non-present
 *  status, missing envelope, version mismatch, or malformed record. */
export function premiumContextFromEnvelope(raw: unknown): PremiumContextV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const env = raw as Partial<PremiumContextEnvelopeV1>;
  if (env.version !== PREMIUM_CONTEXT_VERSION) return null;   // unknown/newer version → fail-closed
  if (env.status !== "present" || !env.context) return null;
  return env.context;
}

async function defaultResearcher(): Promise<PremiumContextResearcher> {
  const { createLivePremiumContextResearcher } = await import("@/lib/intelligence/premium/premium-context-researcher");
  return createLivePremiumContextResearcher({});
}
