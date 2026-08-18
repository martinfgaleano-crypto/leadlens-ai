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

// ─── E. Professional How-it-works heading ─────────────────────────────────────
t("E1 awkward '(Ideal Customer Profile) in' heading removed", !/ICP \(Ideal Customer Profile\) in/.test(src));
t("E2 how-it-works heading localized in 4 locales", count(/howTitle:\s*\{/g) === 4);

// ─── H. How-it-works V7.3 transformation ──────────────────────────────────────
// Headline reframed to commercial-context (not "you must arrive with an ICP").
t("H1 headline is commercial-context → accounts, not ICP-first",
  /howTitle:\s*\{\s*pre:\s*"From commercial context/.test(src) && !/From your ideal customer profile/.test(src));
t("H2 headline emphasis on 'accounts worth working' (blue), rendered via copy",
  /emph:\s*"accounts worth working"/.test(src) && /copy\.howTitle\.emph/.test(src));
t("H3 Step 1 makes ICP optional (existing ICP used; criteria structured otherwise)",
  /Have an ICP\? We'll use it\. If not, we'll help structure the criteria\./.test(src));
t("H4 localized step copy in 4 locales", count(/step1Copy:/g) === 4 && count(/step2Copy:/g) === 4 && count(/step3Copy:/g) === 4);
t("H5 mini product visuals reuse real primitives (DecisionPill + ladder + evidence)",
  /function HowStep1Viz/.test(src) && /function HowStep2Viz/.test(src) && /function HowStep3Viz/.test(src) &&
  /<DecisionPill state="prioritize" \/>/.test(src));
t("H6 connected layout: desktop connectors + mobile vertical spine",
  /ll-how-desktop/.test(src) && /ll-how-mobile/.test(src) && /ll-how-conn/.test(src));
t("H7 old generic card+arrow flow replaced", !/className="ll-how-flow"/.test(src) && !/className="ll-how-arrow"/.test(src));
t("H8 how mini-visual labels localized in 4 locales", count(/vCriteria:/g) === 4 && count(/vLadder:/g) === 4);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
