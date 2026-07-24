// ─── Source intelligence store (cross-run persistence) ───────────────────────
// Accumulates per-domain DomainStats across ALL discovery runs into
// .leadlens/source-intelligence.json. Loaded at run start (halved as decayed
// priors so old evidence never dominates fresh evidence) and merged+persisted
// at run end. This is the compounding loop for sources: every run teaches the
// next one which domains actually yield dated trigger events. Best-effort on
// serverless (ephemeral FS) — the in-run ledger still works without it.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { DomainStats } from "./source-utility";

const FILE = ".leadlens/source-intelligence.json";
const FIELDS: Array<keyof DomainStats> = ["urls", "extractions", "valid_dates", "trigger_events", "deep_candidates"];
const MAX_EFFECTIVE_EXTRACTIONS = 24;

/** Bounded evidence window: old volume must not dominate indefinitely. Rates
 * are preserved while effective sample size is capped. This also repairs the
 * legacy double-count inflation without deleting learned outcomes. */
export function compactSourceStats(s: DomainStats): DomainStats {
  const extractions = Math.max(0, Math.round(s.extractions || 0));
  if (extractions <= MAX_EFFECTIVE_EXTRACTIONS) return {
    urls: Math.max(0, Math.round(s.urls || 0)), extractions,
    valid_dates: Math.max(0, Math.round(s.valid_dates || 0)), trigger_events: Math.max(0, Math.round(s.trigger_events || 0)), deep_candidates: Math.max(0, Math.round(s.deep_candidates || 0)),
  };
  const ratio = MAX_EFFECTIVE_EXTRACTIONS / extractions;
  return {
    urls: Math.min(MAX_EFFECTIVE_EXTRACTIONS * 4, Math.round((s.urls || 0) * ratio)),
    extractions: MAX_EFFECTIVE_EXTRACTIONS,
    valid_dates: Math.round((s.valid_dates || 0) * ratio),
    trigger_events: Math.round((s.trigger_events || 0) * ratio),
    deep_candidates: Math.round((s.deep_candidates || 0) * ratio),
  };
}

/** Isolates observations made in this run from decayed priors. Persisting the
 * whole working ledger caused historical counts to be re-added every run. */
export function computeRunSourceDeltas(current: Record<string, DomainStats>, priors: Record<string, DomainStats>, touched: Iterable<string>): Record<string, DomainStats> {
  const out: Record<string, DomainStats> = {};
  for (const domain of Array.from(touched)) {
    const delta = { urls: 0, extractions: 0, valid_dates: 0, trigger_events: 0, deep_candidates: 0 };
    for (const field of FIELDS) delta[field] = Math.max(0, (current[domain]?.[field] ?? 0) - (priors[domain]?.[field] ?? 0));
    if (FIELDS.some(field => delta[field] > 0)) out[domain] = delta;
  }
  return out;
}

export function loadSourcePriors(): Record<string, DomainStats> {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, DomainStats>;
    const out: Record<string, DomainStats> = {};
    for (const [d, original] of Object.entries(raw)) {
      const s = compactSourceStats(original);
      // Decay: halve historical counts so recent in-run evidence dominates.
      out[d] = { urls: Math.floor(s.urls / 2), extractions: Math.floor(s.extractions / 2), valid_dates: Math.floor(s.valid_dates / 2), trigger_events: Math.floor(s.trigger_events / 2), deep_candidates: Math.floor(s.deep_candidates / 2) };
    }
    return out;
  } catch { return {}; }
}

/** Accepts current-run DELTAS only, never a ledger containing priors. */
export function persistSourceStats(runDeltas: Record<string, DomainStats>): void {
  try {
    let acc: Record<string, DomainStats> = {};
    try { acc = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, DomainStats>; } catch { /* first run */ }
    for (const [d, s] of Object.entries(runDeltas)) {
      const a = (acc[d] ??= { urls: 0, extractions: 0, valid_dates: 0, trigger_events: 0, deep_candidates: 0 });
      a.urls += s.urls; a.extractions += s.extractions; a.valid_dates += s.valid_dates;
      a.trigger_events += s.trigger_events; a.deep_candidates += s.deep_candidates;
      acc[d] = compactSourceStats(a);
    }
    mkdirSync(".leadlens", { recursive: true });
    writeFileSync(FILE, JSON.stringify(acc, null, 1));
  } catch { /* serverless: ephemeral — in-run ledger still applies */ }
}
