// Apollo provider — wraps the existing apollo/client without modifying it.
// This is the only active provider; all others return empty arrays.

import type { SourceProvider, SourceSearchParams, StandardLead } from "./source-provider";
import { searchPeople } from "@/lib/apollo/client";

export const apolloProvider: SourceProvider = {
  name:   "apollo",
  label:  "Apollo.io",
  active: true,

  async search(params: SourceSearchParams): Promise<StandardLead[]> {
    const result = await searchPeople(params);
    return result.results.map(r => ({
      company_name: r.company_name,
      contact_name: r.contact_name,
      title:        r.title,
      email:        r.email,
      linkedin_url: r.linkedin_url,
      website:      r.website,
      country:      r.country,
      source:       "apollo",
    }));
  },
};
