// Directories provider — placeholder for future implementation.
// Covers Yelp, Yellow Pages, and similar business directory sources.

import type { SourceProvider, SourceSearchParams, StandardLead } from "./source-provider";

export const directoryProvider: SourceProvider = {
  name:   "directories",
  label:  "Directories",
  active: false,

  async search(_params: SourceSearchParams): Promise<StandardLead[]> {
    // Not yet implemented.
    return [];
  },
};
