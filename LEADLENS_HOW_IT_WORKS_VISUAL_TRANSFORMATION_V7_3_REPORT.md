# LeadLens — How It Works Visual Transformation + Pricing Anchor Final Polish V7.3

Two precise goals: (1) make How it works accurate to LeadLens' real value (commercial
context → opportunity criteria, ICP optional) and materially more compelling; (2) refine
the **desktop** Pricing anchor so the offer feels more centered, keeping mobile
section-start. Hero, Sample Output, pricing cards, nav, backend — untouched.

1. **Initial HEAD:** `88f3a23`
2. **Final HEAD:** the commit below.
3. **Current headline (before):** `From your ideal customer profile to a decision — in three steps.`
4. **Headline options evaluated:**
   - A `From commercial context to accounts worth working — in three steps.` — clarity 9, hero-continuity 9, commercial 9, premium 8.5, mobile-wrap ok.
   - B `From what you know to where to focus — in three steps.` — clarity 8.5, continuity 6, commercial 7.5.
   - C `Turn commercial context into accounts worth working.` — clarity 8.5, continuity 8, drops "3 steps".
   - D `From your market context to a defensible account decision.` — premium 9, but longer, weaker continuity.
5. **Selected headline:** **A** — `From commercial context to `**`accounts worth working`**` — in three steps.` ("accounts worth working" in LeadLens blue, echoing the hero "…accounts worth working now."). PT uses "contas que valem o esforço" to avoid an awkward literal.
6. **Step 1 issue (before):** `Define` + "Tell LeadLens what matters — your business, ICP and target market." implied a mature ICP + defined market were prerequisites.
7. **Final Step 1 title:** **Set the context** (ES "Define el contexto", PT "Defina o contexto", JA "コンテキストを設定").
8. **Final Step 1 copy:** "Tell LeadLens what you sell, who you serve and where you're trying to grow. **Have an ICP? We'll use it. If not, we'll help structure the criteria.**"
9. **ICP optionality:** stated explicitly in copy *and* shown in the visual (context inputs → refined criteria). ICP is useful, not mandatory.
10. **Step 1 visual:** three context input rows — What you sell / Who you serve / Where you want to grow — converging (↓) into one highlighted **Opportunity criteria** chip. Communicates: LeadLens turns imperfect context into usable criteria.
11. **Final Step 2 copy:** "LeadLens finds relevant accounts, identifies meaningful changes and evaluates the dated evidence behind them."
12. **Step 2 visual:** the real analytical grammar in miniature — **What changed:** Regional expansion → **Supported by:** 3 dated sources → corroboration ladder **Observed → Confirmed → Corroborated** (last emphasized). Reuses the hero/`/sample` language.
13. **Final Step 3 copy:** "Get a prioritized portfolio and Account Briefs showing where to focus, why and what to validate next."
14. **Step 3 visual:** a real output state — **DecisionPill "Prioritize"** (reused primitive) + reason "Expansion + strong fit, corroborated" + "Validate → Procurement ownership". Clearly the result of Steps 1–2.
15. **Desktop connector system:** three restrained cards on one continuous line; between them a **thin gradient line + a small `›` chevron** (replacing the oversized standalone blue arrows). Reads as one sequence. Editorial `01/02/03` numbers with a hairline.
16. **Mobile connector system:** a single **vertical spine** (dot + connecting line) that each stage attaches to — not big cards with arrows between. Distinct DOM from desktop, toggled by CSS at ≤820px.
17. **Generic-card reduction:** lighter borders, more internal whitespace, product-derived mini visuals, one continuous connector — no longer "three generic SaaS cards."
18. **Product primitive reuse:** DecisionPill, corroboration ladder, What-changed / Supported-by grammar, validation state — same vocabulary as hero + `/sample` + Account Brief.
19–22. **Before/after render:** 1440/390 before = three identical text-only cards + big rotated arrows (desktop) / stacked cards + arrows (mobile). After = connected stages with product-derived mini visuals (desktop line+chevron; mobile spine). (Preview pane renders blank mid-page — verified via DOM geometry: desktop 3 equal cards in one row + 2 connectors between; mobile 3 spine stages, 0 overflow.)
23. **How-it-works quality before→after:** ~8.0 → **8.8**.
24. **Product understanding before→after:** ICP-appears-mandatory → **ICP optional; context→criteria clear** (~7.5 → 9.0).
25. **6-point clarity test:** A bring existing ICP ✓ · B no perfect ICP needed ✓ · C context→criteria ✓ · D investigates accounts/changes ✓ · E grounds in evidence ✓ · F prioritized accounts + decision Brief ✓ = **6/6**.
26. **Visual-without-copy test:** context inputs→criteria / change→3 sources→corroborated / Prioritize→validate reads as context → investigation → decision = **YES**.
27–30. **Localization EN/ES/PT/JA:** headline (object with blue emphasis), all step titles/copy, and mini-visual labels (inputs, criteria, changed, supported, ladder, reason, validate) localized in all four. JA at 360 verified non-truncating; DecisionPill state label reused (product-UI, English) consistent with the hero canvas. No English leakage in marketing copy.
31. **Pricing desktop anchor (before):** 220px offset — heading@72, grid@220, ~80% visible; founder felt "slightly high."
32. **Pricing desktop anchor (after):** **270px** — heading@122 (52px below the sticky nav), grid@270 filling the central/lower majority; feels centered.
33. **1440 pricing:** heading@122, grid@270, **87%** visible (93px below fold).
34. **1280 pricing:** heading@122, grid@270, **73%** visible.
35. **1024 pricing:** heading@122, grid@270, **69%** visible, 2-col.
36. **390 pricing:** unchanged — eyebrow@96 (section start), first plan below (300px mobile offset preserved).
37. **Direct hash:** `/#pricing` desktop = 270 composed/centered; mobile = 300 section-start (same CSS honors both). How-it-works anchor: desktop heading@171 + full flow visible; mobile eyebrow@112 section-start.
38. **Page heights:** 360 ≈ 9,771 → **9,969** (+198 for the richer mini-visuals, under the ~10,000 target); 390 ≈ 9,570.
39. **Overflow:** 0 horizontal at 360/375/390/430/768/1024/1280/1440.
40. **Accessibility:** connectors/dots are `aria-hidden`; all meaning is in text (comprehension never depends on a connector). DecisionPill keeps text+dot.
41. **Performance:** no library — CSS + inline SVG-free markup + reused components.
42. **Tests:** `test:v7-landing-guards` **33/33** (adds H1–H8: commercial-context headline, ICP-optional, primitive reuse, connected layout, localized viz); `test:commercial-continuity` 17/17.
43. **TypeScript:** `npx tsc --noEmit` clean.
44. **Build:** `rm -rf .next && npm run build` succeeded (142 pages).
45. **Commit:** `feat: V7.3 — How it works transformation + desktop pricing anchor centering`.
46. **Push:** not pushed (GitHub Desktop).
47. **Stop:** How it works no longer implies a mandatory ICP; context→criteria→investigation→evidence→decision is shown with product-derived mini visuals; desktop is one elegant connected sequence, mobile a purposeful vertical spine; desktop pricing lands more centered; mobile pricing stays section-start; localized; 0 regression. **Stopping.**
