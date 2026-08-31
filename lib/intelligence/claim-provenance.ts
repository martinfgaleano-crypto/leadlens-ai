import { createHash } from "node:crypto";
import type { AccountDeepResearchTelemetry } from "@/lib/intelligence/account-deep-research";

export type ClaimSupportRole = "PRIMARY_DIRECT" | "INDEPENDENT_CORROBORATION" | "CONTEXT_ONLY";

export interface ClaimSourceBinding {
  source_id: string;
  url: string;
  origin: string;
  support_role: ClaimSupportRole;
}

export function stableSourceId(url: string): string {
  return `src_${createHash("sha256").update(canonicalUrl(url)).digest("hex").slice(0, 20)}`;
}

export function bindVerifiedClaimToSources(input: {
  claim: string;
  type: string;
  date: string | null;
  telemetry: AccountDeepResearchTelemetry | null | undefined;
}): ClaimSourceBinding[] {
  if (input.type !== "verified_public_signal" || !input.date || !input.telemetry) return [];
  const claimTokens = significantTokens(input.claim);
  const candidates = (input.telemetry.validated_events ?? []).filter((event) =>
    event.event_date === input.date && event.materiality_valid && tokenOverlap(claimTokens, significantTokens(event.claim_excerpt)) >= 2,
  );
  const primaryBindings = candidates.map((event) => ({
    source_id: stableSourceId(event.url), url: canonicalUrl(event.url), origin: event.source_host,
    support_role: "PRIMARY_DIRECT" as ClaimSupportRole,
  }));
  const corroboratingBindings = (input.telemetry.corroborating_sources ?? [])
    .filter((source) => source.event_date === input.date && tokenOverlap(claimTokens, significantTokens(source.claim_excerpt)) >= 2)
    .map((source) => ({ source_id: stableSourceId(source.url), url: canonicalUrl(source.url), origin: source.source_host, support_role: "INDEPENDENT_CORROBORATION" as ClaimSupportRole }));
  const bindings = [...primaryBindings, ...corroboratingBindings];
  const seen = new Set<string>();
  return bindings.filter((binding) => !seen.has(binding.source_id) && Boolean(seen.add(binding.source_id)));
}

function canonicalUrl(value: string): string {
  try { const url = new URL(value); url.hash = ""; for (const key of Array.from(url.searchParams.keys())) if (/^utm_|^(gclid|fbclid)$/i.test(key)) url.searchParams.delete(key); return url.toString(); }
  catch { return value.trim(); }
}

const STOP = new Set(["about", "after", "company", "with", "from", "into", "their", "announced", "official"]);
function significantTokens(value: string): Set<string> {
  return new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9-]{5,}/g)?.filter((token) => !STOP.has(token)) ?? []);
}
function tokenOverlap(a: Set<string>, b: Set<string>): number { return Array.from(a).filter((token) => b.has(token)).length; }
