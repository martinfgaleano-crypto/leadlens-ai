// Live-sample preflight + GO/NO-GO (LIVE EXECUTION TRACE V1 §24/§33/§34).
//
// A deterministic readiness verdict for the future 15–25 account LIVE validation.
// It reports credential PRESENCE only (never a key value), never infers quota from a
// key's presence (quota is "unknown" unless a real health signal is supplied), and
// does not hardcode any single search provider as mandatory (§34).

import { createHash } from "node:crypto";
import { PROVIDER_DEFS, type ProviderState } from "@/lib/ops/provider-health";

export const LIVE_SAMPLE_PREFLIGHT_VERSION = "live-sample-preflight-v1";

export interface ProviderPreflight {
  id: string;
  role: string;
  credential_present: boolean;
  circuit_state: ProviderState;        // "not_tested" unless a real health signal is supplied
  quota: "unknown";                    // never inferred from key presence (§33)
  usable_for_live_sample: boolean;
}

export type LiveSampleVerdict = "READY" | "DEGRADED" | "BLOCKED";

export interface LiveSampleGoNoGo {
  version: typeof LIVE_SAMPLE_PREFLIGHT_VERSION;
  verdict: LiveSampleVerdict;
  providers: ProviderPreflight[];
  reasons: string[];
}

const anyPresent = (env: NodeJS.ProcessEnv, keys: string[]) => keys.some((k) => Boolean(env[k]));

/** Per-provider credential presence. Health is "not_tested" unless supplied — no probing. */
export function providerPreflight(
  env: NodeJS.ProcessEnv = process.env,
  health: Record<string, ProviderState> = {},
): ProviderPreflight[] {
  const rows: ProviderPreflight[] = PROVIDER_DEFS.map((def) => {
    const present = anyPresent(env, def.envKeys);
    const state = health[def.id] ?? "not_tested";
    // A provider is usable unless we hold a real signal that it is not (exhausted,
    // invalid, rate-limited, missing). Presence alone never implies usable quota.
    const knownBad = ["exhausted", "invalid", "rate_limited", "missing"].includes(state);
    return { id: def.id, role: def.role, credential_present: present, circuit_state: state, quota: "unknown" as const, usable_for_live_sample: present && !knownBad };
  });
  if (!rows.some((r) => r.id === "supabase")) {
    const supabasePresent = anyPresent(env, ["NEXT_PUBLIC_SUPABASE_URL"]) && anyPresent(env, ["SUPABASE_SERVICE_ROLE_KEY"]);
    rows.push({ id: "supabase", role: "Durable persistence (runs, traces)", credential_present: supabasePresent, circuit_state: health.supabase ?? "not_tested", quota: "unknown", usable_for_live_sample: supabasePresent });
  }
  return rows;
}

/**
 * Deterministic GO/NO-GO for the deep-research live sample. Criteria come from the
 * real run requirements: LLM extraction (Anthropic) and persistence (Supabase) are
 * hard requirements; full-text extraction (Firecrawl) is critical; recall needs at
 * least one search provider (any of brave/serper/tavily/exa — none hardcoded).
 */
export function liveSampleGoNoGo(
  env: NodeJS.ProcessEnv = process.env,
  health: Record<string, ProviderState> = {},
): LiveSampleGoNoGo {
  const providers = providerPreflight(env, health);
  const usable = (id: string) => providers.find((p) => p.id === id)?.usable_for_live_sample ?? false;
  const reasons: string[] = [];

  const anthropicOk = usable("anthropic");
  const supabaseOk = usable("supabase");
  const firecrawlOk = usable("firecrawl");
  const searchProviders = ["brave", "serper", "tavily", "exa"].filter(usable);

  if (!anthropicOk) reasons.push("Anthropic (structured extraction) is not usable — reports are fail-closed without it.");
  if (!supabaseOk) reasons.push("Supabase (durable persistence for runs + traces) is not usable.");
  if (!firecrawlOk) reasons.push("Firecrawl (full-text extraction) is not usable — critical extraction capability missing.");
  if (searchProviders.length === 0) reasons.push("No search provider is usable — discovery/event recall would be ~0.");
  else if (searchProviders.length < 2) reasons.push(`Only one search provider usable (${searchProviders[0]}) — coverage is reduced.`);

  const blocked = !anthropicOk || !supabaseOk || !firecrawlOk || searchProviders.length === 0;
  const degraded = !blocked && (searchProviders.length < 2);
  const verdict: LiveSampleVerdict = blocked ? "BLOCKED" : degraded ? "DEGRADED" : "READY";
  if (verdict === "READY") reasons.push("Extraction, persistence, and ≥2 search providers have credentials present; quota remains unverified until a live probe.");

  return { version: LIVE_SAMPLE_PREFLIGHT_VERSION, verdict, providers, reasons };
}

/**
 * Stable identity for a bounded live sample (§24): the sorted set of account ids +
 * the context + a revision. NOT timestamp-based, so a baseline, a rerun of the same
 * accounts, and a corrected/superseding sample are distinguishable.
 */
export function liveSampleFingerprint(input: { account_ids: string[]; context_id: string; revision: number }): string {
  const ids = Array.from(new Set(input.account_ids)).sort();
  return createHash("sha256").update(`${input.context_id}|rev${input.revision}|${ids.join("|")}`).digest("hex").slice(0, 16);
}
