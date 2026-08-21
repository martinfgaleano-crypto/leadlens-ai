# LeadLens — Evidence-Complete Real Opportunity Case V1

## 1. Preconditions

- Initial HEAD: `06984be225ef397f98256cbf81d4a2cd8587e61c`
- Previous P0 remaining: 0.
- Canonical attention order still places `Prioritize` before `Validate`.
- Hydration, commercial-objective, change-label, corroboration, ontology, Amor generation, test, and build contracts from Product Truth V1 remain closed.

## 2. Pipeline trace

```text
Commercial Intent / Context
→ Discovery evidence and dated signals
→ Qualification (fit reasons / score)
→ Evaluation (role/type coherence, fit, timing, evidence relations, uncertainty)
→ Synthesis (decision rationale, validation, next step)
→ InstitutionalOpportunityReport snapshot
→ DeliverableViewModel (curated transport only)
→ ClientCanvasVM (presentation summaries only)
→ Portable / Workspace
```

`lib/intelligence/opportunity-case-intelligence.ts` is the new evaluation/synthesis boundary. The React renderer, portable renderer, adapter, and ClientCanvasVM do not classify accounts or generate commercial reasoning.

## 3. Provenance matrix

| Field | Source | Derivation | Basis | Confidence requirement | Persisted | Visible | Safe rule |
|---|---|---|---|---|---|---|---|
| Account Role | explicit commercial context | controlled normalization | explicit | explicit relationship | snapshot JSON | yes | never reuse landscape `role` |
| Opportunity Type | explicit type or route + proposed test | controlled taxonomy + coherence gate | explicit/inferred | coherent Role × Type | snapshot JSON | yes | unknown when unsupported |
| Strategic Fit | objective + route evidence + qualification | qualitative normalization | inferred | client-relative reasons | snapshot JSON | yes | no customer score |
| Timing | dated material event | qualitative evaluation | inferred | real event date + source | snapshot JSON | conditional | static facts excluded |
| What Changed | dated material event | no renderer heuristic | observed | event + date + source | snapshot JSON | conditional | retrieval date excluded |
| Why It Matters Now | change + objective | synthesis | inferred | explicit client context | snapshot JSON | conditional | not buying intent |
| Evidence Strength | claim/source/relation | evidence evaluation | observed/inferred | source provenance | snapshot JSON | yes | source count ≠ independence |
| Independent Support | explicit independent sources | conservative boolean | observed | distinct underlying origins | snapshot JSON | yes | false unless explicit |
| What Weakens | risk/counterevidence | evaluation | observed/inferred | material negative | snapshot JSON | conditional | absence is not counterevidence |
| Unknown | approved review/blocker | direct carry | explicit | decision relevance | snapshot JSON | yes | separate from weakness |
| Validation | unknown + realistic test | evaluation | explicit/inferred | can affect decision | snapshot JSON | yes | critical flag explicit |
| Decision rationale | fit + timing + evidence + uncertainty + state | synthesis | inferred | at least defensible fit | snapshot JSON | yes | no aggregate score/certainty |

## 4. Existing field audit

Before this sprint, `AccountBriefVM` had optional Role/Type slots but production adapters left them null; Fit/Timing were calculated in the adapter; evidence behaved mainly as a URL list; the first validation was visually marked critical without structured support; and Amor decision notes repeated portfolio groups.

After this sprint, the structured evaluation object owns classifications, provenance, fit/timing, material changes, evidence relationships, observed facts, claim impact, uncertainty, structured validations, and decision synthesis.

## 5. Account Role

Controlled V1 roles: Potential Customer, Supplier, Distributor, Strategic Partner. One primary role per Case. Amor is 10/10 `Potential Customer`, explicitly grounded in the accepted client objective and approved target-account portfolio. The unrelated market-landscape `role` remains isolated.

## 6. Opportunity Type

Controlled taxonomy: New Business, Operations Expansion, Technology Modernization, Enterprise Transformation, New Market Entry, Capacity Expansion, Vendor or Platform Change, Channel Partnership. An optional descriptor preserves route nuance. Invalid Role × Type pairs are rejected. Amor is 10/10 `New Business`, with route-specific descriptors.

## 7. Fit

Fit means alignment with the client's objective, not generic company quality. Amor is 10/10 Moderate: every account has an approved route rationale and direct official evidence of structural relevance, but none proves third-party buying, economics, or format acceptance. No numeric score is exposed.

## 8. Timing

Timing requires a dated material event. A static operating fact, retrieval date, or webpage update does not establish Timing. Amor coverage is 0/10, honestly omitted.

## 9. What Changed

True Change requires an event, real date/time window, supporting source, and Case relevance. Amor has 0/10 true changes. Its immutable facts moved fully into claim-first Evidence; static-fact leakage is 0.

## 10. Why It Matters Now

Why Now is emitted only when a real dated event can be connected to an explicit client objective. Amor coverage is 0/10. The executive read now says accounts are prioritized for validation on structural fit, not current timing.

## 11. Evidence relationships

The model supports Direct, Supporting, and Context. Evidence carries claim, observation, source, URL, date, observed/inferred basis, Case impacts, and an independence key. Amor is 10/10 direct official structural evidence and 0/10 independent support. The Evidence tab now explains what each source establishes and what was observed.

## 12. Counterevidence and unknowns

Counterevidence and unknowns are separate. Amor has no verified counterevidence, so none is invented. Each Case has one material explicit unknown (10/10), shown under “Qué podría cambiar el caso.”

## 13. Validation

Amor is 10/10 structured validation. Each validation names the unresolved fact, marks its decision relevance, and provides a realistic route already approved in the pilot data. No generic “contact the company” instruction was introduced.

## 14. Decision rationale

Amor is 10/10 stronger rationale. Each rationale synthesizes qualitative Fit, one-source evidence, absent Timing, the material unknown, and the existing decision. It explicitly denies purchase-intent evidence. Recommended next steps follow the preserved decision state.

## 15. Potential Value and Feasibility readiness

- Potential Value: **NOT READY**. Existing evidence cannot defend client-relative value without relying on generic company size/revenue assumptions.
- Feasibility: **NOT READY**. Existing fields do not consistently measure realism of realizing this specific opportunity.

Neither field is emitted.

## 16. Amor coverage

| Field | Before | After | Remaining reason |
|---|---:|---:|---|
| Account Role | 0/10 | 10/10 | — |
| Opportunity Type | 0/10 | 10/10 | — |
| Fit | 0/10 defensible | 10/10 Moderate | no Strong claim without deeper support |
| Timing | 0/10 | 0/10 | no dated commercial event |
| True Change | 0/10 | 0/10 | static facts only |
| Why Now | 0/10 | 0/10 | no temporal input |
| Direct evidence | 10/10 URL/fact | 10/10 claim-first | — |
| Independent Support | 0/10 | 0/10 | one underlying source per Case |
| Counterevidence | 0/10 | 0/10 | none verified |
| Material Unknown | 10/10 | 10/10 structured | — |
| Validation | 10/10 strings | 10/10 structured | — |
| Stronger rationale | 0/10 | 10/10 | — |

Historical evidence was not rewritten. `opportunity_case` is a new derived evaluation stored alongside each immutable evidence record.

## 17. Landing vs real parity

| Capability | Landing | Amor after | Classification |
|---|---|---|---|
| Role / Type | rich synthetic | real structured | REAL |
| Fit | strong illustrative | moderate evidence-backed | REAL |
| Timing | dated synthetic | absent | REAL PARTIAL |
| What Changed | dated synthetic | absent | SYNTHETIC ONLY for Amor data |
| Why Now | client-connected | absent | SYNTHETIC ONLY for Amor data |
| Evidence relations | multi-source | direct single-source | REAL PARTIAL |
| Weakness / Unknown | both | unknown only | REAL PARTIAL |
| Structured validation | yes | yes | REAL |
| Decision rationale | rich | fit/evidence/unknown synthesis | REAL |

The landing was not visually redesigned or reduced. Production now follows the same grammar and truth standard without pretending equal evidence density.

## 18. Render QA

- Strongest available Prioritize Case inspected: Ser Saludable. Verdict: coherent structural-fit priority, explicit one-source limit, absent Timing, material validation, no purchase certainty.
- Validate Case inspected: Éteka. Verdict: clear thesis, direct evidence, named unknown, realistic test, and rationale explaining why validation remains necessary.
- Weak/Monitor Case inspected: Funat. Verdict: structural relevance remains visible while third-party openness and competitive overlap remain unresolved; Timing/Change are absent.
- Evidence tab: claim-first, source-linked, relation-aware, observed fact visible.
- Compare: Role, Type, Fit, Timing, Evidence, freshness, change, thesis, limiter, validation, and next step.
- Mobile: internal tab/account rails scroll; page horizontal overflow remains zero.
- Portable: self-contained, offline, zero remote assets/runtime calls.

## 19. Tests

- Evidence-complete semantic suite: 36/36.
- Product truth parity: 21/21.
- Portable: 55/55.
- Deliverable: 60/60.
- Landing guards: 102/102.
- Commercial continuity: 17/17.
- Authenticated product: 36/36.
- Admin auth: 48/48.
- Admin routing: 58/58.
- TypeScript: clean.
- Production build: clean.

## 20. Remaining P0 / P1 / P2

- P0: none.
- P1: real dated change acquisition, client-specific Why Now, multi-source corroboration/source lineage, verified counterevidence, and stronger differentiated Fit.
- P2: Potential Value methodology, opportunity-specific Feasibility, Revisit When triggers, and deeper source-impact presentation in CSV.

## 21. Sprint 3 readiness

The structured fields are optional, legacy-safe, snapshot-compatible, and can coexist with Account Memory. They are ready to feed future cross-account synthesis by opportunity type, common changes, evidence gaps, validation themes, and decision transitions. Sprint 3 should implement Portfolio Intelligence + memory-ready cross-account synthesis only after real change/corroboration coverage improves enough to avoid pattern claims from structural fit alone.
