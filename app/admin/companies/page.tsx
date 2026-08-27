import { redirect } from "next/navigation";

/** Legacy company_profiles represented contact-era aggregation and cannot be
 * presented as canonical Account Intelligence. The durable account universe is
 * operated from Lead Hunter; verified reusable evidence lives in Vault. */
export default function LegacyCompaniesRedirect() {
  redirect("/admin/lead-hunter");
}
