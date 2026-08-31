import { redirect } from "next/navigation";

// The canonical Vault surface is now /admin/vault. This legacy route (which previously carried
// "manual intake only / Apollo compliance" framing that misrepresented the working automatic
// accretion) permanently redirects to it.
export default function VaultFoundationRedirect() {
  redirect("/admin/vault");
}
