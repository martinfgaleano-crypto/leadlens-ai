// Google Maps provider — placeholder for future implementation.
// Returns empty results until the Google Places API integration is built.

import type { SourceProvider, SourceSearchParams, StandardLead } from "./source-provider";

export const googleMapsProvider: SourceProvider = {
  name:   "google_maps",
  label:  "Google Maps",
  active: false,

  async search(_params: SourceSearchParams): Promise<StandardLead[]> {
    // Not yet implemented.
    return [];
  },
};
