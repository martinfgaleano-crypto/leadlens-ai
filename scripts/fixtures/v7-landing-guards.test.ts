// V7 landing guards — deterministic, source-level (0 provider calls, 0 network).
// Locks the reliability + clarity + navigation invariants the V7 sprint fixes:
//   A. Atlas selection can't crash (no unknown STRENGTH key; FTE has a fallback).
//   B. Paid $7 entry and the free public sample are separated; one hero sample CTA.
//   C. Pricing (and other) nav anchors land on real content, not just a title:
//      the sticky nav actually pins (overflow-x:clip) and a pricing scroll anchor
//      with a tuned scroll-margin exists.
//   D. Public marketing copy is localized in all 4 locales (no English-only leaks).
//   E. The awkward How-it-works heading is gone.
// Run: npm run test:v7-landing-guards
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

const src = readFileSync("app/demo-pipeline/page.tsx", "utf8");
const count = (re: RegExp) => (src.match(re) || []).length;

// ─── A. Atlas reliability ─────────────────────────────────────────────────────
// WS_ACCOUNTS strength fields must only use rendered STRENGTH keys.
const wsBlock = src.slice(src.indexOf("const WS_ACCOUNTS"), src.indexOf("const REL_COLOR"));
t("A1 no unrendered strength value 'Developing' in workspace accounts", !/evidence:\s*"Developing"/.test(wsBlock));
t("A2 workspace strengths use only Strong/Moderate/Limited",
  (wsBlock.match(/(?:fit|timing|evidence):\s*"([^"]+)"/g) || [])
    .every((m) => /"(Strong|Moderate|Limited)"$/.test(m)));
t("A3 FTE strength lookup has a crash-proof fallback", /STRENGTH\[val\]\s*\?\?/.test(src));

// ─── B. Hero: concise $7 validation-entry microcopy, single sample action ─────
// The free-sample/no-card clause was removed (View sample implies free browsing);
// the note is now a concise $7 validation-entry line (§197–200).
t("B1 hero price note is the concise $7 validation entry (no free-sample/no-card clause)",
  /heroPriceNote:\s*"[^"]*\$7[^"]*"/.test(src) && !/viewing the sample is free/.test(src) && !/no card needed/.test(src));
// The hero-only underline demo link (class ll-hero-demo-link) is removed; the
// tryDemoCTA key legitimately still drives banners in the non-hero demo views.
t("B2 redundant hero 'Preview sample report' demo link removed", !/ll-hero-demo-link/.test(src));
t("B3 hero keeps exactly one sample action — the View sample button", /copy\.heroSeeAll/.test(src));

// ─── F. Sample Output shows the deliverable (real primitives, not marketing art) ─
const briefBlock = src.slice(src.indexOf("function SampleBriefCard"), src.indexOf("function OpportunityMockupHero"));
t("F1 SampleBriefCard reuses the real intelligence primitives",
  /function SampleBriefCard\(\)/.test(src) && /WS_ACCOUNTS\[0\]/.test(briefBlock) && /<CanvasStep[\s\S]*?label="Decision"/.test(briefBlock));
t("F2 Sample section renders the SampleBriefCard (SHOW, not tell)", /<SampleBriefCard \/>/.test(src));
t("F3 Sample headline shows reasoning (not 'this is what it looks like')",
  /samplePreviewTitle:\s*"See the reasoning/.test(src) && !/This is what an Account Brief looks like/.test(src));
t("F4 Sample layout uses robust line-based grid (no grid-template-areas, which the build strips)",
  /ll-sample-grid/.test(src) && /\.ll-sample-proof\s*\{[^}]*grid-column:\s*2/.test(src) && !/grid-template-areas:\s*"/.test(src));

// ─── I. V8 mobile experience ──────────────────────────────────────────────────
t("I1 market-transition copy is 'Markets change. Your priorities should too.'",
  /heroCuriosity:\s*"Markets change\."/.test(src) && /heroCuriosityEmph:\s*"Your priorities should too\."/.test(src));
t("I2 old 'already watching' transition copy removed", !/already watching/.test(src));
t("I3 transition copy localized in 4 locales", (src.match(/heroCuriosityEmph:/g) || []).length === 4);
t("I4 FAQ rows are collapsible accordions with chevron state",
  /className="ll-faq-item"/.test(src) && /<details[^>]*open=\{i === 0\}/.test(src) && /ll-faq-item\[open\] \.ll-faq-chev/.test(src));
t("I5 FAQ accordion summary has a comfortable touch target", /\.ll-faq-item summary \{[^}]*min-height:\s*44px/.test(src));

// ─── J. V8.1 hero precision + mobile pricing compaction ───────────────────────
t("J1 hero support copy is the analytical 'Turn market evidence…' line",
  /heroSub:\s*"Turn market evidence into clearer account decisions\."/.test(src));
t("J2 old 'work every account' hero support copy removed", !/can't work every account/.test(src));
t("J3 hero support copy localized in 4 locales", (src.match(/heroSub:/g) || []).length === 4);
t("J4 pricing amounts intact ($7/$25/$59/$129)",
  /price:\s*"\$7"/.test(src) && /price:\s*"\$25"/.test(src) && /price:\s*"\$59"/.test(src) && /price:\s*"\$129"/.test(src));
t("J5 pricing tier names intact (Preview/Brief/Intelligence/Premium)",
  /planNames:\s*\{\s*sample:\s*"Preview",\s*starter:\s*"Brief",\s*standard:\s*"Intelligence",\s*pro:\s*"Premium"\s*\}/.test(src));
t("J6 mobile pricing compaction is mobile-only (desktop card untouched)",
  /\.ll-price-card \{ padding: 1\.25rem[^}]*text-align: left/.test(src) && /padding: "2rem"/.test(src));

// ─── K. V8.2 mobile hero recomposition (mobile-only; desktop preserved) ───────
t("K1 H1 is the account-attention headline (not B2B-defined)", /heroH1hi:\s*"deserve attention now"/.test(src));
t("K2 promo banner + duplicate H2 + reassurance pill are HIDDEN on mobile",
  /\.ll-announce \{ display: none/.test(src) && /\.ll-hero-h2\s*\{ display: none/.test(src) && /\.ll-hero-note \{ display: none/.test(src));
t("K3 banner/H2/pill still render on desktop (hidden only via mobile media query)",
  /className="ll-announce"/.test(src) && /className="ll-hero-h2"/.test(src) && /className="ll-hero-note"/.test(src));
t("K4 mobile secondary CTA is a light text link (not a second heavy button)",
  /\.ll-hero-cta2 \{[^}]*background: none[^}]*border: none/.test(src) && /className="ll-hero-cta2"/.test(src));
t("K5 single hero support line retained (analytical)", /heroSub:\s*"Turn market evidence into clearer account decisions\."/.test(src));

// ─── L. V8.3 mobile hero editorial recomposition + localization closeout ──────
t("L1 mobile hero is left-aligned editorial", /\.ll-hero-left \{ text-align: left/.test(src));
t("L2 mobile eyebrow is a restrained inline marker (no pill, uppercase)",
  /\.ll-hero-badge \{ background: none[^}]*text-transform: uppercase/.test(src));
t("L3 mobile CTA actions sit on one row", /\.ll-hero-cta-row \{ flex-direction: row/.test(src));
t("L4 hero price line is commercially neutral 'Plans from $7' — no 'one-time' identity (4 locales)",
  /heroPriceNote:\s*"Plans from \$7\."/.test(src) && (src.match(/heroPriceNote:/g) || []).length === 4 && !/heroPriceNote:\s*"[^"]*one-time/.test(src));
t("L5 product canvas pulled near the screen edge on mobile", /\.ll-hero-mock\s+\{ margin:[^}]*-\.6rem/.test(src));
t("L6 rendered pricing copy has no stale lead-list framing (planFeatures + comparison)",
  // planFeatures no longer diverge with old "Market Map / oportunidades rankeadas".
  !/oportunidades rankeadas/.test(src) && !/oportunidades ranqueadas/.test(src) &&
  !/Market Map — 6/.test(src) && !/Market Map ampliado/.test(src) &&
  // rendered comparison row uses "prioritized", not "ranked", across locales.
  !/Briefs de oportunidad rankeados/.test(src) && !/Briefs de oportunidade ranqueados/.test(src) &&
  /Prioritized opportunity briefs/.test(src));

// ─── M. V8.4 mobile acquisition-first value layer ─────────────────────────────
t("M1 heroValue acquisition block localized in 4 locales", count(/heroValue:\s*\{/g) === 4);
t("M2 value layer rendered as editorial rows (not feature cards, not numbered)",
  /className="ll-hero-value"/.test(src) && /ll-hero-value-row/.test(src) && /ll-hero-value-dot/.test(src));
t("M3 value layer is mobile-only (hidden on desktop, shown ≤640)",
  /\.ll-hero-value \{ display: none; \}/.test(src) && /\.ll-hero-value \{ display: block !important/.test(src));
t("M4 hero secondary CTA uses a direct class (robust vs stripped combinator)",
  /className="ll-hero-cta2"/.test(src) && /\.ll-hero-cta2 \{[^}]*background: none/.test(src));
t("M5 value outcomes map to product grammar (focus / changed / evidence), no lead-gen framing",
  /"Know where to focus"/.test(src) && /"Understand what changed"/.test(src) && /"Act with evidence"/.test(src) &&
  !/heroValue:[\s\S]{0,600}(lead list|hot lead|buying intent|contact list)/i.test(src));
t("M6 H1 + support still intact", /heroH1hi:\s*"deserve attention now"/.test(src) && /heroSub:\s*"Turn market evidence into clearer account decisions\."/.test(src));

// ─── N. V8.5 product-truth + brand + legal-email closeout ─────────────────────
t("N1 footer brand is 'LeadLens' (not 'LeadLens AI') with AOI category, 4 locales",
  !/LeadLens AI/.test(src) && (src.match(/© 2026 LeadLens —/g) || []).length === 4);
t("N2 After-you-buy has no mandatory-ICP or 'score each opportunity' framing",
  !/Submit your ICP/.test(src) && !/score each opportunity/i.test(src) && !/detect signals and score/i.test(src) &&
  /Share your commercial context — ICP optional\./.test(src));
t("N3 no 'score accounts' / 'puntuamos cuentas' / 'pontuamos contas' / スコアリング in FAQ",
  !/score accounts/i.test(src) && !/puntuamos cuentas/.test(src) && !/pontuamos contas/.test(src) && !/アカウントをスコアリング/.test(src));
t("N4 Preview validation line no longer hinges on a mandatory ICP",
  /is LeadLens useful for my commercial context\?/.test(src) && !/is this worth it for my ICP/.test(src));
t("N5 Monitor does not claim continuous/real-time market intelligence",
  !/continuous market intelligence/.test(src) && !/inteligencia de mercado continua/.test(src) && /periodic account re-evaluation/.test(src));
t("N6 final CTA is commercially neutral 'Get started →' (no $7/one-time anchor)", /ctaCTA:\s*"Get started →"/.test(src) && !/ctaCTA:\s*"[^"]*(one-time|\$7)/.test(src));
t("N7 'Don't trust a score — inspect the reasoning' preserved", /Don't trust a score — inspect the reasoning/.test(src));
{
  const legal = ["app/terms/page.tsx", "app/privacy/page.tsx", "app/refund/page.tsx"].map((f) => readFileSync(f, "utf8")).join("\n");
  t("N8 legal pages use corporate email (no personal Gmail)",
    !/martinfgaleano@gmail\.com/.test(legal) && /operations@leadlensintel\.com/.test(legal));
}

// ─── G. Responsive anchors (desktop composed vs mobile start) + FAQ ───────────
t("G1 pricing anchor desktop vs mobile scroll-margin differ (composed/centered vs start)",
  /\.ll-price-anchor\s*\{\s*scroll-margin-top:\s*270px/.test(src) && /max-width:\s*580px\)\s*\{\s*\.ll-price-anchor\s*\{\s*scroll-margin-top:\s*300px/.test(src));
t("G2 FAQ compressed to 5 primary + 'More questions' disclosure",
  /faqMore:/.test(src) && /copy\.faqs\.slice\(0,\s*5\)/.test(src) && /copy\.faqs\.slice\(5\)/.test(src));
t("G3 faqMore + sampleSeePricing localized in 4 locales",
  (src.match(/faqMore:/g) || []).length === 4 && (src.match(/sampleSeePricing:/g) || []).length === 4);

// ─── C. Sticky nav + pricing anchor ───────────────────────────────────────────
t("C1 .ll-root uses overflow-x:clip so the sticky nav actually pins", /\.ll-root\s*\{\s*overflow-x:\s*clip/.test(src));
t("C2 no overflow-x:hidden regression on .ll-root", !/\.ll-root\s*\{\s*overflow-x:\s*hidden/.test(src));
t("C3 dedicated pricing scroll anchor exists with id=pricing", /id="pricing"\s+className="ll-price-anchor"/.test(src));
t("C4 pricing anchor has a tuned scroll-margin (desktop + mobile)",
  /\.ll-price-anchor\s*\{\s*scroll-margin-top/.test(src) && /max-width:\s*580px\)\s*\{\s*\.ll-price-anchor/.test(src));

// ─── D. Localization (all 4 locales) ──────────────────────────────────────────
t("D1 differentiation lede localized in 4 locales", count(/diffLede:\s*\{/g) === 4);
t("D2 differentiation column labels localized in 4 locales", count(/diffOldLabel:/g) === 4 && count(/diffNewLabel:/g) === 4);
t("D3 proof line localized in 4 locales", count(/diffProofBold:/g) === 4);
t("D4 sample teaser localized in 4 locales", count(/sampleTeaserText:/g) === 4 && count(/sampleTeaserCTA:/g) === 4);
t("D5 hero price note localized in 4 locales", count(/heroPriceNote:/g) === 4);
t("D6 differentiation JSX is driven by copy keys (not hardcoded English)",
  /copy\.diffLede\.pre/.test(src) && /copy\.diffProofBold/.test(src) && !/Databases tell you who exists\.[^"]*<strong/.test(src));
// ── DF. Differentiation as a PROGRESSION (semantic) — database → signals → LeadLens ──
t("DF1 differentiation is a progression database → signals → LeadLens (DIFF_LADDER, 4 locales)",
  (() => { const m = src.match(/const DIFF_LADDER[\s\S]*?\n\};/); return !!m &&
    (m[0].match(/db:\s*\[/g) || []).length >= 4 && (m[0].match(/sig:\s*\[/g) || []).length >= 4 && (m[0].match(/ll:\s*\[/g) || []).length >= 4; })() &&
  /who exists/.test(src) && /what happened/.test(src) && /why it matters now/.test(src));
t("DF2 LeadLens is the culmination — an emphasized ladder rung, not one of three equal cards",
  /className="ll-diffladder"/.test(src) && /ll-diffrung--ll/.test(src) && /ll-diffrung--db/.test(src) && /ll-diffrung--sig/.test(src));
t("DF3 differentiation is a ladder, not the old comparison grid/matrix",
  !/comparisonRows\.map/.test(src) && !/className="ll-diff-grid"/.test(src) && !/className="ll-diff-arrow"/.test(src));

// ─── HF. How-it-works FLOW (recomposed) — semantic invariants, not markup ─────
// The section is one continuous 5-stage reasoning flow, not a card row. These
// guards protect the MEANING (the five real stages, their order, no legacy
// framing, no false research claim), not exact DOM/classes/card counts. They
// replace the former E1-E2 + H1-H8 structural guards (§26).
t("HF1 flow states are Understand → Observe → Detect → Evaluate → Prioritize (EN, in order)",
  (() => {
    const m = src.match(/HOW_FLOW[\s\S]*?en:\s*\{[\s\S]*?nodes:\s*\[([\s\S]*?)\]\s*\}/);
    if (!m) return false;
    const ks = (m[1].match(/k:\s*"[^"]+"/g) || []).map((x) => x.replace(/k:\s*"([^"]+)"/, "$1"));
    return JSON.stringify(ks) === JSON.stringify(["Understand", "Observe", "Detect", "Evaluate", "Prioritize"]);
  })());
t("HF2 flow (HOW_FLOW) localized in 4 locales, five stages each",
  (src.match(/nodes:\s*\[/g) || []).length === 4 &&
  ["en", "es", "pt", "ja"].every((L) => { const m = src.match(new RegExp(`${L}:\\s*\\{[^}]*?nodes:\\s*\\[([\\s\\S]*?)\\]`)); return !!m && (m[1].match(/k:\s*"/g) || []).length === 5; }));
t("HF3 no legacy 'what you sell' / ICP-first framing survives",
  !/step1Copy:\s*"[^"]*what you sell/i.test(src) && !/From your ideal customer profile/.test(src) && !/ICP \(Ideal Customer Profile\) in/.test(src));
t("HF4 flow configures research — it does not claim research ran / was verified",
  !/HOW_FLOW[\s\S]{0,1400}(we verified|companies were found|accounts were found|externally verified)/i.test(src));
t("HF5 flow rendered from copy as an ordered list with a culmination stage",
  /HOW_FLOW\[lang\]/.test(src) && /className="ll-flow"/.test(src) && /<ol className="ll-flow"/.test(src) && /ll-flow-node--end/.test(src));

// ─── O. V9 final freeze (mobile lang selector, disclosures, compaction) ───────
t("O1 mobile hamburger has a localized language selector (aria-pressed, 44px)",
  /navLanguage/.test(src) && /aria-pressed=\{lang === o\.value\}/.test(src) && /LANG_OPTIONS\.map/.test(src));
t("O2 navLanguage localized in 4 locales", count(/navLanguage:/g) === 4);
t("O3 changeLang updates <html lang> on switch",
  /function changeLang\(l: OutputLanguage\)/.test(src) && /document\.documentElement\.lang = l/.test(src));
t("O4 After You Buy is a disclosure: open on desktop/SSR, collapsible on mobile",
  /const \[afterOpen, setAfterOpen\] = useState\(true\)/.test(src) &&
  /<details className="ll-afterbuy" open=\{afterOpen\}/.test(src) &&
  /matchMedia\("\(max-width: 640px\)"\)\.matches\) setAfterOpen\(false\)/.test(src));
t("O5 Opportunity Monitor: coming-soon/pilot, periodic (no real-time/continuous), $99/mo",
  /monthlyTag:\s*"Coming soon — Pilot access"/.test(src) &&
  /monitorSubMobile:\s*"Periodic account re-evaluation/.test(src) &&
  /monitorPrice:\s*"From \$99\/mo"/.test(src) &&
  !/real-time/i.test(src) && !/always-on/i.test(src) && !/continuous market intelligence/i.test(src));
t("O6 monitorSubMobile (compact teaser) localized in 4 locales", count(/monitorSubMobile:/g) === 4);
t("O7 per-card 'One-time payment' hidden on mobile (intro already states one-time)",
  /className="ll-price-onetime"/.test(src) && /\.ll-price-onetime\s*\{\s*display:\s*none/.test(src));
t("O8 how-it-works flow title is localized in 4 locales (replaces old mobile-heading split)",
  (() => { const m = src.match(/const HOW_FLOW[\s\S]*?\n\};/); return !!m && (m[0].match(/title:\s*"/g) || []).length === 4; })());
t("O9 prices unchanged ($7/$25/$59/$129) and product truth intact",
  /\$7/.test(src) && /\$25/.test(src) && /\$59/.test(src) && /\$129/.test(src) &&
  !/LeadLens AI/.test(src) && !/score each opportunity/i.test(src) && !/Submit your ICP/.test(src));

// ─── P. Landing sample adopts the Opportunity Case grammar (V1 adoption) ──────
t("P1 sample account data carries Opportunity Case fields (role/type/thesis/whyNow)",
  /role:\s*"Potential Customer"/.test(src) && /oppType:\s*"Operations Expansion"/.test(src) && /thesis:\s*"/.test(src) && /whyNow:\s*"/.test(src));
t("P2 sample renders the reasoning-spine grammar labels",
  /label="What changed"/.test(src) && /label="Why it matters now"/.test(src) && /label="Evidence"/.test(src) && /label="What to validate"/.test(src) && /label="Decision"/.test(src));
t("P3 Account Role · Opportunity Type kicker rendered", /\{a\.role\} · \{a\.oppType\}/.test(src));
t("P4 Opportunity Thesis rendered on the sample", /\{a\.thesis\}/.test(src));
t("P5 Why It Matters Now rendered", /\{a\.whyNow\}/.test(src));
t("P6 What to Validate is Decision-critical (not just 'Limited by')", /Decision-critical/.test(src) && /Still unknown/.test(src));
t("P7 evidence compressed on landing (summary + '+N more in the full Opportunity Case')", /in the full Opportunity Case/.test(src));
t("P8 Fit/Timing/Evidence remain the visible dimensions", /function FTE/.test(src) && /cell\("Fit", fit\)\}\{cell\("Timing", timing\)\}\{cell\("Evidence", evidence\)/.test(src));
// Scope the state / score / temperature checks to the SAMPLE region only (the
// WS_ACCOUNTS data + AccountWorkspace render), not dead/unrendered Viz code.
const sampleSrc = (() => { const a = src.indexOf("const WS_ACCOUNTS"); const b = src.indexOf("function SampleBriefCard"); return a > -1 && b > a ? src.slice(a, b) : ""; })();
t("P9 three sample accounts, one each Prioritize/Validate/Monitor (no HOLD needed)",
  (sampleSrc.match(/state:\s*"prioritize"/g) || []).length === 1 && (sampleSrc.match(/state:\s*"validate"/g) || []).length === 1 && (sampleSrc.match(/state:\s*"monitor"/g) || []).length === 1);
t("P10 landing product wedge unchanged — only Potential Customer role (no Supplier/Partner as account)",
  !/role:\s*"(Supplier|Distributor|Strategic Partner)"/.test(sampleSrc) && (sampleSrc.match(/role:\s*"Potential Customer"/g) || []).length === 3);
t("P11 no aggregate score in the sample (no NN/100, N.N/10, 'score')",
  sampleSrc.length > 0 && !/\b\d{1,3}\s*\/\s*100\b/.test(sampleSrc) && !/\b\d(?:\.\d)?\s*\/\s*10\b/.test(sampleSrc) && !/\bscore\b/i.test(sampleSrc));
t("P12 no HOT/WARM/COLD or buying-intent certainty in the sample",
  sampleSrc.length > 0 && !/\bHOT\b|\bWARM\b|\bCOLD\b/.test(sampleSrc) && !/ready to buy|buying intent|will buy|guaranteed/i.test(sampleSrc));

// ─── Q. Client Opportunity Canvas — client-level tabbed sample (adoption) ─────
t("Q1 sample is CLIENT-level (synthetic client is the subject, not a target account)",
  /const WS_CLIENT = \{/.test(src) && /name:\s*"Asteron Systems"/.test(src) && /<ClientCanvasSample \/>/.test(src) && !/<AccountWorkspace \/>/.test(src));
t("Q2 client header shows client name + commercial objective + opportunity count",
  /\{WS_CLIENT\.name\}/.test(src) && /objective:\s*"/.test(src) && /opportunities evaluated/.test(src));
t("Q3 canvas exposes the key inspection surfaces as tabs (overview + cases + evidence + compare)",
  /CC_TABS = \[[\s\S]*?"overview"[\s\S]*?"cases"[\s\S]*?"evidence"[\s\S]*?"compare"[\s\S]*?\]/.test(src));
t("Q4 canonical tab labels present (Overview / Opportunity Cases / Evidence / Compare / Portfolio Intelligence)",
  /Overview/.test(src) && /Opportunity Cases/.test(src) && /Evidence/.test(src) && /Compare/.test(src) && /Portfolio Intelligence/.test(src));
t("Q5 default view is DECISION-FIRST: leads with the account that deserves attention now + its decision + next action; portfolio read is detail-on-demand",
  /useState<CcTab>\("overview"\)/.test(src) && /Deserves attention now/.test(src) && /const top = WS_ACCOUNTS\[0\]/.test(src) && /top\.next/.test(src) && /LeadLens portfolio read/.test(src));
t("Q6 opportunities live INSIDE the canvas (tiles open the Opportunity Case)",
  /const open = \(i: number\) => \{ setSel\(i\); setTab\("cases"\); \}/.test(src));
t("Q7 Opportunity Cases tab reuses the frozen reasoning spine (CaseSpine)",
  /function CaseSpine/.test(src) && /<CaseSpine a=\{a\} \/>/.test(src) && /label="What changed"/.test(src) && /label="Decision"/.test(src));
t("Q8 Evidence tab is claim-first with Direct/Corroborating/Context relations", /claim → source → freshness/.test(src) && /REL_COLOR\[src\.rel\]/.test(src));
t("Q9 Compare tab compares Fit/Timing/Evidence + Key unknown + Validate", /Key unknown/.test(src) && /Why work one account before another/.test(src));
t("Q10 Portfolio Intelligence tab gives a sequence tied to the portfolio", /Recommended sequence/.test(src) && /Prioritize Northstar Logistics first/.test(src));
t("Q11 client subject is not one target account (Asteron ≠ Northstar as report title)",
  /\{WS_CLIENT\.name\}/.test(src) && !/name:\s*"Northstar[^"]*",\s*$/m.test(src.slice(src.indexOf("const WS_CLIENT"), src.indexOf("const WS_CLIENT") + 400)));
t("Q12 light composition — no giant dark navy header gradient on the sample surface",
  !/linear-gradient\(160deg,#0b1220/.test(sampleSrc));

// ─── R. Market repositioning (Step 1) — category ≠ "B2B sales" ────────────────
// LeadLens is Account Opportunity Intelligence. B2B is a launch WEDGE, not the
// category: the primary headline, category badge, announcement and footer must no
// longer define the product through B2B — while exactly one restrained wedge line
// keeps existing B2B sellers recognizing themselves.
t("R1 category badge is Account Opportunity Intelligence, not B2B-suffixed (4 locales)",
  /heroBadge:\s*"Account Opportunity Intelligence"/.test(src) && !/heroBadge:\s*"[^"]*·\s*B2B"/.test(src) && (src.match(/heroBadge:/g) || []).length === 4);
t("R2 primary headline no longer defines LeadLens through B2B (no B2B in any hero H1 field)",
  !/heroH1(pre|hi|post):\s*"[^"]*B2B/i.test(src) && !/heroH1pre:\s*"Find the B2B/.test(src));
t("R3 announcement + footer no longer say 'for B2B' / 'B2B向け' (category is not B2B)",
  !/announcement:\s*"[^"]*(for B2B|para B2B|B2B向け)/.test(src) && !/footerCopy:\s*"[^"]*(for B2B|para B2B|B2B向け)/.test(src));
t("R4 exactly one explicit launch wedge remains (heroWedge, 4 locales, names B2B once)",
  (src.match(/heroWedge:/g) || []).length === 4 && /heroWedge:\s*"[^"]*B2B/.test(src) && /className="ll-hero-wedge"/.test(src));
t("R5 core Account / Timing / Evidence positioning survives",
  /heroH2:\s*"And the evidence behind every opportunity\."/.test(src) && /heroSub:\s*"Turn market evidence into clearer account decisions\."/.test(src));
t("R6 no generic AI hype language (AI-powered / supercharge / revolutionize / unlock)",
  !/AI-powered/i.test(src) && !/supercharge/i.test(src) && !/revolutioni[sz]e/i.test(src) && !/\bunlock\b/i.test(src));
t("R7 wedge leads with the shared account-pursuit pattern + professional services, no B2C claim",
  /heroWedge:\s*"[^"]*high-value accounts[^"]*professional services/.test(src) &&
  !/heroWedge:\s*"[^"]*B2C/.test(src) && !/for B2B and B2C|for every business|for any company/i.test(src));

// ─── T. Hero product-story carousel — Understand → Prioritize → Explain ───────
// Three moments of ONE LeadLens system, precomputed from canonical fixtures.
// Guards protect MEANING (3 states in order, zero passive API call, canonical
// truth, accessibility, Stage A honesty), not exact markup.
t("T1 carousel has 3 story states in order (Understand → Prioritize → Explain), localized 4 locales",
  /const CAROUSEL_COPY/.test(src) &&
  /steps: \["Understand", "Prioritize", "Explain"\]/.test(src) &&
  /steps: \["Entender", "Priorizar", "Explicar"\]/.test(src) &&
  /steps: \["理解", "優先", "説明"\]/.test(src));
t("T2 carousel rendered in hero, derived from canonical LANDING_COMPARISON fixtures — no invented company/score",
  /<HeroCarousel lang=\{lang\} \/>/.test(src) &&
  (() => { const m = src.match(/function HeroCarousel[\s\S]*?\n\}/); return !!m && /LANDING_COMPARISON\.accounts/.test(m[0]) && !/\d\s*\/\s*100/.test(m[0]); })());
t("T3 carousel makes NO interpretation/API call (passive hero viewing = zero LLM calls)",
  (() => { const m = src.match(/function HeroCarousel[\s\S]*?\n\}/); return !!m && !/requestInterpretation|\/api\/interpret|fetch\(/.test(m[0]); })());
t("T4 carousel controls accessible (carousel role + arrow labels + dot tablist + reduced-motion)",
  /aria-roledescription="carousel"/.test(src) && /className="ll-hc-arrow" aria-label/.test(src) && /role="tab" aria-selected=\{i === slide\}/.test(src) && /prefers-reduced-motion: reduce/.test(src));
t("T5 Understand slide is Stage-A truthful (no research has run)",
  /s1foot:\s*"No external research has run yet\./.test(src));

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
