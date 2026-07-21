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

export function loadSourcePriors(): Record<string, DomainStats> {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, DomainStats>;
    const out: Record<string, DomainStats> = {};
    for (const [d, s] of Object.entries(raw)) {
      // Decay: halve historical counts so recent in-run evidence dominates.
      out[d] = { urls: Math.floor(s.urls / 2), extractions: Math.floor(s.extractions / 2), valid_dates: Math.floor(s.valid_dates / 2), trigger_events: Math.floor(s.trigger_events / 2), deep_candidates: Math.floor(s.deep_candidates / 2) };
    }
    return out;
  } catch { return {}; }
}

export function persistSourceStats(runStats: Record<string, DomainStats>): void {
  try {
    let acc: Record<string, DomainStats> = {};
    try { acc = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, DomainStats>; } catch { /* first run */ }
    for (const [d, s] of Object.entries(runStats)) {
      const a = (acc[d] ??= { urls: 0, extractions: 0, valid_dates: 0, trigger_events: 0, deep_candidates: 0 });
      a.urls += s.urls; a.extractions += s.extractions; a.valid_dates += s.valid_dates;
      a.trigger_events += s.trigger_events; a.deep_candidates += s.deep_candidates;
    }
    mkdirSync(".leadlens", { recursive: true });
    writeFileSync(FILE, JSON.stringify(acc, null, 1));
  } catch { /* serverless: ephemeral — in-run ledger still applies */ }
}
