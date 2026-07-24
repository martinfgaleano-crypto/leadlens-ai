import { assessCatalogChannel, assessChannelAccess } from "./channel-access";
import { rejectEnumeratedName } from "./company-universe";

export interface SearchTraceRow {
  company: string;
  round: number;
  query_kind: "event" | "channel_access";
  query: string;
  results: Array<{ title: string; url: string; provider: string }>;
}

export interface ReplayHypothesis {
  company: string;
  domain: string;
  confidence: "high" | "medium";
  evidence_type: "declared_distribution_capability" | "multi_brand_catalog";
  matched: string[];
  evidence_urls: string[];
  status: "requires_live_revalidation";
}

function domainFromSiteQuery(query: string): string | null {
  const m = query.match(/(?:^|\s)site:([^\s]+)/i);
  return m?.[1]?.replace(/^www\./, "").toLowerCase() ?? null;
}

/** Re-evaluates already-paid public search metadata under current deterministic
 * rules. It never emits a production candidate because page content, identity,
 * geography and extraction must be revalidated live. */
export function replayChannelHypotheses(trace: SearchTraceRow[]): ReplayHypothesis[] {
  const grouped = new Map<string, { domain: string; results: SearchTraceRow["results"] }>();
  for (const row of trace) {
    if (row.query_kind !== "channel_access") continue;
    // Do not resurrect identities produced by historical, looser enumeration.
    if (rejectEnumeratedName(row.company)) continue;
    const domain = domainFromSiteQuery(row.query);
    if (!domain) continue;
    const key = `${row.company.toLowerCase()}|${domain}`;
    const current = grouped.get(key) ?? { domain, results: [] };
    for (const result of row.results) if (!current.results.some(r => r.url === result.url)) current.results.push(result);
    grouped.set(key, current);
  }

  const out: ReplayHypothesis[] = [];
  for (const [key, group] of Array.from(grouped.entries())) {
    const company = key.split("|")[0];
    const direct = group.results.map(r => ({ r, a: assessChannelAccess(r.title, true) })).find(x => x.a.qualifies);
    const catalog = assessCatalogChannel({ company, domain: group.domain, results: group.results.map(r => ({ title: r.title, url: r.url })) });
    const best = direct?.a.qualifies ? direct.a : catalog;
    if (!best.qualifies) continue;
    out.push({
      company: trace.find(r => r.company.toLowerCase() === company)?.company ?? company,
      domain: group.domain, confidence: best.confidence === "high" ? "high" : "medium",
      evidence_type: direct?.a.qualifies ? "declared_distribution_capability" : "multi_brand_catalog",
      matched: best.matched,
      evidence_urls: best.evidence_urls?.length ? best.evidence_urls : direct ? [direct.r.url] : [],
      status: "requires_live_revalidation",
    });
  }
  return out.sort((a, b) => (a.confidence === b.confidence ? a.company.localeCompare(b.company) : a.confidence === "high" ? -1 : 1));
}
