// ─── Manual provider (v0 default) ─────────────────────────────────────────────
// The admin supplies source URLs + pasted context; this provider structures
// them into findings WITHOUT any network fetch — no scraping, ever.
//
// Extraction heuristic v0: the pasted context is treated as the evidence
// snippet for a single candidate per source. Company details come from the
// generation request (the admin names the company alongside the source) or
// are parsed conservatively from the context's first line when it follows
// "Company — evidence" form. Anything ambiguous stays empty for admin review.

import type {
  LeadHunterBrief,
  LeadHunterDiscoveryProvider,
  LeadHunterFinding,
  LeadHunterSourceEvidence,
  LeadHunterSourceInput,
} from "@/lib/lead-hunter/lead-hunter-types";

function parseCompanyFromContext(context: string | null): { company?: string; rest?: string } {
  if (!context) return {};
  const firstLine = context.split("\n")[0]?.trim() ?? "";
  // "Acme Corp — opened a new plant in Medellín" / "Acme Corp: raised Series A"
  const m = firstLine.match(/^([^—:–-]{2,80})[—:–-]\s*(.+)$/);
  if (m && m[1].trim().length >= 2) {
    return { company: m[1].trim(), rest: m[2]?.trim() };
  }
  return {};
}

export const manualProvider: LeadHunterDiscoveryProvider = {
  provider_id: "manual",
  mode: "manual_sources",

  // Manual mode never discovers sources on its own.
  async searchSources(_brief: LeadHunterBrief, _max: number): Promise<LeadHunterSourceEvidence[]> {
    return [];
  },

  async extractCandidatesFromSource(
    source: LeadHunterSourceInput,
    brief: LeadHunterBrief | null,
  ): Promise<LeadHunterFinding[]> {
    const parsed = parseCompanyFromContext(source.pasted_context);
    if (!parsed.company) {
      // No confident company name — do not invent one. The run detail UI tells
      // the admin to use the "Company — evidence" format or the intake form.
      return [];
    }
    return [{
      company_name: parsed.company,
      region: brief?.region ?? undefined,
      country: brief?.country ?? undefined,
      industry: brief?.industry ?? undefined,
      signal_summary: parsed.rest ?? source.pasted_context?.slice(0, 200) ?? undefined,
      evidence_snippet: source.pasted_context?.slice(0, 600) ?? undefined,
      source: {
        source_url: source.source_url,
        source_title: source.source_title ?? undefined,
        source_category: source.source_category,
        usage_rights_status: source.usage_rights_status,
      },
    }];
  },
};
