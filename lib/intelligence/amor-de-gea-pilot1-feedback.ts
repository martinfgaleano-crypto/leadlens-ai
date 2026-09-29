// Amor de Gea — REAL completed Pilot 1 customer feedback (canonical). This is the authoritative record
// so no code ever falls back to the blank feedback FORM in /public. Source: completed Pilot 1
// questionnaire, respondent Juliana Maya Zuluaga (Directora/Fundadora, Amor de Gea), September 2026,
// provided by the founder. Values below are transcribed, not inferred; do not add beyond the source.

export const AMOR_PILOT1_FEEDBACK = {
  provenance: {
    source: "completed Pilot 1 customer feedback questionnaire",
    respondent: "Juliana Maya Zuluaga",
    role: "Directora / Fundadora — Amor de Gea",
    date: "2026-09",
    note: "Founder-provided (no PDF attached); the repository /public feedback file is the BLANK instrument and is NOT the source.",
  },
  // §4 — general ratings (1–5)
  ratings: {
    overall_utility: 4,
    account_relevance: 4,
    prioritization: 5,
    action_briefs: 4,
    evidence_credibility: 4,
    context_use: 5,
    report_clarity: 5,
    confidence_next_steps: 4,
    pilot2_likelihood: 5,
    value_vs_database: 5,
  },
  valued: [
    "prioritization",
    "commercial route differentiation",
    "real Amor de Gea context",
    "cautious separation between affinity and buyer intent",
    "validation questions",
    "mechanisms of purchase",
  ],
  wants_deeper: [
    "buyer / decision-maker", "contactability", "evidence of comparable purchases", "purchase timing",
    "trigger", "potential volume", "price range", "margin", "current suppliers", "supplier onboarding",
    "active projects", "probability of repeat purchase", "next commercial step",
  ],
  // §5 — account-level feedback (all 10 considered NEW)
  accounts: {
    all_new: true,
    validate_first: ["Éteka", "Celestino Hotel Boutique & Spa", "Sinergy On", "Vitálica"],
    operational_priority_order: ["Éteka", "Vitálica", "Celestino Hotel Boutique & Spa", "Sinergy On"],
    note: "Other accounts classified Maintain / Investigate per feedback.",
  },
  // §6 — route preference ratings (1–5) — Pilot 1 (Colombia). NOT to be copied into US ranking; used as
  // customer preference/context; US evidence may change the ranking.
  route_preference_colombia: {
    hotel_spa: 5,
    natural_specialty_retail: 5,
    corporate_gifts: 4,
    distribution_other: 2,
  },
  // §7 — customer commercial priorities (become highly relevant under Colombia → US export)
  priorities: {
    price_margin: ["reasonable wholesale ranges", "channel margin", "premium comparable prices", "pilot vs recurring economics", "accounts able to sustain premium positioning"],
    capacity_moq: ["manageable pilots", "first orders compatible with capacity", "repeat potential over oversized initial orders"],
    documentation: ["channel-specific requirements", "supplier requirements", "technical/commercial sheets", "labeling", "channel conditions"],
    personalization_prefer: ["sleeve", "box", "insert", "kit", "corporate material"],
    personalization_avoid_initially: ["deep product modification", "private-label structures that increase MOQ/cost"],
    logistics_glass: ["breakage", "storage", "logistics cost", "glass-compatible channels", "dispatch/receipt conditions"],
  },
  // §8 — customer-defined minimum useful evidence (customer standard; NOT a silent redefinition of
  // canonical qualification — compared, not adopted wholesale).
  qualification_standard: [
    "active relevant company", "buyer/decision-maker identified", "purchase mechanism clear",
    "evidence of buying comparable products", "concrete Amor de Gea use case", "identifiable trigger/timing",
    "reasonable pilot size/volume", "verifiable next commercial step",
  ],
  continuation: { pilot2_willingness: "high (5/5 likelihood)", monitoring_preference: "see feedback form section J" },
} as const;
