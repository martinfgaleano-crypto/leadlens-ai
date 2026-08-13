import { redirect } from "next/navigation";

// Billing is closed. A public success URL must not claim that payment, an
// order, or analysis exists. Future checkout activation will replace this
// boundary with a server-verified checkout result before rendering success.
export default function SuccessPage() {
  redirect("/dashboard");
}
