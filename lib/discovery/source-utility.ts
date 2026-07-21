// ─── Source utility scoring (source-utility-v1) ──────────────────────────────
// Measures each DOMAIN's real usefulness to LeadLens within and across runs:
// did its pages yield valid dates, trigger events, deep-validation candidates?
// The score is USED (not just reported): it orders which URLs get the scarce
// extraction budget. Seed priors come from observed benchmark performance
// (domains that actually produced dated trigger events in traced runs), not
// from journalistic reputation — a famous outlet that never yields a usable
// event ranks below an obscure trade page that does.

export const SOURCE_UTILITY_VERSION = "source-utility-v1";

export interface DomainStats {
  urls: number; extractions: number; valid_dates: number;
  trigger_events: number; deep_candidates: number;
}

// Observed-performance seed (2026-07 traced benchmarks): domains whose pages
// produced dated, company-associated trigger events. Kept small on purpose —
// the in-run stats dominate as soon as evidence accumulates.
const OBSERVED_GOOD = /(larepublica\.co|portafolio\.co|elcolombiano\.com|eltiempo\.com|semana\.com|valoraanalitik\.com|forbes\.co|dinero\.com|elespectador\.com|americaretail\.com|mundomaritimo\.cl)$/i;
// Observed-noise: aggregator/syndication hosts that repeatedly yielded
// undated or duplicated copies in benchmarks.
const OBSERVED_NOISE = /(yahoo\.com|msn\.com|news\.google|feedproxy|notipress|globenewswire\.com|prnewswire\.com|einnews\.com)$/i;

export function newSourceLedger(): Record<string, DomainStats> { return {}; }

export function noteUrl(ledger: Record<string, DomainStats>, domain: string): void {
  if (!domain) return;
  (ledger[domain] ??= { urls: 0, extractions: 0, valid_dates: 0, trigger_events: 0, deep_candidates: 0 }).urls++;
}
export function noteOutcome(ledger: Record<string, DomainStats>, domain: string, o: { extracted?: boolean; valid_date?: boolean; trigger_event?: boolean; deep_candidate?: boolean }): void {
  if (!domain) return;
  const s = (ledger[domain] ??= { urls: 0, extractions: 0, valid_dates: 0, trigger_events: 0, deep_candidates: 0 });
  if (o.extracted) s.extractions++;
  if (o.valid_date) s.valid_dates++;
  if (o.trigger_event) s.trigger_events++;
  if (o.deep_candidate) s.deep_candidates++;
}

/** 0-100 utility score for a domain given the current ledger. */
export function sourceUtilityScore(ledger: Record<string, DomainStats>, domain: string): number {
  let score = 50; // unknown domain baseline
  if (OBSERVED_GOOD.test(domain)) score += 25;
  if (OBSERVED_NOISE.test(domain)) score -= 30;
  const s = ledger[domain];
  if (s && s.extractions > 0) {
    // In-run evidence dominates: rate of useful outcomes per extraction.
    const useful = (s.valid_dates + 2 * s.trigger_events + 3 * s.deep_candidates) / s.extractions;
    score += Math.min(30, Math.round(useful * 15));
    if (s.extractions >= 2 && s.valid_dates === 0) score -= 20; // proven date-less
  }
  return Math.max(0, Math.min(100, score));
}
