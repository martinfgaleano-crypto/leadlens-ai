import ContextIntake from "./ContextIntake";

// Customer Context Intake — reusable product surface (guided + AI-assisted). Standalone page using the
// canonical intake schema; not a separate app. Persist/run wire-up is the next step.
export const metadata = { title: "Customer Context — LeadLens" };

export default function ContextIntakePage() {
  return <ContextIntake />;
}
