// ─── Delivery System V1 — Web renderer contract (living product) ───────────────────────────────
// The interactive "living product" channel. Rather than a static string, the web consumes a section
// model derived from the SAME PresentationModel as PDF/CSV — one document + tier + policy, three
// outputs. A React surface renders these sections in order; only present sections appear. This keeps
// the web on the canonical pipeline instead of an ad-hoc view path.
import type { PresentationModel } from "@/lib/delivery-system/presentation-model";
import type { DeliveryDocumentV1 } from "@/lib/delivery-system/delivery-document";

export type WebSectionKind =
  | "header" | "commercialContext" | "portfolioSynthesis" | "accounts"
  | "validationQueue" | "coverage" | "methodology" | "limitations";

export interface WebSection { kind: WebSectionKind; present: boolean; }

export interface WebPresentation {
  tier: PresentationModel["tier"];
  tierLabel: string;
  interactive: boolean;
  document: DeliveryDocumentV1;
  /** Ordered sections; render only those with present=true. */
  sections: WebSection[];
}

/** Build the web section model from a channel="web" PresentationModel. Present = policy allows the
 *  section AND the document actually has content for it (no empty shells rendered). */
export function toWebPresentation(pm: PresentationModel): WebPresentation {
  const d = pm.document;
  const s = pm.policy.sections;
  const has = {
    header: s.header && (Boolean(d.headline) || Boolean(d.summary) || Boolean(d.meta.client)),
    commercialContext: s.commercialContext && Boolean(d.commercialContext),
    portfolioSynthesis: s.portfolioSynthesis && d.portfolioSynthesis.total > 0,
    accounts: s.accounts && d.accounts.length > 0,
    validationQueue: s.validationQueue && d.validationQueue.length > 0,
    coverage: s.coverage && Boolean(d.coverage),
    methodology: s.methodology && d.methodology.length > 0,
    limitations: s.limitations && d.limitations.length > 0,
  };
  const order: WebSectionKind[] = ["header", "commercialContext", "portfolioSynthesis", "accounts", "validationQueue", "coverage", "methodology", "limitations"];
  return {
    tier: pm.tier, tierLabel: pm.tierLabel, interactive: pm.interactive, document: d,
    sections: order.map((kind) => ({ kind, present: has[kind] })),
  };
}
