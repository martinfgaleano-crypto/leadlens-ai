// ─── Delivery System V1 — ExportPolicy ─────────────────────────────────────────────────────────
//
// Decides HOW a composed DeliveryDocumentV1 is expressed per output channel:
//   web = living product   (all sections, interactive)
//   pdf = snapshot artifact (fixed, print-friendly subset — no interactive-only views)
//   csv = operational data  (flat per-account rows; no narrative/portfolio sections)
// Policy is orthogonal to tier: TierComposer decides WHAT content exists; ExportPolicy decides which
// of it a channel renders. No content is added here.

export type DeliveryChannel = "web" | "pdf" | "csv";

export interface ExportSections {
  header: boolean;
  commercialContext: boolean;
  portfolioSynthesis: boolean;
  accounts: boolean;
  accountThesis: boolean;
  accountDimensions: boolean;
  accountEvidence: boolean;
  accountSources: boolean;
  accountWhatChanged: boolean;
  accountCounterSignals: boolean;
  accountValidations: boolean;
  accountNextStep: boolean;
  validationQueue: boolean;
  coverage: boolean;
  methodology: boolean;
  limitations: boolean;
}

export interface ExportPolicy {
  channel: DeliveryChannel;
  kind: "living_product" | "snapshot_artifact" | "operational_data";
  interactive: boolean;
  sections: ExportSections;
  /** Ordered operational columns for flat channels (CSV). Null for narrative channels. */
  csvColumns: readonly string[] | null;
}

const ALL_SECTIONS: ExportSections = {
  header: true, commercialContext: true, portfolioSynthesis: true, accounts: true,
  accountThesis: true, accountDimensions: true, accountEvidence: true, accountSources: true,
  accountWhatChanged: true, accountCounterSignals: true, accountValidations: true, accountNextStep: true,
  validationQueue: true, coverage: true, methodology: true, limitations: true,
};

/** Operational CSV columns — decision-oriented, flat, no outreach/score (product truth). */
export const CSV_COLUMNS = [
  "Rank", "Company", "Segment", "Geography", "Domain",
  "Decision", "Decision Note", "Fit", "Timing", "Evidence", "Confidence",
  "Evidence Sources", "Dated Evidence", "Latest Evidence Age",
  "What Changed", "Counter-signals", "Validations Pending", "Next Step",
] as const;

export const EXPORT_POLICY: Record<DeliveryChannel, ExportPolicy> = {
  web: {
    channel: "web", kind: "living_product", interactive: true,
    sections: { ...ALL_SECTIONS },
    csvColumns: null,
  },
  pdf: {
    channel: "pdf", kind: "snapshot_artifact", interactive: false,
    // A frozen artifact: the full narrative snapshot, but nothing interactive-only.
    sections: { ...ALL_SECTIONS },
    csvColumns: null,
  },
  csv: {
    channel: "csv", kind: "operational_data", interactive: false,
    // Only per-account operational rows; no header/context/synthesis/methodology prose.
    sections: {
      header: false, commercialContext: false, portfolioSynthesis: false, accounts: true,
      accountThesis: false, accountDimensions: true, accountEvidence: true, accountSources: false,
      accountWhatChanged: true, accountCounterSignals: true, accountValidations: true, accountNextStep: true,
      validationQueue: false, coverage: false, methodology: false, limitations: false,
    },
    csvColumns: CSV_COLUMNS,
  },
};

export function policyFor(channel: DeliveryChannel): ExportPolicy {
  return EXPORT_POLICY[channel];
}
