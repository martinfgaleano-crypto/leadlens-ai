// Customer-safe content contract for the premium Pilot 1 deliverables.
// Verifies the single-source-of-truth (intelligence modules + exported JSON) and
// that the delivery module matches the real rendered files. Complements
// amor-pilot1-delivery-integrity (byte/download) and amor-pilot1-finalization.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { AMOR_PILOT1_FINAL } from "../../lib/intelligence/amor-de-gea-pilot1-finalization";
import { AMOR_PHASE4_PORTFOLIO } from "../../lib/intelligence/amor-de-gea-phase4-intelligence";
import { AMOR_PILOT1_DELIVERABLES } from "../../lib/intelligence/amor-de-gea-pilot1-delivery";

const ACTIVE = ["Éteka", "Celestino Hotel Boutique & Spa", "Sinergy On", "Vitálica", "Ser Saludable", "Masaya Collection", "Natural + Mente", "Hotel Charleston Santa Teresa Spa", "Habibi Plantitas", "Funat"];
const INACTIVE = ["BioPlaza", "Distribuidora DAM", "Hotel Spa La Colina", "Tu Tienda Saludable", "Somos Consiente"];

// 1. Portfolio shape preserved.
assert.deepEqual(AMOR_PILOT1_FINAL.portfolio.first_validation, ["Éteka", "Celestino Hotel Boutique & Spa", "Sinergy On", "Vitálica"]);
assert.equal(AMOR_PILOT1_FINAL.portfolio.strategic_priority.length, 3);
assert.equal(AMOR_PILOT1_FINAL.portfolio.investigate_selectively.length, 3);
assert.deepEqual(AMOR_PILOT1_FINAL.accounts.map((a) => a.name), ACTIVE);
for (const n of INACTIVE) assert(!AMOR_PILOT1_FINAL.accounts.some((a) => a.name === n));

// 2. Every active account has real, current-or-prior evidence + honest no-timing state.
for (const name of ACTIVE) {
  const p = AMOR_PHASE4_PORTFOLIO.find((x) => x.identity.commercial_name === name);
  assert(p, `phase4 evidence exists for ${name}`);
  assert(p!.identity.official_domain.includes("."), `${name} has an official domain`);
  assert(p!.evidence.facts[0].claim.length > 20, `${name} has a public fact`);
  assert.equal(p!.timing.state, "no timing evidence", `${name} carries no timing claim`);
}

// 3. Exported deliverable JSON is customer-safe (no internal tokens) and evidence-backed.
const jsonPath = "output/amor-pilot1-deliverable.data.json";
assert(existsSync(jsonPath), "deliverable JSON is generated");
const raw = readFileSync(jsonPath, "utf8");
const data = JSON.parse(raw);
const DENY = ["V3R3", "V3R2", "V4D", "Blueprint", "compiler", "Founder Review", "revisión del fundador", "revisión interna", "No enviado", "admin_entry", "Phase 5", "conflict check", "NEEDS EVIDENCE", "actionability", "named_person"];
for (const tok of DENY) assert(!new RegExp(tok, "i").test(raw), `internal token '${tok}' must not appear in deliverable data`);
assert.equal(data.accounts.length, 10);
assert.equal(data.briefs.length, 4);
assert.deepEqual(data.excluded.map((e: { name: string }) => e.name), INACTIVE);
for (const e of data.excluded) assert(typeof e.reason === "string" && e.reason.length > 20, "each inactive account has a why-not-now reason");
// First-validation accounts carry a full evidence card (source + fact + proves + not-proves + no timing).
for (const b of data.briefs) {
  assert(b.evidence.source && b.evidence.source.includes("."), `${b.name} brief cites an official source`);
  assert(b.evidence.fact.length > 20 && b.evidence.proves && b.evidence.not_proves, `${b.name} brief has a complete evidence card`);
  assert(/timing/i.test(b.evidence.not_proves), `${b.name} evidence states no timing`);
  assert(Array.isArray(b.questions) && b.questions.length >= 3, `${b.name} brief has account-specific questions`);
}
// Account-specific (not identical) brief theses.
assert.equal(new Set(data.briefs.map((b: { thesis: string }) => b.thesis)).size, 4, "the four briefs have distinct theses");

// 4. Delivery module matches the real rendered files (size + sha256 + pages).
for (const [id, art] of Object.entries(AMOR_PILOT1_DELIVERABLES)) {
  const path = `public/pilot-deliverables/${art.filename}`;
  assert(existsSync(path), `${id} file exists`);
  const bytes = readFileSync(path);
  assert.equal(statSync(path).size, art.size, `${id} size matches delivery manifest`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), art.sha256, `${id} sha256 matches delivery manifest`);
}
assert.equal(AMOR_PILOT1_DELIVERABLES["pilot1-final-report"].pages, 18, "final report compressed to 18 pages");
assert.equal(AMOR_PILOT1_DELIVERABLES["pilot1-action-briefs"].pages, 5, "briefs compressed to 5 pages");
assert.equal(AMOR_PILOT1_DELIVERABLES["pilot1-feedback-pdf"].pages, 9, "feedback compressed to 9 pages");
for (const art of Object.values(AMOR_PILOT1_DELIVERABLES)) assert.equal(art.version, "1.2", "customer-deliverable version is 1.2");

// 5. Feedback evaluation guides (§12–§21) present in the deliverable data.
const g = data.feedback_guide;
assert.equal(g.how_to_evaluate.dimensions.length, 5, "how-to-evaluate has five dimensions");
assert.equal(g.scale_guide.levels.length, 5, "1–5 scale guide present");
assert(g.account_guide.questions.length >= 5 && g.account_guide.relationship.length === 6, "account evaluation guide present");
assert(g.brief_guide.length >= 5, "brief evaluation guide present");
assert(g.pilot2_guide.length >= 6, "Pilot 2 guide present");
assert.equal(g.key_questions.length, 2, "novelty + decision-change questions present");
assert(/genuinamente nueva/i.test(g.key_questions[0]) && /cambió/i.test(g.key_questions[1]), "novelty and decision-change wording");
assert(g.commercial.formats.length >= 5, "commercial willingness formats present");
assert(/segundo ciclo/i.test(data.closing_pilot2), "customer-safe Pilot 2 closing line present");
// Spanish terminology normalized (no raw English jargon in customer data).
for (const eng of ["sell-through", "co-branding", "onboarding", "gifting", "MOQ"]) assert(!new RegExp(eng, "i").test(raw), `English term '${eng}' normalized to Spanish`);

console.log("amor pilot1 deliverable content: ok");
