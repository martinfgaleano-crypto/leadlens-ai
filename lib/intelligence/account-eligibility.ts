// ─── Account eligibility gate (account-eligibility-v1) ────────────────────────
//
// A structural gate that runs BEFORE customer-facing selection (§4): a company that
// is not a plausible BUYER / CHANNEL for the customer's objective must not consume a
// deliverable slot merely as HOLD. This is an internal eligibility outcome (EXCLUDE),
// never a public decision tier.
//
// It is CONSERVATIVE by design — it excludes only clear structural mismatches so it
// never drops a legitimate account:
//   • an offer-side PRODUCER / BRAND / MANUFACTURER that resells nothing (a peer of
//     the customer, not a buyer of its product), and
//   • a company whose resolved country is clearly outside the objective geography.
// A company that manufactures AND also distributes/retails/imports (a real channel)
// stays eligible. Ambiguity resolves to RESEARCH_MORE and cannot consume a paid slot.
//
// Pure and deterministic. The honest role signal is the RESEARCH summary, not the
// discovery route label (which is often the query family, not the company's role).

export type EligibilityOutcome = "eligible" | "research_more" | "exclude";

export interface EligibilityInput {
  company: string;
  industry?: string | null;
  country?: string | null;
  /** Research-derived company summary — the authoritative role signal. */
  companySummary?: string | null;
}

export interface EligibilityResult {
  outcome: EligibilityOutcome;
  reason: string | null;   // e.g. OFFER_SIDE_PRODUCER_NOT_BUYER, WRONG_GEOGRAPHY
}

// OWN-PRODUCT seller (offer-side, a peer of the customer): describes itself as a
// singular "<category> brand" or a company that makes/sells ITS OWN product. Note the
// singular \bbrand\b — a channel "connecting food and beverage BRANDS" (plural) is NOT
// matched. These are phrasings a buyer/retailer/distributor never uses of itself.
const OWN_PRODUCT_SELLER = /\b(food|beverage|natural|organic|premium|snack|cpg|chocolate|granola|wellness|botanical|specialty)\s+brand\b|\bproduct brand\b|manufactures its own|makes its own|direct[- ]to[- ]consumer|\bd2c\b|\bdtc\b|sells (its products|direct)|selling into retail|sells[^.]{0,40}through[^.]{0,25}retail channels|made with[^.]{0,60}(ingredients|fair[- ]trade|regenerativ)/i;
// A CHANNEL FOR OTHERS (buys/carries/distributes/represents OTHER brands, or operates
// retail/hospitality). Presence of any keeps an otherwise offer-side entity eligible.
const CHANNEL_FOR_OTHERS = /connecting[^.]*brands|distributes?[^.]*brands|carries|stocks|assortment|intermediary between producers|imports?[^.]*brands|platform[^.]*brands|(grocery|specialty|premium|natural|gourmet|regional)\s+(retailer|grocer|store|market|chain)|\bretailer\b|\bimporter\b|operating (multiple |several |\d)[^.]*(stores|locations|properties|resorts|spas)|distributor (whose|of natural|of premium|offering|providing|serving)|natural products distributor|hospitality|\bhotel\b|resort|\bspa\b|wholesaler|vendor (application|onboarding|portal)/i;

export function assessAccountEligibility(a: EligibilityInput, opts: { geographies?: string[] } = {}): EligibilityResult {
  // Clearly-foreign resolved country (guards homonyms / wrong-market entities).
  const geos = (opts.geographies ?? []).map((g) => g.toLowerCase());
  const country = (a.country ?? "").trim().toLowerCase();
  if (country && geos.length) {
    const inTarget = geos.some((g) => country.includes(g) || g.includes(country) || (g === "united states" && /^(us|usa|u\.s\.?)$/.test(country)));
    if (!inTarget) return { outcome: "exclude", reason: "WRONG_GEOGRAPHY" };
  }
  // The RESEARCH SUMMARY is the authoritative role signal — the industry field is the
  // discovery ROUTE (query family), which frequently mislabels a brand as a "grocery
  // chain". Offer-side signal may come from either; the CHANNEL (reselling) role is
  // credited ONLY from the summary, so a wrong route label can't rescue a producer.
  const summary = (a.companySummary ?? "").trim();
  if (!summary) return { outcome: "research_more", reason: "ROLE_NOT_ESTABLISHED" };
  const ownProductSeller = OWN_PRODUCT_SELLER.test(summary);
  const channelForOthers = CHANNEL_FOR_OTHERS.test(summary);
  if (ownProductSeller && !channelForOthers) {
    return { outcome: "exclude", reason: "OFFER_SIDE_PRODUCER_NOT_BUYER" };
  }
  if (!channelForOthers && !ownProductSeller) {
    return { outcome: "research_more", reason: "COMMERCIAL_ROLE_AMBIGUOUS" };
  }
  return { outcome: "eligible", reason: null };
}
