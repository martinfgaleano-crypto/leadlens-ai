"use client";
import VaultResourcePage from "../_components/VaultResourcePage";

export default function Page() {
  return (
    <VaultResourcePage
      title="Vault Signals"
      description="Buying/timing signals tied to a source. Source URL + type are required on intake — never invent dates or freshness."
      endpoint="/api/admin/vault-foundation/signals"
      columns={[
        { key: "signal_type", label: "Type" }, { key: "signal_summary", label: "Summary" },
        { key: "signal_date", label: "Signal date" }, { key: "strength_score", label: "Strength" },
        { key: "confidence_score", label: "Confidence" }, { key: "review_status", label: "Review" },
      ]}
      emptyHint="Signals are the timing evidence (hiring, expansion, funding…) that make an account worth contacting NOW. Each one needs a source — add them via candidate intake or manually with a source ID."
      createFields={[
        { key: "signal_type", label: "Signal type", required: true, options: ["hiring", "expansion", "funding", "product_launch", "leadership_change", "event_participation", "regulatory", "other"] },
        { key: "signal_summary", label: "Summary" },
        { key: "company_id", label: "Company ID (uuid)" },
        { key: "source_id", label: "Source ID (uuid)" },
        { key: "signal_date", label: "Signal date", type: "date" },
        { key: "confidence_score", label: "Confidence (0-100)", type: "number" },
      ]}
    />
  );
}
