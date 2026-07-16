// ─── Provider-search → Vault promotion contract ──────────────────────────────
// Turns a source-benchmark result into a validated promotion candidate. Weak
// results are gated out (no promotion of ungrounded/undated/low-confidence
// signals). Everything carries provenance; nothing invents company facts.
// Promotions land in the Vault as pending_review (observation mode) so they
// NEVER enter the approved-only selector pool — ranking stays untouched.

export interface BenchmarkResultRow {
  query_id: string;
  region: string;
  signal: string;
  url: string;
  canonical_url: string;
  title: string | null;
  provider_first_seen: string;
  source_type: string | null;
  provider_date: string | null;
  extraction: { ok: boolean; extractor: string; fallback_used: boolean };
  resolved_date: { date: string | null; date_source: string; confidence: string; validation_method: string; conflict: boolean };
  auto_flags: Record<string, boolean | string>;
}

export interface ProviderSearchPromotionCandidate {
  source_result_id: string;         // sha(canonical_url + query_id)
  company: { canonical_name: string; domain: string | null; country: string | null; region: string | null };
  signal: { type: string; claim: string; publication_date: string | null; freshness_bucket: string; confidence: number };
  evidence: { canonical_url: string; source_type: string | null; provider: string; extraction_method: string; grounding_confidence: number; date_method: string; date_confidence: string; conflict: boolean };
  qualification: { relevant: boolean; date_valid: boolean; grounded_claim: boolean; qualified_opportunity: boolean; company_match: boolean };
  provenance: { query_id: string; created_at: string; benchmark_run: string | null };
}

const SIGNAL_MAP: Record<string, string> = {
  expansion: "expansion", hiring: "hiring", partnership: "partnership",
  product_launch: "product_launch", funding: "funding",
};

const REGION_COUNTRY: Record<string, { region: string; country: string }> = {
  US: { region: "north_america", country: "United States" },
  CO: { region: "latam", country: "Colombia" },
  MX: { region: "latam", country: "Mexico" },
};

function sha24(s: string): string {
  // lightweight deterministic id (djb2-ish, hex) — no node crypto needed at edges
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0") + s.length.toString(16);
}

function companyName(title: string | null): string | null {
  if (!title) return null;
  const name = title.split(/[|\-–—:]/)[0].trim();
  return name.length >= 3 && name.length <= 80 ? name : null;
}

function domainOf(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function freshnessOf(dateIso: string | null): string {
  if (!dateIso) return "unknown";
  const days = (Date.now() - new Date(dateIso).getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return "unknown";
  return days <= 30 ? "fresh" : days <= 90 ? "recent" : "stale";
}

/** Quality gate (rule 12: never promote weak). Returns null when the result is
 *  not a valid, dated, grounded, relevant signal with usable confidence. */
export function benchmarkRowToPromotionCandidate(row: BenchmarkResultRow, benchmarkRun: string | null): ProviderSearchPromotionCandidate | null {
  const f = row.auto_flags as Record<string, boolean>;
  const date = row.resolved_date?.date ?? null;
  const conf = row.resolved_date?.confidence ?? "none";
  // Gate: relevant + grounded + a real (non-low-confidence) publication date + extraction ok.
  if (!f.relevant || !f.grounded_claim || !row.extraction?.ok) return null;
  if (!date || conf === "low" || conf === "none") return null;

  const name = companyName(row.title);
  if (!name) return null; // never invent a company name

  const rc = REGION_COUNTRY[row.region] ?? { region: "unknown", country: null as unknown as string };
  // Deterministic confidence 0–100 from date confidence + officiality + freshness.
  let confidence = 45;
  if (conf === "high") confidence += 25; else if (conf === "medium") confidence += 12;
  if (row.source_type === "official" || row.source_type === "regulatory") confidence += 15;
  if (freshnessOf(date) === "fresh") confidence += 15; else if (freshnessOf(date) === "recent") confidence += 8;
  if (row.resolved_date?.conflict) confidence -= 10;
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    source_result_id: sha24(`${row.query_id}|${row.canonical_url}`),
    company: { canonical_name: name, domain: domainOf(row.canonical_url), country: rc.country ?? null, region: rc.region },
    signal: {
      type: SIGNAL_MAP[row.signal] ?? "other",
      claim: (row.title ?? "").slice(0, 300),
      publication_date: date,
      freshness_bucket: freshnessOf(date),
      confidence,
    },
    evidence: {
      canonical_url: row.canonical_url,
      source_type: row.source_type,
      provider: row.provider_first_seen,
      extraction_method: row.extraction.extractor,
      grounding_confidence: f.grounded_claim ? 0.8 : 0.4,
      date_method: row.resolved_date?.validation_method ?? "unknown",
      date_confidence: conf,
      conflict: !!row.resolved_date?.conflict,
    },
    qualification: {
      relevant: !!f.relevant, date_valid: !!f.valid_date, grounded_claim: !!f.grounded_claim,
      qualified_opportunity: !!f.qualified_opportunity, company_match: !!f.company_match,
    },
    provenance: { query_id: row.query_id, created_at: new Date().toISOString(), benchmark_run: benchmarkRun },
  };
}
