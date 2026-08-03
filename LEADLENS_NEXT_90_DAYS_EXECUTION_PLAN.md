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
