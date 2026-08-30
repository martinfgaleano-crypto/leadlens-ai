// RESEARCH MATERIALITY & TEMPORAL INTEGRITY V1 (§3/§6/§12/§17) — the ONE deterministic
// predicate that both canonical Case reasoning and Vault Research accretion use to
// decide whether a research claim is a MATERIAL EVENT versus a static COMPANY FACT.
//
// Doctrine: PUBLIC FACT ≠ SIGNAL ≠ MATERIAL EVENT. A claim being VERIFIED (true, sourced)
// does NOT make it a material event. "Company operates 25 facilities" is a verified fact,
// never "What Changed" — even with a date attached. Only a triggering corporate change of
// non-trivial materiality qualifies. This reuses the canonical classifiers
// (classifySignalKind / classifyMateriality) so materiality stays deterministic and is
// NOT inflated by corroboration or LLM confidence (§12/§19).

import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";

/**
 * Is this claim text a MATERIAL EVENT (a real corporate change), rather than a static
 * company fact / metric / capability / marketing / reference?
 *
 * A claim qualifies when it is a triggering change (verb-gate) OR carries non-trivial
 * materiality (medium/high). Static facts and metrics score low on BOTH and are rejected,
 * however true or well-sourced they are.
 */
export function isMaterialEventClaim(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  const kind = classifySignalKind(t);
  if (kind.can_trigger) return true;
  const materiality = classifyMateriality(t);
  return materiality.level === "high" || materiality.level === "medium";
}
