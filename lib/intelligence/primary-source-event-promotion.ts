import type { ProcessedLead } from "@/types";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";
import { resolvePublicationDate } from "@/lib/sources/access/date-resolver";

export interface PromotedPrimaryEvent {
  url: string;
  sourceHost: string;
  eventDate: string;
  kind: string;
  excerpt: string;
}

function firstSourceBlock(raw: string): string {
  return raw.split(/\s+\|\s+\[\d{4}-\d{2}-\d{2}T/)[0]?.trim() ?? "";
}

function mentionsCompany(company: string, text: string): boolean {
  const normalized = company.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return normalized.length >= 4 && new RegExp(`(^|[^a-z0-9])${normalized}([^a-z0-9]|$)`, "i").test(text);
}

/**
 * Recover a material event only from the candidate's PRIMARY fetched page.
 * This is deterministic and deliberately ignores LLM evidence claims: the page
 * itself must name the account, contain a trigger construction and expose a
 * defensible publication/event date. It repairs handoffs where discovery kept
 * the page but lost its structured date; it cannot turn generic fit into Timing.
 */
export function promotePrimarySourceEvent(lead: ProcessedLead): PromotedPrimaryEvent | null {
  const c = lead.candidate;
  if (c.signal_date || !c.source_url || !c.raw_context) return null;
  const block = firstSourceBlock(c.raw_context);
  if (!block || !mentionsCompany(c.company, block)) return null;
  const kind = classifySignalKind(block);
  const materiality = classifyMateriality(block);
  if (!kind.can_trigger || materiality.level === "low") return null;
  const resolved = resolvePublicationDate({ provider_date: null, html: block, url: c.source_url });
  if (!resolved.date) return null;
  let host = "";
  try { host = new URL(c.source_url).hostname.replace(/^www\./, ""); } catch { return null; }
  c.signal_date = resolved.date;
  c.signal_type = kind.kind;
  const telemetry = lead.enrichment.account_research;
  if (telemetry) {
    const events = telemetry.validated_events ?? (telemetry.validated_events = []);
    if (!events.some((e) => e.url === c.source_url && e.event_date === resolved.date)) events.push({
      url: c.source_url, source_host: host, event_date: resolved.date, kind: kind.kind,
      claim_excerpt: block.slice(0, 260), stage: "primary_source_recovery",
      materiality_valid: true, counterevidence: false,
    });
  }
  return { url: c.source_url, sourceHost: host, eventDate: resolved.date, kind: kind.kind, excerpt: block.slice(0, 260) };
}
