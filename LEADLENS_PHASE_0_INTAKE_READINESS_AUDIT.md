# LeadLens — Phase 0: Intake Readiness Audit

Audit-and-planning only. No product code, no migrations, no DB writes, no context created/accepted. Amor de Gea is completing the 17-question questionnaire; **no real answers received yet**.

## 1. Current state
- **Git:** branch `main`, HEAD `b9ebc95`, `origin == local` (0 ahead / 0 behind). Working tree clean except the intentional `.leadlens/*.json` runtime files.
- **Production:** `https://leadlensintel.com/login` → 200; questionnaire endpoints (`/questionnaire`, `/questionnaire/xlsx`, `/questionnaire/pdf`) → 403 (deployed + admin-protected).
- **Pilot:** `amor-de-gea`, internal, blocked by client context. 6 accounts / 6 theses. Intakes 0, accepted context versions 0, safety reviews 0.
- **Questionnaire:** `client-questionnaire-v1`, 17 client questions, 17 unique stable keys (0 duplicates), 9 esenciales. `_meta` sheet `state=veryHidden`, parseable; answer cells blank; no internal tokens on client surfaces.

## 2. Intake pipeline audit (exists today — verified in code)
- **Manual entry** `POST /api/admin/intelligence/pilots/[pilotId]/intake`: `requireAdmin`, `canonicalPilotId` 404 gate, zod schema (≤17 answers; `value`≤5000, `status∈{unanswered,answered,unknown,not_applicable,conflicting}`, `source∈{client_direct,client_document,admin_entry,inferred}`, `note`, `evidence_url` URL-validated), forged-`question_id` rejection, sha256 idempotency key, upsert into `intelligence_client_intakes` with `submission_does_not_activate_context:true`, `fixture_mode:false`, `reviewer_state:"unreviewed"`. Draft→200, submitted→202. Fails closed (503) without DB.
- **Acceptance / review** `POST /…/operations`: `accept_context` → new **append-only** `intelligence_client_context_versions` (version_number, `changed_fields`, `affected_thesis_ids`, history preserved, 23505-tolerant); `review_thesis` (forged-thesis gate, decisions `approved_internal/corrected/rejected/context_requested/evidence_requested/expired`); `review_safety`.
- **Admin UI** `pilot-intake.tsx`: renders the questions (Spanish) with `value/status/source/note/evidence_url` inputs; posts to `/intake` and `/operations` via `adminFetch`.
- **Tenant isolation:** all writes are server-only (service-role), scoped by `client_id` (+ `tenant_user_id`), idempotent upserts; versions/reviews append-only. Intact.
- **Answer honesty:** `acceptIntake()` accepts only reviewer-`accepted` answers with `source∈{client_direct,client_document,admin_entry}` and rejects `fixture_mode` — invented/inferred answers cannot enter a context version.

## 3. Two key spaces (the one real friction)
- **Client questionnaire keys** (XLSX/PDF `_meta`): `products_b2b, wholesale_price, minimum_order, …` → `internal_fields`.
- **Admin intake `question_id`**: `q_<hash>` derived from the internal context field (from `client-context-review.questionsForGaps`).
- These differ. Chain to enter a returned answer: **XLSX answer (client key) → `_meta` internal_field → the Admin question for that field → type value/status/source/confidence/evidence**. For 17 questions, once, this is a manual match-by-topic step.

## 4. Question mapping (stable key → question → internal field(s) → shape → confidence → evidence → blocking → accounts)
Confidence for every row: `Confirmado / Estimado / Por confirmar / No aplica`. Evidence for every row: documento o URL. Context gaps affect all 6 theses (BioPlaza, Distribuidora DAM, Natural + Mente, Tu Tienda Saludable, Hotel Spa La Colina, Somos Consiente); "esp." notes the most sensitive route.

| Key | Client question (topic) | Internal field(s) | Answer shape | Blocking | Accounts/route esp. |
|---|---|---|---|---|---|
| products_b2b | Productos B2B disponibles | product_formats | structured tabla | **Sí** | todas |
| customization | Personalización producto/empaque | customization_capacity | multi-select | No | gifting/retail |
| private_label | Marca blanca | white_label_capacity | single | No | distribución/retail |
| wholesale_price | Rango precio mayorista | price_positioning | structured (sens.) | **Sí** | todas |
| minimum_order | Pedido mínimo | minimum_order | structured (sens.) | **Sí** | todas |
| margin | Margen viable | margins | range (sens.) | **Sí** | distribución (DAM) |
| account_size | Tamaño de cuenta atractivo | account_size_constraints | single | **Sí** | secuenciación |
| monthly_capacity | Volumen mensual confiable | production_capacity | structured (sens.) | **Sí** | todas |
| delivery_coverage | Cobertura + método entrega | delivery_radius **+** distribution_capability | structured | **Sí** | geografía/todas |
| operational_constraints | Restricciones operativas | fulfillment_constraints | multi-select | **Sí** | todas |
| certifications | Registros/certificaciones | certifications | structured checklist | **Sí** | retail/hospitality |
| current_models | Modelos B2B actuales | business_model | multi-select | No | todas |
| preferred_models | Modelos preferidos (piloto) | preferred_deal_type | multi-select | No | secuenciación |
| existing_partners | Distribuidores/aliados | current_partnerships | structured | No | conflicto de canal |
| sales_cycle | Ciclo comercial aceptable | sales_cycle_tolerance | single | No | priorización |
| company_stage | Etapa de la empresa | company_stage | single | No | expectativas |
| pilot_objectives | 3 objetivos del piloto | — (estratégico) | multi-select | No | orientación |

Coverage: 17/17 client questions; 17/17 internal fields covered (delivery covers 2; `pilot_objectives` is strategic-only, imports to notes). No private values or synthetic answers included.

## 5. Importer decision — **A: manual entry is sufficient for Amor de Gea**
Rationale: the full manual-entry → review → accept → context-version pipeline already exists, is tenant-safe and honesty-gated; the workload is 17 questions for one client, once. Building any importer now would be speculative (scope-frozen).
**Documented fallback (B), pre-justified but NOT built:** if the returned file is large/messy or transcription proves error-prone (or a 2nd pilot arrives), a *minimal one-time* exceljs ingestion utility is cheap — `exceljs` is already installed and `_meta` gives a stable `question_key → internal_fields` contract, so a script could read answered cells and pre-fill an Admin **draft** for human review (never auto-accept). Not **C** (reusable importer) — not justified at one pilot.

## 6. Manual-entry readiness — READY
The reviewer can, today: open the returned XLSX, and for each answered question, enter the value + status + `source=client_document`/`client_direct` + confidence + evidence in the Admin Context tab, save a **draft**, then **submit** for review; acceptance creates a context version and unblocks thesis recalculation. No code change needed to start.

## 7. Blockers to processing the real returned file
1. **No answers yet** (the only true blocker for Phase 1 — external, client-owned).
2. Manual key-translation friction (client key → internal question) — mitigated by the `_meta` map + this mapping table; acceptable at one pilot.
3. None in code: parsing is feasible now (exceljs installed) if B is ever chosen.

## 8. No-change decisions (scope freeze honored)
No importer built; no answers created; no context accepted; no thesis recalculation; no discovery; no ranking/Auth/Admin/report changes; no migration; no DB writes.

## 9. Files inspected
`app/api/admin/intelligence/pilots/[pilotId]/intake/route.ts`, `…/operations/route.ts`, `…/pilot-intake.tsx`, `lib/intelligence/client-context-review.ts`, `client-questionnaire.ts`, `pilot-workspace.ts`, `lib/reports/client-questionnaire-{xlsx,pdf}.ts`, and the four authoritative docs.

## 10. Tests
Focused only: `test:client-questionnaire` 27/0, `test:pilot-questionnaire` 13/0; key-integrity probe (17 unique keys, 0 dupes, `_meta` parseable, 17/17 field coverage). No broad historical suites; no code touched → no new typecheck needed beyond green.

## 11. Exact next trigger → next phase
**Trigger:** Amor de Gea returns the completed `.xlsx` (or `.pdf`) with real answers.
**Next phase (Phase 1):** enter the real answers as `admin_entry`/`client_document` drafts → submit → review/accept a context version → recalculate the affected theses. Remains **blocked** until the file is received.
