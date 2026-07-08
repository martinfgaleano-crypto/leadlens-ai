"use client";
import VaultResourcePage from "../_components/VaultResourcePage";

export default function Page() {
  return (
    <VaultResourcePage
      title="Vault Companies"
      description="Account-level company records with provenance. Manual entry only — no scraping, no automatic discovery."
      endpoint="/api/admin/vault-foundation/companies"
      columns={[
        { key: "name", label: "Name" }, { key: "domain", label: "Domain" },
        { key: "region", label: "Region" }, { key: "country", label: "Country" },
        { key: "industry", label: "Industry" }, { key: "vault_status", label: "Status" },
        { key: "suppression_status", label: "Suppression" }, { key: "created_at", label: "Created" },
      ]}
      createFields={[
        { key: "name", label: "Company name", required: true },
        { key: "domain", label: "Domain", placeholder: "acme.com" },
        { key: "website_url", label: "Website URL" },
        { key: "region", label: "Region" },
        { key: "country", label: "Country" },
        { key: "industry", label: "Industry" },
        { key: "company_size", label: "Company size" },
      ]}
    />
  );
}
