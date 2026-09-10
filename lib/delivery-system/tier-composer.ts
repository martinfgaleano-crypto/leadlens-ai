// ─── Delivery System V1 — TierComposer ─────────────────────────────────────────────────────────
//
// Decides WHAT of the canonical DeliveryDocumentV1 a given product tier receives: how many accounts,
// how deep each account dossier goes, and which portfolio-level sections are included. It only
// FILTERS/TRIMS the canonical document — it never adds content, changes a Decision, or invents
// Evidence. Output is a DeliveryDocumentV1 (same schema) shaped for the tier.

import {
  type DeliveryDocumentV1, type AccountBriefVM, recountPortfolio, buildPremiumDeliverySection,
} from "@/lib/delivery-system/delivery-document";

export type DeliveryTier = "preview" | "brief" | "intelligence" | "premium";
export type DossierDepth = "mini" | "standard" | "full";

export interface TierSections {
  commercialContext: boolean;
  portfolioSynthesis: boolean;
  allocation: boolean;
  validationQueue: boolean;
  whatChanged: boolean;
  compare: boolean;
  coverage: boolean;
  methodology: boolean;
  /** Premium-only: the deterministic decision-architecture layer (synthesis/pathways/briefs/exec). */
  premiumArchitecture: boolean;
}

export interface TierComposition {
  label: string;
  /** Account cap for the tier's deliverable (null = no cap). Mirrors the catalog operating limits. */
  maxAccounts: number | null;
  dossierDepth: DossierDepth;
  sections: TierSections;
}

// Mirrors the frozen catalog operating limits (Preview 2 / Brief 6 / Intelligence 12 / Premium 18)
// and value progression (mini verdict → comparable set → prioritized portfolio → defensible strategy).
export const TIER_COMPOSITION: Record<DeliveryTier, TierComposition> = {
  preview: {
    label: "Preview", maxAccounts: 2, dossierDepth: "mini",
    sections: { commercialContext: false, portfolioSynthesis: true, allocation: false, validationQueue: false, whatChanged: false, compare: false, coverage: false, methodology: false, premiumArchitecture: false },
  },
  brief: {
    label: "Brief", maxAccounts: 6, dossierDepth: "standard",
    sections: { commercialContext: true, portfolioSynthesis: true, allocation: false, validationQueue: true, whatChanged: true, compare: false, coverage: true, methodology: false, premiumArchitecture: false },
  },
  intelligence: {
    label: "Intelligence", maxAccounts: 12, dossierDepth: "full",
    sections: { commercialContext: true, portfolioSynthesis: true, allocation: true, validationQueue: true, whatChanged: true, compare: true, coverage: true, methodology: true, premiumArchitecture: false },
  },
  premium: {
    label: "Premium", maxAccounts: 18, dossierDepth: "full",
    // Premium ADDS the deterministic decision-architecture on top of everything Portfolio receives.
    sections: { commercialContext: true, portfolioSynthesis: true, allocation: true, validationQueue: true, whatChanged: true, compare: true, coverage: true, methodology: true, premiumArchitecture: true },
  },
};

/** Trim one account dossier to the tier depth. Returns a copy; never fabricates. mini = "small but
 *  complete" — the full LeadLens signature at concise depth (Decision + Fit/Timing/Evidence + one-line
 *  why + the single most important thing to validate + one uncertainty + up to 2 sources), reserving the
 *  full narrative for standard+. standard = full narrative minus the deep validation/monitor internals;
 *  full = everything. Preview must read as a complete small verdict, NOT a stripped Brief (§Preview). */
export function composeAccountForDepth(a: AccountBriefVM, depth: DossierDepth): AccountBriefVM {
  if (depth === "full") return a;
  if (depth === "standard") {
    return { ...a, validationDetails: undefined, monitorIdentity: null };
  }
  // mini (Preview): keep the decision rationale (decisionNote), Fit/Timing/Evidence, the evidence
  // summary, and a BOUNDED "what's uncertain / what to validate next" — the Preview signature — while
  // dropping the fuller narrative (thesis, What-Changed, next step, deep internals). No invention:
  // every retained field already exists on the account; Preview simply shows a concise, complete slice.
  return {
    ...a,
    thesis: null, whyItMatters: null,
    whatChanged: [],                                   // Preview is a first look — no prior-state comparison
    counterSignals: a.counterSignals.slice(0, 1),      // one genuine uncertainty (UNKNOWN != negative)
    limitations: a.limitations.slice(0, 1),
    validations: a.validations.slice(0, 1),             // the single most important thing to validate next
    validationDetails: undefined,
    nextStep: null, revisitWhen: null, monitorIdentity: null,
    sources: a.sources.slice(0, 2),
  };
}

/** Compose the canonical document for a tier: cap accounts (attention order is applied upstream),
 *  trim dossier depth, gate portfolio sections, and RECOUNT the synthesis from the surviving accounts
 *  so numbers stay truthful. */
export function composeForTier(doc: DeliveryDocumentV1, tier: DeliveryTier): DeliveryDocumentV1 {
  const c = TIER_COMPOSITION[tier];
  const capped = c.maxAccounts == null ? doc.accounts : doc.accounts.slice(0, c.maxAccounts);
  const accounts = capped.map((a) => {
    const trimmed = composeAccountForDepth(a, c.dossierDepth);
    return c.sections.whatChanged ? trimmed : { ...trimmed, whatChanged: [] };
  });

  const counts = recountPortfolio(accounts);
  return {
    ...doc,
    portfolioSynthesis: {
      ...doc.portfolioSynthesis,
      total: accounts.length,
      counts,
      allocation: c.sections.allocation ? doc.portfolioSynthesis.allocation : null,
      funnel: c.sections.portfolioSynthesis ? doc.portfolioSynthesis.funnel : null,
      note: c.sections.portfolioSynthesis ? doc.portfolioSynthesis.note : null,
    },
    accounts,
    commercialContext: c.sections.commercialContext ? doc.commercialContext : null,
    validationQueue: c.sections.validationQueue ? doc.validationQueue.filter((q) => accounts.some((a) => a.id === q.accountId)) : [],
    coverage: c.sections.coverage ? doc.coverage : null,
    methodology: c.sections.methodology ? doc.methodology : [],
    // Premium-only: build the deterministic decision-architecture from the surviving (tier-capped)
    // accounts + any persisted research context. null for every other tier — Portfolio is unchanged.
    premium: c.sections.premiumArchitecture ? buildPremiumDeliverySection(accounts, doc.premiumContext ?? null) : null,
  };
}
