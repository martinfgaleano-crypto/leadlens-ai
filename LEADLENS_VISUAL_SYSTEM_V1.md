# LeadLens Visual System V1 — palette + tokens

The deliberate, documented LeadLens visual language. Verdict on the pre-existing palette:
**refine + formalize** (not replace) — the navy/blue/neutral family already reads as trust +
intelligence; V1 formalizes it into named semantic tokens, reserves green for *evidence* (never
"Prioritize = green"), and gives uncertainty a calm neutral (never alarming red).

## Core palette

| Token | Hex | Semantic role | Use | Do NOT use |
|---|---|---|---|---|
| Brand Navy | `#0b1220` → `#0c4a6e` (gradient) | Product identity / frame | Top frame, Opportunity Case header band | Whole-page backgrounds (never all-dark) |
| Primary Intelligence Blue | `#0284c7` | The LeadLens accent — selection, links, decision-Prioritize | Selected account, primary links, Prioritize | Generic "success" |
| Interactive Accent | `#0ea5e9` | Signature / What-Changed marker, spine nodes | What Changed accent, reasoning-spine nodes | Body text |
| Evidence tone | `#0e7490` (cyan-700) | Evidence strength | "Strong/Moderate" evidence emphasis | Decisions |
| Confirmed / Supporting | `#15803d` (green) | Independent support / corroboration / verified | "Supporting" relation, corroborated | Prioritize decision (never green=good) |
| Validation tone | `#b45309` / dot `#d97706` / bg `#fffbeb` / border `#fde9c8` | Important unresolved question | Validate decision, "Decision-critical", What to Validate | Error/warning aesthetic |
| Monitor tone | `#475569` / dot `#94a3b8` | Active, lower urgency | Monitor decision | Red |
| Hold tone | `#64748b` / dot `#cbd5e1` | Not justified now | Hold decision | Red |
| Uncertainty (What Could Change) | neutral `#f8fafc` band + `#94a3b8` node | Rigorous, not alarming | "What Could Change the Case" band | Giant red warnings |
| Background | `#f5f7fa` | App background (soft, not harsh white) | Page ground | Pure `#fff` everywhere |
| Primary surface | `#ffffff` | Cards / Case object | Opportunity Case, portfolio cards | — |
| Secondary surface | `#f8fafc` | Bands / sub-areas | Uncertainty band, source blocks | — |
| Border | `#e8edf3` / soft `#edf1f6` / hairline `#f1f5f9` | Structure | Case border, band separators | Heavy 1px boxes around every concept |
| Text primary | `#0f172a` | Titles, claims | Account name, decision, body | — |
| Text secondary | `#475569` | Explanation | Thesis, why-it-matters, rationale | Metadata |
| Muted text | `#94a3b8` | Metadata / labels | Section labels, dates, geography | Body |

**Contrast:** all text tones on their surfaces exceed WCAG AA for body; decision/state colors
carry a **text label** always (color is never the only signal), and read correctly in grayscale
/ print (Prioritize=blue, Validate=amber, Monitor/Hold=slate — distinguishable by tone + label).

## Decision-state system (not a traffic light)

| State | Meaning | color / dot / bg / border |
|---|---|---|
| Prioritize | evidence justifies attention now | `#0369a1` / `#0284c7` / `#f0f9ff` / `#e0f2fe` |
| Validate | promising, unresolved question could change the case | `#b45309` / `#d97706` / `#fffbeb` / `#fde9c8` |
| Monitor | relevant, timing/evidence not sufficient yet | `#475569` / `#94a3b8` / `#f8fafc` / `#eef2f6` |
| Hold | not justified now | `#64748b` / `#cbd5e1` / `#f8fafc` / `#eef2f6` |

`Exclude` is **not** a Case decision — it belongs to screening, never shown beside these four.

## Type scale (system fonts only — no webfont, portable-safe)

- Brand `18/800`, Portfolio title `24/800`, **Case (account) title `21–26/800`**, section label
  `10.5/700 UPPERCASE .09em muted`, decision state `11.5/700 UPPERCASE`, body `14/1.6`, evidence
  claim `12.5–13/1.5`, metadata `11–12/muted`, compact metric `15–16/700`.
- Uppercase is **selective** — reserved for signature labels (What Changed, Evidence, What to
  Validate, Decision) and micro-labels; never for whole UI.

## Spacing / surface / radius / shadow

- Spacing scale 4 / 8 / 12 / 16 / 20 / 24. Case padding 22–26.
- **2–3 surface levels** only (background → surface → band), not ten.
- Radius: 14 (Case), 12 (bands/cards), 999 (badges). Shadow: `0 1px 2px rgba(15,23,42,.04)` only
  where hierarchy needs it.
- Borders sparing: one Case border + hairline band separators + the reasoning-spine rule — **no
  rectangle around every concept**.

## Signature — the reasoning spine

LeadLens's differentiation is a *reasoning chain*, so the visual signature is a **left spine**
(a 2px rail with nodes) that connects the Opportunity Case bands in reading order: What Changed →
Why It Matters Now → Evidence → What Could Change the Case → What to Validate → Decision. The
What-Changed node is filled Interactive Accent; the Decision node is filled Prioritize-blue and
closes the case. This makes the Case one coherent object, recognizable without the logo.

## Where applied
Portable deliverable (live), the two pilots. The workspace and landing sample reuse the same
tokens/grammar in a later pass (see the sprint report's landing decision).
