// Pilot 2 research integrity (§66) + data honesty. Deterministic; guards that the Pilot 2 record and the
// real feedback module carry no fabrication and stay truthful (partial supply not padded, real provenance).
import { readFileSync } from "node:fs";
import { AMOR_PILOT2 } from "../../lib/intelligence/amor-de-gea-pilot2";
import { AMOR_PILOT1_FEEDBACK } from "../../lib/intelligence/amor-de-gea-pilot1-feedback";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// ── Real feedback provenance (not the blank form) ──
t("feedback provenance names the real respondent", /Juliana Maya Zuluaga/.test(AMOR_PILOT1_FEEDBACK.provenance.respondent));
t("feedback provenance flags the /public form as the blank instrument (not the source)", /BLANK/i.test(AMOR_PILOT1_FEEDBACK.provenance.note));
t("feedback ratings are the transcribed values (prioritization 5, evidence 4)", AMOR_PILOT1_FEEDBACK.ratings.prioritization === 5 && AMOR_PILOT1_FEEDBACK.ratings.evidence_credibility === 4);
t("account operational priority is the real order", JSON.stringify(AMOR_PILOT1_FEEDBACK.accounts.operational_priority_order) === JSON.stringify(["Éteka", "Vitálica", "Celestino Hotel Boutique & Spa", "Sinergy On"]));

// ── Supply honesty: partial not padded (§49) ──
t("supply state recorded as partial (discovery fixed; not padded, not blocked)", AMOR_PILOT2.research.supply_state === "partial");
t("delivered accounts ≤ candidate universe (multi-pass foundation, honest)", (AMOR_PILOT2.research.delivered_accounts ?? 0) >= 2 && (AMOR_PILOT2.research.delivered_accounts ?? 0) <= (AMOR_PILOT2.research.candidate_universe ?? 0));
t("every tier PARTIAL iff delivered < target (Preview/Brief full, Portfolio/Premium partial)", AMOR_PILOT2.tiers.every((x) => x.partial === ((x.delivered ?? 0) < x.target)));
t("no tier claims more delivered than the real foundation (≤ delivered_accounts)", AMOR_PILOT2.tiers.every((x) => (x.delivered ?? 0) <= (AMOR_PILOT2.research.delivered_accounts ?? 0)));
t("provider spend recorded and within the $20 ceiling", (AMOR_PILOT2.research.provider_spend_usd ?? 99) <= 20);

// ── Repeat-suppression carries the 15 Pilot 1 accounts (§ no repeat) ──
t("repeat-suppression on + 15 Pilot 1 accounts listed", AMOR_PILOT2.repeat_suppression === true && AMOR_PILOT2.suppressed_accounts.length === 15);

// ── Approval discipline: PILOT/FOUNDER_REVIEW, never production-approved ──
t("Pilot 2 approval state is FOUNDER_REVIEW (never production-approved)", /FOUNDER_REVIEW/.test(AMOR_PILOT2.approval_state) && !/APPROVED\b(?!.*REVIEW)/.test(AMOR_PILOT2.approval_state.replace("FOUNDER_REVIEW", "")));

// ── The Admin workspace surfaces the real account (no synthetic company), with the honest HOLD ──
const ws = read("app/admin/intelligence/pilot2/Pilot2Workspace.tsx");
t("Admin surfaces the real US account (Whole Foods, the current run's delivered account)", /Whole Foods/.test(ws));
t("Admin carries no synthetic/demo company placeholders", !/example\.com|Acme|SYNTHETIC/.test(ws));
t("Admin export-dependency panel disclaims legal advice", /not a legal opinion|not legal advice/i.test(ws));

// ── Intake never instructs the external AI to fabricate ──
const intake = read("app/context-intake/ContextIntake.tsx");
t("AI intake prompt forbids inventing figures/companies", /do not invent|never invent|never guess/i.test(intake));
t("intake respects the 600-char interpret cap (concise summary)", /600/.test(intake));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
