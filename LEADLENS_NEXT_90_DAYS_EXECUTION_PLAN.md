# LeadLens — Next 90 Days Execution Plan

Context-driven pilot execution. No invented dates or results. Baseline: HEAD `b9ebc95`, production live, Amor de Gea completing the 17-question questionnaire (no answers received yet).

## 1. Strategic focus
Turn one real pilot (Amor de Gea) into a defensible, context-driven account-intelligence deliverable: real client context → reviewed theses → feasibility → customer-safe outputs — without fabricating intent, timing, or answers. Depth on one pilot before breadth.

## 2. Current baseline
- Auth, Command Center, snapshot/registries, evidence/temporal, signals, entity resolution, account synthesis, client-context review, pilot workspace, internal PDF, and the professional client questionnaire (XLSX/PDF/CSV) are built and deployed.
- Pilot state: 1 pilot · 6 accounts/theses · 17 context questions · **0 answers · 0 accepted context · 0 reviewed theses · 0 customer-safe**. No current verifiable commercial timing.

## 3. Scope freeze (until explicitly lifted)
No new discovery/accounts, no ranking changes, no Auth/Admin/report redesign, no migrations, no fabricated answers, no automatic customer-safe promotion, no final report, no speculative product functionality, no XLSX importer built pre-arrival.

## 4. Phase sequence
- **Phase 0 — Execution control + intake readiness audit — DONE (this document + `LEADLENS_PHASE_0_INTAKE_READINESS_AUDIT.md`).**
- **Phase 1 — Client context completion — BLOCKED until the questionnaire is returned.** Enter real answers (`admin_entry`/`client_document`) → submit → review/accept a context version → recalculate affected theses.
- **Phase 2 — Thesis review + feasibility — BLOCKED by Phase 1.** Review the 6 theses against accepted context; reassess feasibility per account/route.
- **Phase 3 — Account evidence depth — BLOCKED by Phase 2 (and budget/authorization).** Deepen public-research evidence on the 6 accounts (identity ≠ demand preserved).
- **Phase 4 — Customer-safe readiness — BLOCKED by Phases 1–3.** Explicit safety review; determine which outputs are customer-safe.
- **Phase 5 — Customer deliverable — BLOCKED by Phase 4.** Only after gates pass; final report stays disabled until then.
- **Phase 6 — Second pilot / reusability — BLOCKED by a successful first pilot.**

## 5. Dependencies
Phase 1 depends on the returned file. 2 depends on 1. 3 depends on 2 (+ provider budget). 4 depends on 1–3. 5 depends on 4. 6 depends on 5.

## 6. Current status
Phase 0 active/completed. Phase 1 blocked (awaiting file). Phases 2–6 blocked by dependencies.

## 7. Client dependencies
Amor de Gea must return the completed questionnaire — at minimum the 9 esenciales: products_b2b, wholesale_price, minimum_order, margin, account_size, monthly_capacity, delivery_coverage, operational_constraints, certifications. Supporting documents (registro sanitario/INVIMA, ficha técnica, etc.) where available.

## 8. Claude tasks
- Phase 0: audit + mapping + this plan (done).
- Phase 1 (on trigger): enter owner-provided real answers as drafts, submit, and — after founder review — accept a context version and recalculate affected theses; never invent answers.
- Later phases: thesis review support, feasibility reassessment, evidence deepening (on authorization), safety-review support. Each behind its gate.

## 9. Founder tasks
Send the XLSX/PDF to Amor de Gea; collect real answers + documents; review each answer before acceptance; approve context acceptance and thesis review; push commits to `origin/main` via GitHub Desktop (CLI has no push credentials here); decide provider budget for evidence deepening.

## 10. Client tasks
Complete the questionnaire (esenciales first), attach/reference documents, mark «Por confirmar»/«No aplica» honestly, return the file.

## 11. Success metrics (no targets invented)
Phase 1: essential questions answered + reviewed; 1 accepted context version; affected theses recalculated. Phase 2: 6 theses reviewed; feasibility state per account. Phase 4: explicit customer-safe determination. All measured from real data only; missing data stays explicit.

## 12. Decision gates
- G1 (Phase 0→1): questionnaire returned with real answers.
- G2 (1→2): a context version accepted after founder review.
- G3 (2→3): theses reviewed + feasibility assessed; authorization/budget for research.
- G4 (3→4): evidence sufficient for a safety review.
- G5 (4→5): explicit customer-safe outputs exist; founder approves.

## 13. Time tracking
Per phase, record start/end when actually executed (no pre-filled dates). Phase 0 executed this session.

## 14. Risks
- Client delay or partial answers (mitigate: esenciales-first; partial acceptance supported).
- Manual key-translation error (mitigate: `_meta` map + mapping table; optional one-time ingestion utility if error-prone).
- No verifiable commercial timing (accepted; never fabricate urgency).
- One pilot ≠ generalizable performance (accepted; depth first).
- Push/deploy depends on founder (no CLI credentials).

## 15. Prompts to be executed (next)
- **On file return:** "Enter the real Amor de Gea answers I provide as admin_entry drafts for the questionnaire, submit for review; do not accept context or recalculate until I approve." → then "Accept the reviewed context version and recalculate the affected theses."
- Subsequent phase prompts issued only after the prior gate passes.

## 16. Results log
- Phase 0 (this session): intake pipeline verified ready; manual-entry decision = **A**; mapping documented (17/17 coverage); execution plan created. No answers, no context, no recalculation.

## 17. Current next action
Phase 1.5 is ready for founder acceptance: candidate `intake_fb4bc38a8e0af0343c9f8f1e` contains 17 mapped fields with client, founder, system and open-validation provenance separated. Founder: review its explicit limitations and authorize or reject the separate `accept_context` action. Phase 2 remains blocked until the first accepted context version exists.

## LEADLENS OPPORTUNITY FACILITATION — PARKED STRATEGIC IDEA

LeadLens podría ayudar más adelante a conectar clientes con compradores calificados, facilitar introducciones o apoyar oportunidades por una tarifa o compensación por éxito. Es estratégicamente interesante, pero no forma parte del producto activo ni de Amor de Gea Phase 1. Solo debe reconsiderarse cuando la calidad de Account Intelligence esté demostrada y el proceso pueda automatizarse en gran medida. No construir todavía UI, adquisición de contactos, outreach, introducciones, comisiones, success fees, contratos ni negociación.
# Phase 2 continuation — 2026-08-03

Phase 1.5 is complete. Phase 2 accepted `context_28bbc2b447323da3e387c964` and derived the internal Commercial Readiness Profile. Phase 3 remains blocked until founder review explicitly authorizes Search Blueprint and six-account recalibration. No discovery, outreach, thesis recalculation or customer-safe promotion is implied.

## Phase 3 continuation — 2026-08-03

Blueprint V1 and six internal V2 thesis comparisons are ready for founder review. Phase 4 remains blocked until explicit approval authorizes the bounded controlled search. The Phase 4 numbers are ceilings, not quotas.

## Phase 4 continuation — 2026-08-03

The controlled search and recovery are complete. Fifteen accounts now await human review; Phase 5 remains blocked until the founder approves a reviewed subset and explicitly authorizes preparation or action.
# Phase 4.5 checkpoint

V3R now provides a separate founder decision layer over the preserved V3 portfolio. The proposed internal portfolio is reduced to 11 accounts; four are recommended Work First, three require evidence and one is rejected. Phase 5 remains blocked until explicit founder approval and conflict checks.

## Phase 4.6 checkpoint

V3R2 contains 12 provisionally approved internal accounts after exactly three evidence repairs. Four internal Action Brief drafts and a conflict-check package are ready; Phase 5 remains blocked.

## Phase 5A checkpoint

V4D prepares customer-safe wording and the future report architecture without generating delivery. The immediate dependency is the 13-account conflict check followed by founder review; first action remains limited to 2–4 accounts.

## Phase 5A.1 checkpoint

V4D.1 is ready for manual conflict-check delivery. Import remains preview-only; Phase 5B starts only after 13 real responses and explicit founder authorization.

## Context-impact audit

Client handoff is paused. Prioritize approval and implementation of the context-rule compiler, Blueprint V2 and candidate decision traces before any new discovery or client delivery.
### Blueprint V2 context-compiled replay

Blueprint V2 is approved only for persisted-data replay. V3R3 and replacement queries remain founder-review gates; no provider search or Amor de Gea handoff may resume before explicit approval.

The authorized bounded search is complete: 8 calls, no errors, no justified V3R4. Review the negative yield and account-first compiler correction before authorizing any second batch.

Account-first architecture is implemented without providers. The next activation is the founder-reviewed four-ecosystem validation plan, not another generic query batch.

The four-ecosystem validation is complete and inconclusive. Do not expand discovery; first require harvestable structured sources and route-specific parsers for COTELCO/stockist/catalog/member data.
# Update — Amor de Gea Pilot 1 finalization (2026-08-03)

Pilot 1 now has a founder-review delivery package: ten-account V3R3 portfolio, final report, four Action Briefs, feedback packet, manual review gate and Pilot 2 plan. The immediate next action is founder review and client delivery; no Pilot 2 search is authorized.


## 18. Pilot 1 deliverable finalization (2026-08-03)
Premium regeneration of the four customer files from the approved V3R3 intelligence (single-source JSON exported from the modules → deterministic reportlab/python-docx renderer). Report 25 pp, briefs 9 pp, feedback 13 pp + DOCX. Internal labels removed, Spanish unified, evidence cards visible (real official sources + retrieval date + no-timing). Portfolio, exclusions and Pilot 2 (PLANNED — NOT AUTHORIZED) unchanged. Delivery checksums/sizes/pages updated; downloads verified. Founder action: review in the Delivery Center, complete the 17-item checklist, confirm relationships, send the package.


## 19. Pilot 1 final delivery release (2026-08-03)
Delivery-ready package: compressed and renumbered report (18 pp), 5-pp briefs, 9-pp feedback with evaluation guides (cómo evaluar, escala 1–5, cuentas, briefs, Piloto 2) + novelty/decision-change questions + empty vector checkboxes. Spanish unified. Delivery metadata v1.2 (pages/size/sha256). Intelligence, exclusions and Pilot 2 (planned/not authorized) unchanged. Founder: push, review in Delivery Center, send the four files.


## 20. Recurring Opportunity Cycle V1 (2026-08-03)
Built the memory/learning foundation for monthly cycles: Account Memory + events, outcome capture (manual, fail-closed), anti-repetition + traceable novelty, What Changed (customer-safe), OpportunityCycle, route learning. Amor de Gea seeded (15 accounts). Pilot 2 references memory but stays PLANNED — NOT AUTHORIZED (0 accounts; gate 9/10, founder approval pending). Migration 048 created, not applied. Founder decisions: (a) apply 048 for durable persistence; (b) authorize Pilot 2 when real outcomes exist.
