import AdminLayout from "@/app/admin/_components/AdminLayout";
import Pilot2Workspace from "./Pilot2Workspace";
import { loadLatestPilotContext, loadPilotFeedback } from "@/lib/pilot/pilot-store";

// Dedicated Amor de Gea Pilot 2 (US export) Admin workspace. Standalone route so the hardcoded Pilot 1
// workspace stays intact (§57). Admin-gated by AdminLayout + middleware (/admin/*). Reads DURABLE state
// (migration 065) when available and falls back to the static modules otherwise (store degrades gracefully).
export const metadata = { title: "Pilot 2 — Amor de Gea (US export)" };
export const dynamic = "force-dynamic";

export default async function Pilot2Page() {
  const [ctx, feedback] = await Promise.all([
    loadLatestPilotContext("amor-de-gea").catch(() => null),
    loadPilotFeedback("amor-de-gea").catch(() => []),
  ]);
  const durable = {
    contextConfirmed: ctx?.confirmation_state === "confirmed",
    contextUpdatedAt: ctx?.updated_at ?? null,
    contextSummary: ctx?.bounded_summary ?? null,
    contextVersion: ctx?.schema_version ?? null,
    feedbackCount: Array.isArray(feedback) ? feedback.length : 0,
  };
  return <AdminLayout><Pilot2Workspace durable={durable} /></AdminLayout>;
}
