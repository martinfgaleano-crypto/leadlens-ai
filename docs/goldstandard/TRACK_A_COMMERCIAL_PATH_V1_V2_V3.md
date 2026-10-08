# Track-A Commercial Path — V1 / V2 / V3

**Verdict: PARTIAL (materially improved; one specific gap remains).** On the SAME two
accounts, V3 added a **SEC-grounded owning function** and an **honest external-mechanism
verdict**, corrected the V2 mechanism-inflation error, and resolved the Kanebridge caveat.
The single remaining gap is a **grounded commercial ACCESS route**.

## Product answer (first)
- **Who matters?** For both CECO and Hillman, **Corporate Development** — SEC-supported as the plausible owner of post-close integration (not a guessed persona).
- **How could the relationship happen?** Honestly **not established**: targeted research found no primary-source evidence that either account engages EXTERNAL post-merger-integration advisors. (Their own acquisition activity is a trigger, not a mechanism — §54.)
- **How could the customer enter/validate?** Via the supported owning function: validate with Corporate Development whether integration is active and whether external PMI support is used — before spending outbound effort. A standalone verified access *route* was not established.

## The three-stage progression (did it actually happen?)
| Stage | CECO | Hillman |
|---|---|---|
| **V1 profile** | HOLD; why-now none; buyer/mechanism/access none | HOLD; same |
| **V2 trigger** | VALIDATE; SEC-dated acquisition trigger; buyer/mechanism/access still none (mechanism wrongly called "supported" from acquisition activity) | VALIDATE; same, mechanism inflated from "active acquirer" |
| **V3 commercial path** | VALIDATE; **buyer function SUPPORTED (SEC Corp Dev)**; mechanism **honestly not-established**; access not-established; operational next action | VALIDATE; **buyer function SUPPORTED (SEC Corp Dev)**; mechanism **honestly not-established**; access not-established; Kanebridge **grounded** |

Yes — the progression is real: profile → why-now → commercial path.

## Semantic corrections proven (mandatory)
- **§54 trigger ≠ mechanism:** `mechanismStateFromEvidence` downgrades acquisition-activity evidence to `unknown`; regression test enforced. In the live run, mechanism is `not_found` for both — the V2 "active acquirer ⇒ mechanism SUPPORTED" error is **gone from the artifact**.
- **§39 transaction-advisor ≠ PMI:** bank/legal/financial transaction advisors do not establish a PMI mechanism (tested).
- **§55 person ≠ access:** `accessStateFromEvidence` caps a named exec/contact page at `inferred`; tested.
- **§45 no-evidence ≠ counterevidence:** a `not_found` counter does not set `hasMaterialCounter` (tested); the decision is not lowered by absence.
- **Self-caught overclaim:** my first live researcher *appended synthetic keywords that gamed the guard*, producing a false "mechanism SUPPORTED." Caught in red-team, fixed to pass only honest evidence → mechanism correctly `not_found`.

## Buyer function
Both: **Corporate Development**, SUPPORTED by an SEC filing (CECO ARS 2026-04-24; Hillman EX-99.1 2026-09-03) that references the function as the plausible owner of post-close integration. Fact = the filing references the function; inference = that it owns the relevant integration work. Unknown = named decision role.

## External commercial mechanism
Both: **NOT ESTABLISHED** (not disproven, §45). No primary-source evidence either account engages external PMI advisors; filing co-occurrence of "integration"/"advisor" reflects the acquisition announcement, not a services mechanism. This is an acceptable targeted-research result, not an inflated claim.

## Commercial access
Both: **not established** (company pages not retrievable via direct HTTP; paid search out of credits). The actionable route is *through the supported function* (validate with Corporate Development), which §11 permits as a validation path for a VALIDATE account.

## Current opportunity
Trigger + SUPPORTED owning function → stronger than "trigger only," but still **not a fully-established current commercial opportunity** (external mechanism unproven). Correctly VALIDATE, not PRIORITIZE.

## Path to Prioritize / Next action (narrowing)
- V1: "verify mechanism/access/demand." → V2: "confirm the dated acquisition's integration work + mechanism/access." → V3: "Validate with Corporate Development whether post-close integration remains active and whether external PMI specialists are used, before allocating outbound effort." Materially narrower + operational.

## Claim-source audit
- SUPPORTED: trigger (SEC 8-K, dated); owning function = Corporate Development (SEC filing).
- **Kanebridge (§47): RESOLVED** — independently grounded: an SEC filing references Kanebridge (2026-09-03). The acquisition's existence + date are SEC-grounded; the specific "$315M" figure remains profile-sourced and should still be labeled as such until a filing line-item is cited.
- NOT ESTABLISHED (honest, not overclaimed): external mechanism, access route.
- UNSUPPORTED: none.

## Customer-specificity
The agenda is PMI-specific (trigger=M&A; buyer function=Corporate Development/Integration; mechanism=external PMI advisory). A cybersecurity vendor would get different queries (fixture-asserted). PASS.

## Commodity vs LeadLens
Commodity (Claude/Vibe): the company profile + that an acquisition happened. LeadLens added: a dated SEC-grounded trigger, a SEC-grounded owning function, an **honest "no external mechanism established" verdict** (not an inflated yes), and an operational validate-first action routed to that function.

## Economics
V3 spend **$0.0035** (~$0.0018/account) — EDGAR + direct_http free; a few bounded LLM calls. Commercial-path depth is economically trivial.

## Quality rubric
Current Trigger PASS · Current Opportunity PARTIAL · Commercial Problem PASS · Buyer Function **SUPPORTED/PASS** · External Mechanism PARTIAL (honestly not-established) · Commercial Access FAIL · Counterevidence PASS · Decision-Critical Evidence PASS · Path to Prioritize PASS · Next Action PARTIAL · Customer Specificity PASS · Decision Coherence PASS · Claim-Source PASS (Kanebridge resolved).

## Single biggest remaining gap
**A grounded commercial ACCESS route** (and positively-established external mechanism) — not obtainable from free primary sources for private procurement/advisor relationships; needs a working retrieval/search path or direct customer validation.

## Artifacts
- `output/goldstandard/track-a/LeadLens_TrackA_GoldStandard_V3_CommercialPath.pdf` (2 accounts) — V1/V2 preserved.
- `output/goldstandard/track-a/track-a-v1-v2-v3.json`.
- Module `lib/intelligence/decision-driven-research.ts` (+ guards); run `scripts/track-a-commercial-path-run.mts`.
