"use client";
import VaultResourcePage from "../_components/VaultResourcePage";

export default function Page() {
  return (
    <VaultResourcePage
      title="Vault Sources"
      description="Provenance records: where data came from and what we may do with it. Every Vault record should trace back here."
      endpoint="/api/admin/vault-foundation/sources"
      columns={[
        { key: "source_type", label: "Type" }, { key: "source_url", label: "URL" },
        { key: "source_title", label: "Title" }, { key: "usage_rights_status", label: "Usage rights" },
        { key: "confidence_score", label: "Confidence" }, { key: "freshness_status", label: "Freshness" },
        { key: "created_at", label: "Created" },
      ]}
      emptyHint="Every Vault record traces back to a source: where it came from, when, and what we may do with it. Sources are usually created automatically by candidate intake."
      createFields={[
        { key: "source_type", label: "Source type", required: true, options: ["customer_provided", "company_website", "public_directory", "public_job_post", "public_event", "public_news", "business_registry", "licensed_provider", "other_public"] },
        { key: "source_url", label: "Source URL", required: true },
        { key: "source_title", label: "Title" },
        { key: "confidence_score", label: "Confidence (0-100)", type: "number" },
        { key: "usage_rights_status", label: "Usage rights", options: ["unverified", "permitted", "licensed", "restricted"] },
        { key: "notes", label: "Notes" },
      ]}
    />
  );
}
