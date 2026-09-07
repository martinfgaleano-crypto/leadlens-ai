// Shared render helpers for the Delivery System renderers. Pure; no content invented.
import type { AccountBriefVM, Strength } from "@/lib/delivery-system/delivery-document";
import type { PresentationModel } from "@/lib/delivery-system/presentation-model";

/** Ordinal value of a named dimension (Fit / Timing / Evidence) on an account, or null. */
export function dimensionValue(a: AccountBriefVM, label: string): Strength | null {
  const d = a.dimensions.find((x) => x.label.toLowerCase() === label.toLowerCase());
  return d ? d.value : null;
}

/** A safe, stable download filename for a presentation: leadlens-<client>-<tier>-<channel>.<ext>. */
export function deliveryFilename(pm: PresentationModel, ext: string): string {
  const slug = (pm.document.meta.client ?? "leadlens").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "leadlens";
  return `leadlens-${slug}-${pm.tier}-${pm.channel}.${ext}`;
}

/** Minimal HTML escaping for the PDF/snapshot renderer. */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
