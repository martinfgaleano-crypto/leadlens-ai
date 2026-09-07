// ─── Delivery System V1 — PresentationModel ────────────────────────────────────────────────────
//
// The single channel-ready model that Web / PDF / CSV renderers consume. It applies the TierComposer
// (what content the tier gets) and then the ExportPolicy (which of it this channel renders), yielding
// one tier+channel-resolved DeliveryDocumentV1 plus channel metadata. Renderers never re-derive tier
// or policy — they render the model.

import { composeForTier, TIER_COMPOSITION, type DeliveryTier } from "@/lib/delivery-system/tier-composer";
import { policyFor, type DeliveryChannel, type ExportPolicy } from "@/lib/delivery-system/export-policy";
import type { DeliveryDocumentV1 } from "@/lib/delivery-system/delivery-document";

export interface PresentationModel {
  channel: DeliveryChannel;
  tier: DeliveryTier;
  tierLabel: string;
  kind: ExportPolicy["kind"];
  interactive: boolean;
  policy: ExportPolicy;
  /** Tier-composed AND channel-gated canonical document, ready to render directly. */
  document: DeliveryDocumentV1;
}

export function toPresentationModel(doc: DeliveryDocumentV1, tier: DeliveryTier, channel: DeliveryChannel): PresentationModel {
  const composed = composeForTier(doc, tier);
  const policy = policyFor(channel);
  const s = policy.sections;
  // Channel gating on top of tier composition: a section renders only if BOTH the tier included it
  // AND the channel policy renders it.
  const gated: DeliveryDocumentV1 = {
    ...composed,
    commercialContext: s.commercialContext ? composed.commercialContext : null,
    validationQueue: s.validationQueue ? composed.validationQueue : [],
    coverage: s.coverage ? composed.coverage : null,
    methodology: s.methodology ? composed.methodology : [],
    limitations: s.limitations ? composed.limitations : [],
  };
  return {
    channel, tier, tierLabel: TIER_COMPOSITION[tier].label,
    kind: policy.kind, interactive: policy.interactive, policy, document: gated,
  };
}

/** Build all three channel presentations from one document + tier (single source, three outputs). */
export function presentAllChannels(doc: DeliveryDocumentV1, tier: DeliveryTier): Record<DeliveryChannel, PresentationModel> {
  return {
    web: toPresentationModel(doc, tier, "web"),
    pdf: toPresentationModel(doc, tier, "pdf"),
    csv: toPresentationModel(doc, tier, "csv"),
  };
}
