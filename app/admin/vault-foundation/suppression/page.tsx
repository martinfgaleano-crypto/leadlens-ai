"use client";
import VaultResourcePage from "../_components/VaultResourcePage";

export default function Page() {
  return (
    <VaultResourcePage
      title="Vault Suppression"
      description="Opt-out / deletion / do-not-use entries. Checked before any Vault record is used — reason is required."
      endpoint="/api/admin/vault-foundation/suppression"
      columns={[
        { key: "suppression_type", label: "Type" }, { key: "value", label: "Value" },
        { key: "reason", label: "Reason" }, { key: "source", label: "Source" },
        { key: "created_at", label: "Created" },
      ]}
      createFields={[
        { key: "suppression_type", label: "Type", required: true, options: ["email", "domain", "company"] },
        { key: "value", label: "Value", required: true, placeholder: "person@acme.com or acme.com" },
        { key: "reason", label: "Reason", required: true },
        { key: "source", label: "Request source" },
      ]}
    />
  );
}
