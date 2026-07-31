# LeadLens — Client Questionnaire Experience Report

Phase: **Professional client intake + question-quality improvement** for the Amor de Gea pilot (reusable across pilots).

## 1. Current CSV diagnosis (before)
The `/questionnaire` CSV was technically correct but not client-ready: a 17-row database dump with internal field names (`account_size_constraints`, `delivery_radius`…), technical English respondent roles (`client operations`), no introduction/purpose/time/confidentiality, one undifferentiated table, no answer options for multi-choice fields, no units/examples on numeric questions, no confidence distinction (confirmed vs estimated vs unknown vs N/A), and no LeadLens/Amor de Gea identity. It read like system requirements, not a commercial conversation.

## 2. Question-quality audit
All 17 internal context fields were audited for necessity, clarity, overlap, single-vs-multiple intent, format clarity, examples, sensitivity, and decision impact. Result: keep full information coverage but rewrite every question in client-friendly Spanish, resolve overlaps, add options/units/confidence, and add one high-value strategic question.

## 3. Questions removed
None removed outright (coverage preserved). One overlap collapsed (see §4).

## 4. Questions merged
- **Delivery coverage** — the two overlapping delivery questions (`delivery_radius` + `distribution_capability`) merged into a single structured question *"¿A dónde puede entregar de forma confiable hoy y con qué método?"* with subfields (regiones, método, tiempo, flete, restricciones) → maps to **both** internal fields.

## 5. Questions split (into structured subfields)
- **Pricing** (`price_positioning`): producto/ref, precio unidad, precio caja, IVA, moneda, vigencia.
- **Minimum order** (`minimum_order`): mínimo unidades, mínimo valor, mínimo por referencia, excepción piloto.
- **Margin** (`margins`): margen propio mínimo + margen/descuento máximo para distribuidor.
- **Capacity** (`production_capacity`): normal, pico, lead time, restricciones, estimado/confirmado.
- **Certifications** (`certifications`): documento, estado, vencimiento, enlace, notas.

## 6. Questions rewritten
All 17 rewritten to client-facing Spanish with a plain "¿Por qué lo pedimos?", answer options where applicable, units/examples for numeric, and confidentiality framing for price/margin/capacity.

## 7. Final question set (17, client-facing)
- **A. Oferta B2B:** productos B2B (tabla), personalización, marca blanca.
- **B. Precios y condiciones:** rango mayorista, pedido mínimo, margen, tamaño de cuenta atractivo.
- **C. Capacidad y cobertura:** volumen mensual, cobertura+método de entrega (merged), restricciones operativas.
- **D. Cumplimiento:** registros/certificaciones (checklist con estado).
- **E. Estrategia comercial:** modelos actuales, modelos preferidos, aliados existentes, ciclo comercial.
- **F. Etapa y prioridades:** etapa de la empresa, **3 objetivos del piloto (nueva pregunta estratégica)**.

Full internal-field coverage retained (17 fields; delivery question covers 2; objectives is strategic-only).

## 8. Priority model (client-friendly, 3 phases)
- **Esencial para continuar** — 9 preguntas (viabilidad + recomendación de cuentas). Shown first.
- **Muy útil para mejorar el análisis** — 5 preguntas (ruta y secuencia).
- **Información complementaria** — 3 preguntas (madurez/personalización).
Internal states (`critical_blocker`, `high_leverage`) are never shown.

## 9. XLSX architecture (primary, exceljs)
Sheets: **Inicio** (intro/instructions/confidentiality/section overview/essential count), **Esenciales** (index of must-answer + which sheet to answer), **Oferta y precios / Capacidad y cumplimiento / Estrategia comercial** (topic sheets, essential-first, header frozen, autofilter, editable **blank** answer cells + **Confianza dropdown** [Confirmado/Estimado/Por confirmar/No aplica], guide/label cells locked), **Documentos** (checklist with estado dropdown), **Resumen** (guidance), and **`_meta`** (`state: veryHidden`) carrying the import keys. LeadLens accent, wrapped text, sensible widths, no macros.

## 10. PDF architecture (jsPDF, LeadLens identity)
Cover (green + botanical gold accent) → introduction/instructions → section dividers → each question with priority chip, "¿Por qué lo pedimos?", options/guide, a writing box, **Confianza checkboxes** and Evidencia line → documents checklist → final-review checklist. 8–12 pages, print-friendly, read-only.

## 11. CSV fallback
The existing `/questionnaire` CSV endpoint is retained unchanged as the **technical CSV** (secondary), still import-compatible (`test:pilot-questionnaire` green).

## 12. Admin export experience
The Context tab shows a **"Cuestionario para el cliente"** module (17 preguntas · 9 esenciales · 20–30 min): **Descargar cuestionario editable (.xlsx)** and **Descargar cuestionario para revisión (.pdf)** as primary buttons, **Descargar CSV técnico** as a discreet secondary link. Copy states downloading does not create/accept context and answers remain subject to Admin review.

## 13. Import-readiness contract
Hidden `_meta` (XLSX) + stable `question_key → internal_fields` map + `schema_version = client-questionnaire-v1`. A future importer maps: `question_key → answer, confidence (Confirmado/Estimado/Por confirmar/No aplica), evidence, notes, no-aplica → internal context field(s)`. The importer is **not** built in this phase (documented only).

## 14. Reusability
`lib/intelligence/client-questionnaire.ts` holds the model; `renderQuestionnaire(questions)`, `buildClientQuestionnaireXlsx({brand,questions})`, `buildClientQuestionnairePdf({brand,questions})` are parameterized by a `QuestionnaireBrand` (name, category, geography, accent). Amor de Gea is one config (`AMOR_QUESTIONNAIRE_BRAND`), not hardcoded in the renderers.

## 15. Security
Admin-only (`requireAdmin`), `private, no-store`, provider-free, forged pilotId → 404, answers always blank (no fabrication), no internal field names/roles/IDs/methodology on client outputs, explicit privacy notice, no context acceptance on download.

## 16. Tests
`test:client-questionnaire` — **22 passed** (model: 17 Qs, essential-first, 9 essential, 6 sections, options present, no internal tokens, client priority labels, import keys cover 17 fields; **XLSX**: required sheets, hidden `_meta`, frozen header, editable/blank answer cells, confidence data-validation, no internal tokens, no prefilled; **PDF**: valid %PDF, 8–12 pages, intro+review copy, no internal tokens, deterministic). Regression green: `pilot-questionnaire` 13, `pilot-workspace` 48, `admin-auth` 48. tsc clean.

## 17. Visual verification
Real files generated (`.xlsx` ~18 KB, `.pdf` ~58 KB). XLSX structure inspected by reloading with ExcelJS (sheets, hidden meta, frozen panes, editable cells, dropdowns, no leaks). PDF validated as `%PDF`, 8–12 pages, correct copy, no internal tokens. **Limitation:** pixel-level page rendering could not be produced in this environment (no `poppler`; in-app browser file:// PDF preview stalled) — the owner should open both files once to confirm final polish.

## 18. Files modified
- New: `lib/intelligence/client-questionnaire.ts`, `lib/reports/client-questionnaire-xlsx.ts`, `lib/reports/client-questionnaire-pdf.ts`, `app/api/admin/intelligence/pilots/[pilotId]/questionnaire/xlsx/route.ts`, `app/api/admin/intelligence/pilots/[pilotId]/questionnaire/pdf/route.ts`, `scripts/fixtures/client-questionnaire.test.ts`, this report.
- Modified: `app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx` (3-button export module), `package.json` (+`exceljs`, +test script).

## 19. Migration status
**None.** No schema change; questionnaire template/version live in code (`client-questionnaire-v1`).

## 20. Commit hash
`a85eed1`

## 21. Remaining limitations
- Pixel-level visual QA not rendered here (owner opens the files to confirm).
- Answer importer not implemented (contract documented for a later phase).
- Only the Amor de Gea pilot exists; other brands need a `QuestionnaireBrand` config.

## 22. Exact next step
Send the **.xlsx** (editable) or **.pdf** (review/print) to Amor de Gea. When answers return, load them as `admin_entry` and **review/accept** → new context version → recalculate the affected theses. Do not import/accept before this phase's review gate.
