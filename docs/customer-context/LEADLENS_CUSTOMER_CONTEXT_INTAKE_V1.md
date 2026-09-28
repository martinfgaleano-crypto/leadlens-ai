# LeadLens — Customer Context Intake V1 (reusable)

**Status:** design + reusable AI-assisted intake prompt · **generalizable product artifact, not customer-specific.**
Passes the §39 generalizability test: this helps *any* customer describe their business — and specifically
any customer entering a **new geography or export market** — with no content that only fits Amor de Gea.

The intake exists to raise Intelligence quality by capturing company-specific facts **without excessive
friction**, and it maps to the **canonical** context schema `ConfirmedCommercialContextV1`
(`lib/interpretation/confirmed-commercial-context.ts`). It does **not** fork a parallel schema (§1): the
guided fields and the AI-assisted output both normalize into the same confirmed context the pipeline already
consumes (`commercialObjective`, `targetAccountProfile`, `signalHypotheses`, `qualificationConstraints`,
`opportunityConditions`), plus an additive **commercial-constraints** envelope carried on the context (below).

## 1. Two intake modes, one schema (§10)
Both paths produce the **same** normalized Customer Context. A customer picks whichever is lower-friction:
- **A. Guided intake** — progressive, high-information questions (§11); no 40-question survey.
- **B. AI-assisted intake** — the customer runs a copyable prompt in their own AI tool (ChatGPT/Claude/Gemini),
  which interviews them, separates facts from assumptions, flags unknowns, and returns a structured object
  LeadLens ingests, previews, and lets them edit before submission (§12–15).

**Invariant (§15):** third-party AI output is **never** silently treated as verified company fact. LeadLens
always shows the parsed context, missing fields and inferred/unknown flags, and requires explicit confirmation.

## 2. Guided field taxonomy (§11) — REQUIRED / OPTIONAL / CONDITIONAL / UNKNOWN_OK
Progressive disclosure; a customer may answer "I don't know" (`UNKNOWN_OK`) without blocking.

| Field | Requirement | Maps to |
|-------|-------------|---------|
| Company name + website | REQUIRED | context.meta / commercialObjective.clientDescription |
| What you sell (product/service, format) | REQUIRED | commercialObjective.clientDescription |
| Commercial objective (in your words) | REQUIRED | commercialObjective (Stage-A interpreted) |
| Target markets (current) | OPTIONAL | targetAccountProfile.geographies |
| **Target market(s) you want to enter** | REQUIRED for market-entry | targetAccountProfile.geographies |
| Ideal customer / who you sell to | REQUIRED | targetAccountProfile.organizationTypes/industries |
| Current customers (named) | OPTIONAL | account_memory seed (suppression) |
| Known relationships / partners | OPTIONAL | account_memory / constraints |
| Accounts to exclude | OPTIONAL | qualificationConstraints (exclusions) |
| Production capacity | CONDITIONAL (goods) | constraints.capacity |
| MOQ / minimum order | CONDITIONAL (goods) | constraints.moq |
| Unit price / wholesale price | OPTIONAL | constraints.economics (never published) |
| Margin constraints | OPTIONAL | constraints.economics |
| Packaging + shipping constraints | CONDITIONAL (physical goods) | constraints.logistics |
| Certifications / documentation held | CONDITIONAL (regulated) | constraints.compliance |
| Customization limits | OPTIONAL | constraints.customization |
| Current sales channels | OPTIONAL | signalHypotheses / routes |
| Preferred channels / channels to avoid | OPTIONAL | qualificationConstraints |
| Operational limitations | OPTIONAL | constraints |
| Commercial timeline | OPTIONAL | opportunityConditions |
| What success means | REQUIRED | commercialObjective (success definition) |
| Known competitors | OPTIONAL | peer exclusion |
| Existing distributors / target-market relationships | OPTIONAL | account_memory |

**Additive commercial-constraints envelope** (carried on the confirmed context, not a schema fork): a typed,
optional `constraints` bag `{ capacity?, moq?, economics?, logistics?, compliance?, customization?, timeline? }`,
each value tagged with a **fact type** (below). It informs qualification + deliverable "commercial constraints"
modules; it never invents a value and it is admin/customer-scoped.

## 3. Fact typing (§49) — every value carries its epistemic status
`OBSERVED_FACT` · `PUBLIC_EVIDENCE` · `CUSTOMER_PROVIDED_FACT` · `COMMERCIAL_INFERENCE` · `HYPOTHESIS` · `UNKNOWN`.
Guided answers default to `CUSTOMER_PROVIDED_FACT`; AI-assisted answers arrive pre-typed and are re-typed on
customer confirmation. The pipeline and deliverables must not blur these (a customer-provided MOQ is not
public evidence; an AI's guess is a hypothesis until confirmed).

## 4. Portable output schema (§14) — dual human-readable + JSON
The AI-assisted mode returns Markdown for the human plus a fenced JSON block LeadLens ingests:

```json
{
  "schema": "leadlens.customer_context.intake.v1",
  "company": { "name": "", "website": "", "one_line": "" },
  "offering": { "what_we_sell": "", "format": "", "fact_type": "CUSTOMER_PROVIDED_FACT" },
  "objective": { "in_customer_words": "", "success_means": "", "timeline": "" },
  "target_market": { "current": [], "entering": [], "fact_type": "" },
  "ideal_customer": { "organization_types": [], "industries": [], "notes": "" },
  "relationships": { "current_customers": [], "partners": [], "exclude": [] },
  "constraints": {
    "capacity": { "value": "", "fact_type": "" },
    "moq": { "value": "", "fact_type": "" },
    "economics": { "unit_price": "", "wholesale": "", "margin_notes": "", "fact_type": "" },
    "logistics": { "packaging": "", "shipping": "", "fact_type": "" },
    "compliance": { "certifications": [], "documentation": [], "fact_type": "" },
    "customization": { "value": "", "fact_type": "" }
  },
  "channels": { "current": [], "preferred": [], "avoid": [] },
  "competitors": [],
  "unknowns": [],
  "assumptions": []
}
```

Empty strings/arrays are legitimate (`UNKNOWN_OK`); `unknowns` and `assumptions` are first-class so the
customer and LeadLens both see what is *not* established.

## 5. Copyable AI-assisted intake prompt (§13) — reusable, never fabricates
> **Paste this into ChatGPT, Claude, or Gemini. It will interview you and produce a structured summary for LeadLens.**
>
> You are helping me prepare a **Customer Context** for LeadLens, a commercial-intelligence product. Your job is
> to help me organize what I **already know** about my own business — not to invent anything.
>
> Rules you must follow:
> 1. Interview me with a few high-value questions at a time (not a long survey). Start with: what my company
>    sells, my commercial objective in my own words, and which market I want to focus on or enter.
> 2. Only record what I actually tell you. If I don't know something, mark it **UNKNOWN** — never guess a value
>    for capacity, MOQ, price, margin, certifications, customers, or competitors.
> 3. Separate every statement into one of: OBSERVED_FACT, CUSTOMER_PROVIDED_FACT, COMMERCIAL_INFERENCE,
>    HYPOTHESIS, UNKNOWN. If you infer something, label it COMMERCIAL_INFERENCE and tell me it's an inference.
> 4. Explicitly list my **unknowns** and **assumptions** at the end so I can see the gaps.
> 5. If I'm entering a **new market or exporting**, ask how my constraints change there (e.g. packaging and
>    shipping for international freight, minimum shipment economics, required documentation) — but still never
>    invent regulatory or buyer facts; mark them UNKNOWN or "requires validation".
> 6. Do not add companies, buyers, volumes, prices, or compliance conclusions I did not give you.
>
> When we're done, output two things: (a) a short human-readable summary I can read, and (b) a single fenced
> ```json block following exactly this shape: [paste the schema from §4]. Leave fields empty where unknown.

## 6. Customer control before use (§15)
On paste, LeadLens: parses the JSON → renders a review panel (each field + its fact type + source) →
highlights **missing critical** and **unknown** fields → lets the customer edit → requires explicit
confirmation → only then normalizes into `ConfirmedCommercialContextV1` (+ constraints envelope) for the run.
Nothing from the external AI is treated as verified until the customer confirms it.

## 7. Reuse + safety
- Reuses the canonical Stage-A interpret/confirm path and `ConfirmedCommercialContextV1`; the constraints
  envelope is additive and optional. No parallel schema, no per-customer template.
- Customer economics (price/margin) are **never** surfaced in any public/customer-facing deliverable; they only
  sharpen internal qualification + "commercial constraints / unknowns" modules.
- Generalizable (§39): every field and the prompt apply to any customer, including any new-geography/export entry.
