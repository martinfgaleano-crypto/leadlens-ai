// LinkedIn provider — placeholder for future implementation.
// Returns empty results until the LinkedIn integration is built.

import type { SourceProvider, SourceSearchParams, StandardLead } from "./source-provider";

export const linkedinProvider: SourceProvider = {
  name:   "linkedin",
  label:  "LinkedIn",
  active: false,

  async search(_params: SourceSearchParams): Promise<StandardLead[]> {
    // Not yet implemented.
    return [];
  },
};
