---
name: leadlens-intel-guard
description: Check that an intelligence-code change preserves LeadLens's truth boundaries (no user-context→Evidence, no retrieval/publication-date→event-date, no HOT/WARM/COLD or opaque score, deterministic gates stay final). Invoke when changing lib/monitor, lib/deliverable, lib/discovery, lib/interpretation, or anything touching Case/Evidence/temporal/decision logic.
---

# leadlens-intel-guard

Intelligence semantics are the product. The truth boundaries are listed in `CLAUDE.md` — this skill is the **verification procedure** against a diff, not a second copy of the rules.

## Checklist (verify each against the change)
1. **Deterministic gates are final.** An LLM/user may PROPOSE; only `extractEvent` / `classifyMateriality` / `resolveEventDate` / `stageAViolations` / `caseDecision` decide. No raw LLM output becomes Evidence.
2. **Temporal:** event date is only the event phrase — never `retrievedAt`, never `publicationDate`. Pre-cutoff-but-newly-found → `newly_discovered_historical` (new Evidence, NOT a post-review What Changed).
3. **Novelty/corroboration:** rediscovered ≠ new; same event across URLs = one event; independent support needs ≥2 distinct **origin** ids.
4. **Decision authority:** decision comes from the current Case via `caseDecision`/`synthesizeCase`, BEFORE `diffAccountCase`. Decisions are `prioritize|validate|monitor|hold` — no HOT/WARM/COLD, no numeric lead/provider score.
5. **Boundaries:** Memory ≠ Evidence; user context ≠ Fact; no observed event → no Timing; absence/unknown ≠ counterevidence. Tenant isolation preserved. No new provider / no Apollo.
6. **Quality floor not traded for cost/recall:** a lexicon/routing change must not increase false-accepted events, wrong-entity, false What Changed, or unsupported Timing.

## Procedure
- Run the intelligence fixtures that encode these: `research-temporal-hardening`, `monitor-intelligence`, `canonical-fulltext-extraction`, `account-memory`, `account-opportunity-synthesis`, `provider-routing-cogs` (plus any specific to what you touched). Each must stay green — the adversarial/false-accept assertions are the guard.
- Grep the diff for regressions: new `HOT|WARM|COLD`, a numeric score exposed as authority, `publicationDate`/`retrievedAt` used as an event date, or raw model text written into an Evidence/snapshot field.

## Output
Confirm each checklist item holds, cite the green fixtures (esp. the zero-false-accept ones), and flag any boundary the change weakens as a P0 to fix before close.
