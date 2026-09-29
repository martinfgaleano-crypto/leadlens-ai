// Customer Context — canonical intake type + deterministic context→interpretation bridge.
// The FULL structured context is preserved; a deterministic ≤600-char bounded summary is derived for
// Stage-A interpretation (interpret-config MAX_INPUT_CHARS = 600), so nothing critical is silently lost
// and no LLM is spent just to satisfy the cap (§9-11). Fact types preserve provenance (§5/§18).

export const CUSTOMER_CONTEXT_SCHEMA = "leadlens.customer_context.intake.v1";
export const INTERPRET_INPUT_CAP = 600; // mirrors lib/interpretation/interpret-config MAX_INPUT_CHARS

export type FactType =
  | "OBSERVED_FACT" | "CUSTOMER_CONFIRMED" | "CUSTOMER_ESTIMATE" | "CUSTOMER_ASSUMPTION"
  | "EXTERNAL_AI_STRUCTURED" | "PUBLIC_EVIDENCE" | "LEADLENS_INFERENCE" | "UNKNOWN";

export interface CustomerContextIntake {
  schema: typeof CUSTOMER_CONTEXT_SCHEMA;
  version: number;
  company: { name: string; website?: string; one_line?: string };
  offering?: string;
  objective?: string;
  success?: string;
  target_market?: string;
  current_markets?: string;
  ideal_customer?: string;
  exclude?: string;
  constraints?: {
    capacity?: string; moq?: string; price?: string; packaging?: string;
    certifications?: string; customization?: string; logistics?: string;
  };
  channels?: string;
  timeline?: string;
  competitors?: string;
  unknowns?: string[];
  assumptions?: string[];
  // Provenance: how the data arrived. External-AI output is EXTERNAL_AI_STRUCTURED until the customer
  // confirms individual facts (then CUSTOMER_CONFIRMED). Never stored as verified merely because it parsed.
  provenance: { source: "guided" | "ai_assisted"; fact_type: FactType; confirmed: boolean; confirmed_at?: string };
}

/** Deterministic bounded summary for Stage-A interpretation. Priority order (most decision-relevant first),
 *  greedily packed to ≤600 chars. Critical commercial constraints are INCLUDED in priority order rather than
 *  truncated away; the caller still persists the FULL context for downstream structured consumption. */
export function buildBoundedContextSummary(ctx: CustomerContextIntake, cap = INTERPRET_INPUT_CAP): string {
  const c = ctx.constraints ?? {};
  const parts: string[] = [];
  const push = (label: string | null, val?: string) => { const v = (val ?? "").trim(); if (v) parts.push(label ? `${label}: ${v}` : v); };
  // 1) product/offering, 2) objective, 3) target geography, 4) ideal customer, 5) exclusions,
  // 6) capacity, 7) MOQ, 8) pricing constraint, 9) packaging/logistics, 10) channel constraints.
  push(null, ctx.offering);
  push("Objective", ctx.objective);
  push("Target market", ctx.target_market);
  push("Ideal customer", ctx.ideal_customer);
  push("Exclude", ctx.exclude);
  push("Capacity", c.capacity);
  push("MOQ", c.moq);
  push("Price", c.price);
  push("Packaging/logistics", [c.packaging, c.logistics].filter(Boolean).join("; ") || undefined);
  push("Channels", ctx.channels);

  // Greedy pack: keep whole segments in priority order while they fit; never cut a segment mid-word into
  // garbage — drop the first segment that doesn't fit and continue trying shorter later ones.
  let out = "";
  for (const p of parts) {
    const candidate = out ? `${out}. ${p}` : p;
    if (candidate.length <= cap) out = candidate;
  }
  // If even the first (product) segment exceeds the cap, hard-bound it (last resort).
  if (!out && parts.length) out = parts[0].slice(0, cap - 1) + "…";
  return out;
}

/** True when every REQUIRED field is present (company name, offering, objective, target market, ideal
 *  customer, success). Unknown optional/conditional fields are allowed. */
export function isContextConfirmable(ctx: CustomerContextIntake): boolean {
  return Boolean(ctx.company?.name?.trim() && ctx.offering?.trim() && ctx.objective?.trim() && ctx.target_market?.trim() && ctx.ideal_customer?.trim() && ctx.success?.trim());
}

/** Which critical constraints are set — so the UI/store can show what was captured vs left UNKNOWN and the
 *  bridge can prove no critical constraint was silently lost (it is either in the summary or persisted full). */
export function capturedConstraints(ctx: CustomerContextIntake): string[] {
  const c = ctx.constraints ?? {};
  return (["capacity", "moq", "price", "packaging", "certifications", "customization", "logistics"] as const).filter((k) => (c[k] ?? "").trim());
}
