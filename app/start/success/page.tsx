import { redirect } from "next/navigation";

// Retired pre-auth request confirmation. New authenticated setup has one
// canonical completion destination: the customer dashboard.
export default function StartSuccessPage() {
  redirect("/dashboard");
}
