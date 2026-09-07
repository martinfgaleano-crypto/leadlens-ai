// ─── Delivery System V1 — tier × channel availability ──────────────────────────────────────────
// WHICH export channels each product tier is offered. Distinct from ExportPolicy (which shapes a
// channel's content): this decides whether a channel is offered at all for a tier. Server-authoritative
// — the customer surface exposes only permitted channels; the export routes deny the rest.
//   web:  all tiers (the living product)
//   pdf:  all tiers (a full snapshot artifact — every tier can download its report)
//   csv:  intelligence + premium only (operational portfolio data; preview/brief are not data exports)
import type { DeliveryTier } from "@/lib/delivery-system/tier-composer";
import type { DeliveryChannel } from "@/lib/delivery-system/export-policy";

export const CHANNEL_AVAILABILITY: Record<DeliveryTier, readonly DeliveryChannel[]> = {
  preview: ["web", "pdf"],
  brief: ["web", "pdf"],
  intelligence: ["web", "pdf", "csv"],
  premium: ["web", "pdf", "csv"],
};

export function tierOffersChannel(tier: DeliveryTier, channel: DeliveryChannel): boolean {
  return CHANNEL_AVAILABILITY[tier].includes(channel);
}

export function isDeliveryTier(v: string | null | undefined): v is DeliveryTier {
  return v === "preview" || v === "brief" || v === "intelligence" || v === "premium";
}

/** Channels offered for a tier, in display order. */
export function offeredChannels(tier: DeliveryTier): readonly DeliveryChannel[] {
  return CHANNEL_AVAILABILITY[tier];
}
