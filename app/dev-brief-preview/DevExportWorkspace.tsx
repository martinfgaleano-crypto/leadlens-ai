"use client";
// DEV-ONLY client boundary for the visual-smoke harness. A Server Component cannot hand a function
// (getToken) to a Client Component, so the dev preview passes plain serializable props (vm/memory/
// jobId/tier) and this client wrapper builds the ExportContext here. getToken reads the live session
// if any and otherwise returns null — the harness is for layout/label QA, not a live download.
import OpportunityWorkspace from "@/components/deliverable/OpportunityWorkspace";
import type { DeliverableViewModel } from "@/lib/deliverable/deliverable-view-model";
import type { DeliveryTier } from "@/lib/delivery-system/tier-composer";
import type { PremiumContextV1 } from "@/lib/intelligence/premium/premium-context";

// Kept structurally identical to the real /results/[jobId]/brief wiring so the dev smoke exercises the
// same integration path (only the token source differs — dev usually has no session).
async function devToken(): Promise<string | null> {
  try {
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseClient();
    return supabase ? (await supabase.auth.getSession()).data.session?.access_token ?? null : null;
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DevExportWorkspace({ vm, memory, jobId, tier, premiumContext }: { vm: DeliverableViewModel; memory?: any; jobId: string; tier: DeliveryTier; premiumContext?: PremiumContextV1 | null }) {
  return <OpportunityWorkspace vm={vm} memory={memory} exportContext={{ jobId, tier, getToken: devToken }} premiumContext={premiumContext} />;
}
