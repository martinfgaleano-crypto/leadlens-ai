"use client";
import VaultResourcePage from "../_components/VaultResourcePage";

export default function Page() {
  return (
    <VaultResourcePage
      title="Vault Contacts"
      description="Contacts stored only with permitted sourcing. usage_rights_status is mandatory context — no automatic email discovery, internal use only."
      endpoint="/api/admin/vault-foundation/contacts"
      columns={[
        { key: "full_name", label: "Name" }, { key: "title", label: "Title" },
        { key: "email", label: "Email" }, { key: "usage_rights_status", label: "Usage rights" },
        { key: "review_status", label: "Review" }, { key: "vault_status", label: "Status" },
        { key: "suppression_status", label: "Suppression" }, { key: "region", label: "Region" },
      ]}
      emptyHint="Contacts live here only when sourcing is permitted and usage rights are tracked. Most contacts arrive through candidate intake alongside their company — never through automatic discovery."
      createFields={[
        { key: "full_name", label: "Full name" },
        { key: "title", label: "Title" },
        { key: "email", label: "Email" },
        { key: "company_id", label: "Company ID (uuid)" },
        { key: "region", label: "Region" },
        { key: "country", label: "Country" },
        { key: "usage_rights_status", label: "Usage rights", options: ["unverified", "permitted", "licensed", "restricted"] },
      ]}
    />
  );
}
