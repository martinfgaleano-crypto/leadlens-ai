import type { LeadCandidate, EnrichedLead, LeadSearchCriteria, EmailFindResult } from "@/types";

/**
 * Interface all lead providers must implement.
 * Optional methods are used when the provider supports enrichment or email finding.
 */
export interface LeadProvider {
  /** Unique name for logging and selection */
  name: string;

  /** Find and return lead candidates matching criteria. Returns up to `limit` results. */
  searchLeads(criteria: LeadSearchCriteria, limit: number): Promise<LeadCandidate[]>;

  /** Optional: enrich a candidate with additional company/role data */
  enrichLead?(
    candidate: LeadCandidate,
    criteria: LeadSearchCriteria
  ): Promise<Partial<EnrichedLead>>;

  /** Optional: find and verify email for a candidate */
  findEmail?(candidate: LeadCandidate): Promise<EmailFindResult>;
}
