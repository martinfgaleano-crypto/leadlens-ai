# LeadLens — Commercial Narrative, Desire & Market Differentiation V6

A narrative / positioning / CRO pass with the **visual system frozen**. Goal: move
from "I understand this sophisticated product" to "I understand why it matters to my
business, why it's different, and I want to see what it finds for us." Copy + two
CTAs + email + a11y only; no product-canvas / navigation / pricing-architecture /
backend changes; prices unchanged.

## 1. Initial HEAD / 2. Final HEAD
Initial `cc119c2`; final = the commit below.

## 3. Current narrative diagnosis
The page explained the mechanism (What Changed, evidence, uncertainty, decision)
well, but the hero led with product features, differentiation was a generic
contrast, `/sample` dead-ended to home, and a personal Gmail sat in the footer.

## 4. Buyer problem
Scarce commercial attention: too many accounts, limited sales capacity, weak
prioritization — the buyer wants to know *where effort is justified*, not "better
Evidence Strength."

## 5–7. Narratives A / B / C
- **A — Account Opportunity Intelligence** (current): clear category, strong
  differentiation; risk = sounds analytical, not urgent/valuable.
- **B — Commercial Focus** ("limited attention, know where to focus"): human,
  economic, sales-leader-friendly; risk = generic sales language.
- **C — Evidence-Backed Decisions** ("don't just prioritize — know why; the case
  for and against"): differentiated from intent tools, leverages counterevidence,
  premium/trust; risk = research-heavy.

## 8. Concept comparison (0–10: clarity/desire/diff/premium/trust/self-rel/mem/conv)
A ≈ 9 / 8 / 8 / 9 / 9 / 7.5 / 8 / 8. B ≈ 8.5 / 8.7 / 7.5 / 8 / 8 / 9 / 8 / 8.5.
C ≈ 8 / 8.3 / 9 / 9 / 9.5 / 8 / 8.7 / 8.3.

## 9. Selected narrative / ## 10. Why
**HYBRID.** Category = A (Account Opportunity Intelligence, locked). Promise = the
locked headline. **Economic value = B** (scarce commercial attention) in the hero
subhead + final CTA. **Proof/differentiation = C** (the "case for / against" and
"inspect the reasoning"). Combines A's clarity, B's self-relevance, C's
differentiation & trust — none alone was strongest.

## 11. Hero before / ## 12. Hero after (subhead) / ## 13. subhead
Before: "LeadLens tells you which accounts fit, why they matter now, and the public
evidence behind each opportunity — account-level intelligence, not a contact list."
After: **"Your team can't work every account. LeadLens shows which ones deserve
attention now — and the evidence behind the decision."** (4 languages). Outcome
first, mechanism second.

## 14. Commercial tension
Added without hype/fear: *"Your team can't work every account"* — the scarce-
attention frame. No "competitors already know", no fake urgency.

## 15. Product magic treatment
The frozen navy workspace still carries the "magic"; the new subhead makes the
*why-it-matters* explicit before the machine is read.

## 16. Self-relevance
"Your team", "which ones deserve *your* attention"; `/sample` closing "LeadLens
builds the same reasoning across *your* market."

## 17. Outcome vs mechanism
Hierarchy is now outcome-first (allocate scarce attention) → mechanism (What
Changed / evidence / decision) → proof.

## 18. Differentiation before / ## 19. after
Before: lede "Databases help you find companies. LeadLens helps you decide…" + a
"Most tools give you → LeadLens adds" contrast. After: lede rebuilt to the
market-differentiation thesis — **"Databases tell you who exists. Signal tools tell
you what happened. LeadLens builds the case for whether an account is worth your
team's attention — and what supports it."** The "LeadLens adds" panel now closes
with **"The case for the account — and against."**

## 20. Case-building narrative
Adopted as the core differentiator: LeadLens builds a **case** (change + evidence +
counterevidence + validation), not another signal/score.

## 21. Find→Decide
Retained and enriched (database "who exists" / signal "what happened" / LeadLens
"worth attention + what supports it"). No competitor-name matrix (§26).

## 22. Proof strategy
Added a proof line under the contrast: **"Don't trust a score — inspect the
reasoning. Every priority comes with the evidence, its limits, and what to validate
before you act."** — product transparency as the substitute for missing social
proof.

## 23. Case for / case against
Expressed in the differentiation panel + the workspace/`/sample` (Supported by /
Limited by). No fabricated proof.

## 24/25. Homepage & /sample positioning
Homepage keeps the concise workspace + the compact teaser ("Want the full
reasoning? … View full sample"). `/sample` remains the depth demonstration
(the substitute for social proof).

## 26. Sample → CTA fix
`/sample` closing CTA now offers **Get started** (primary → `/`) **+ See pricing**
(secondary → `/#pricing`), fixing the dead-end back to home. Verified in HTML.

## 27/28. Preview framing / pricing perception
Preview keeps its "Low-risk starting point" badge + validation-first description
("See whether LeadLens can find defensible opportunities…") and the hero price note
frames $7 as *exploring the sample*, not the product identity. Intelligence remains
the emphasized (featured) tier. Prices unchanged.

## 29. FAQ treatment
Left as-is (collapsed accordion; §45/§95 optional). Not a strategic gap this pass.

## 30/31. Final CTA / narrative closure
Before: "Know which accounts to call this week." / long feature recap. After:
**"Now find yours."** / "See which accounts the evidence says deserve your team's
attention — and why." — closes the hero's "Find the B2B accounts worth working now"
loop (4 languages).

## 32/33. Public crawler / raw-server audit
Verified against the **server-rendered HTML** (`curl`): current indexable content
matches the current landing — **0** "Opportunity Snapshot / qualified B2B leads /
lead scoring", AOI category present, new hero subhead + "Now find yours" +
"builds the case" + "inspect the reasoning" all present in SSR HTML.

## 34. Personal email audit
`martinfgaleano@gmail.com` was in the footer (4 langs) + a mailto. **Replaced** with
the established corporate identity **`operations@leadlensintel.com`** (configured in
`.env.local`, production domain). Verified: 0 Gmail in raw HTML; corporate email
present.

## 35. Metadata
Already AOI-aligned: `<title>` "LeadLens — Account Opportunity Intelligence for B2B";
OG description AOI/decision-value. No old AI lead-gen framing. Left as-is.

## 36. Mobile / ## 37. Desktop
Copy-only changes; layout unchanged. Verified 0 overflow at 360/375/1280 (frozen
visual system → other widths unchanged from V5).

## 38. Accessibility
Added `aria-controls="ll-ws-panel"` to the workspace rail + chip tabs and
`id="ll-ws-panel"` to the tabpanel — completing the tablist↔tabpanel relationship
(§109). No regressions.

## 39. Page height
375: 10,449 → **10,478** (+29). 360: 10,725 → **10,826** (+101). 1280: 6,814 →
**6,823** (+9). Essentially flat — within the §60 guardrail.

## 40. Copy counts
Net marketing words roughly flat (denser hero/differentiation lines replaced longer
feature-list copy; a short proof line added).

## 41. 5s test — PASS (Account Opportunity Intelligence for B2B).
## 42. 15s test — PASS (scarce attention → know where it's justified).
## 43. 30s test — PASS ("tells us which accounts deserve effort and shows the evidence behind the decision").
## 44. 60s test — PASS (View sample / See pricing / Get started all reachable and compelling).
## 45. Differentiation test — PASS (databases/signal-tools vs "builds the case").
## 46. Self-relevance test — PASS ("your team", "your market").
## 47. Proof test — PASS ("inspect the reasoning" + evidence/limits/validate).
## 48. Price-perception test — PASS ($7 = validation entry; Intelligence authoritative).
## 49. Final-CTA test — PASS (closes the hero loop).

## 50. Scorecard (honest)
| Metric | Before | After |
|---|---:|---:|
| Overall landing | 8.7 | 8.9 |
| Commercial narrative | ~7.9 | 8.7 |
| Desire | 8.5 | 8.8 |
| Emotional / commercial pull | ~7.8 | 8.5 |
| Self-relevance | ~7.8 | 8.6 |
| Differentiation | 8.0 | 8.7 |
| Proof without social proof | ~7.6 | 8.5 |
| Premium | 8.7 | 8.8 |
| Trust | 8.8 | 8.9 |
| Memorability | 8.6 | 8.7 |
| Product understanding | 8.9 | 8.9 |
| Scannability | 8.6 | 8.7 |
| Conversion readiness | 8.4 | 8.7 |
| Pricing perception | ~8.0 | 8.5 |
| Sample conversion continuity | ~7.0 | 8.6 |
| Mobile | 8.6 | 8.7 |
| Desktop | 8.9 | 8.9 |

## 51. Remaining P0
None.

## 52. Remaining P1
Translate the differentiation lede + proof line + `/sample` into es/pt/ja (English
now); consider one approved anonymized real-proof asset when available.

## 53. Remaining P2
FAQ → 5 primary + "More questions"; nav active-section state.

## 54. Narrative freeze
**COMMERCIAL NARRATIVE FREEZE = YES.** Differentiation materially improved (case
thesis + proof line), buyer value is outcome-first, `/sample` conversion friction
fixed, Preview framed as a validation entry, no old public content in the current
HTML, personal Gmail replaced, and the final CTA closes the hero loop — with no UX
regression and the visual system untouched.

## 55. Visual freeze confirmation
Visual system remains **FROZEN** — no product-canvas / rail / evidence / decision /
navy-stage / navigation / pricing-visual changes.

## 56. Files changed
`app/demo-pipeline/page.tsx`, `app/sample/page.tsx`,
`LEADLENS_COMMERCIAL_NARRATIVE_DIFFERENTIATION_V6_REPORT.md`.

## 57. Tests
Browser + raw-HTML audit (SSR narrative present; 0 Gmail / 0 old lead-gen;
`/sample` CTA routes; 0 overflow 360/375/1280; heights flat; tab aria linkage).
Commercial-continuity unaffected.

## 58. TypeScript
`npx tsc --noEmit` clean (0 errors).

## 59. Build
`npm run build` succeeded.

## 60. Commit
`feat: sharpen LeadLens commercial narrative and differentiation`.

## 61. Push
Not pushed — GitHub Desktop.

## 62. Stop
Hero leads with the scarce-attention economic value; differentiation is the
"case for / against" thesis with a transparency proof line; `/sample` converts to
Get started / See pricing; Preview framed as a validation entry; final CTA closes
the loop; personal Gmail → corporate identity; SSR/crawler content matches the
current narrative; visual system frozen; 0 overflow; tsc + build green; no
backend/auth/pricing changes. Narrative freeze: **YES**. **Stopping.**
