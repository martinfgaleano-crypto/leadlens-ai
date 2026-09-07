// ─── Delivery System V1 — server-authoritative viewer bridge ───────────────────────────────────
// The ONE server entry that turns an authenticated request for a completed report into a canonical
// DeliveryDocumentV1 + server-resolved tier. It reuses the proven ownership gate (getBriefForViewer:
// owner-only, cross-tenant denied, sign-in required) and the proven assembler/adapter — it starts
// from an IMMUTABLE completed snapshot, so it runs NO Intelligence research and consumes NO credit.
// The tier comes from the server-resolved ReportExperience; the client can never choose or escalate it.
import { getBriefForViewer } from "@/app/results/[jobId]/brief/actions";
import { fromInstitutionalReport } from "@/lib/deliverable/adapters";
import { fromDeliverableViewModel, type DeliveryDocumentV1 } from "@/lib/delivery-system/delivery-document";
import { isDeliveryTier } from "@/lib/delivery-system/channel-availability";
import type { DeliveryTier } from "@/lib/delivery-system/tier-composer";

export type ViewerDeliverable =
  | { ok: true; document: DeliveryDocumentV1; tier: DeliveryTier }
  | { ok: false; status: 401 | 403 | 404 };

export async function deliverableForViewer(jobId: string, accessToken: string | null): Promise<ViewerDeliverable> {
  const brief = await getBriefForViewer(jobId, accessToken);
  if (brief.state === "signin_required") return { ok: false, status: 401 };
  if (brief.state === "forbidden") return { ok: false, status: 403 };
  if (brief.state !== "ok") return { ok: false, status: 404 }; // unavailable / processing — never confirms existence
  const vm = fromInstitutionalReport(brief.report, brief.experience);
  const document = fromDeliverableViewModel(vm);
  // Server-authoritative tier (from the resolved product experience). Defensive fallback only.
  const tier: DeliveryTier = isDeliveryTier(brief.experience.tier) ? brief.experience.tier : "intelligence";
  return { ok: true, document, tier };
}
