// Source provider interface — implemented by every lead source adapter.
// Server-side only.

export interface StandardLead {
  company_name: string;
  contact_name: string | null;
  title:        string | null;
  email:        string | null;
  linkedin_url: string | null;
  website:      string | null;
  country:      string | null;
  source:       string;
}

export interface SourceSearchParams {
  job_titles:    string[];
  industries:    string[];
  company_sizes: string[];
  countries:     string[];
  keywords:      string[];
  limit:         number;
}

export interface SourceProvider {
  /** Unique machine-readable name matching lead_sources.name */
  readonly name: string;
  /** Human-readable label */
  readonly label: string;
  /** Whether this provider is implemented and ready to call */
  readonly active: boolean;
  /** Execute a lead search and return standardized results */
  search(params: SourceSearchParams): Promise<StandardLead[]>;
}
