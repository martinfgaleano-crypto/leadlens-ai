// Landing Evidence experience (Sprint 3) — canonical-projection + honesty guards.
import { readFileSync } from "node:fs";
import { NORTHSTAR_EVIDENCE, type LandingEvidenceFixture } from "../../lib/landing/fixtures/northstar-evidence";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const src = readFileSync("app/demo-pipeline/page.tsx", "utf8");
const f: LandingEvidenceFixture = NORTHSTAR_EVIDENCE;

// §5 canonical evidence relationships preserved (direct/corroborating/context), ordered
t("§5 relations are canonical EvidenceRelation values", f.items.every((i) => ["direct", "corroborating", "context"].includes(i.relation)));
t("§5 ladder ordered direct → corroborating → context", f.items.map((i) => i.relation).join(",") === "direct,corroborating,context");
t("§8 not a flat source list — each item carries a relation + observation (reasoning, not Source 1..N)", f.items.every((i) => !!i.observation && !!i.sourceType));

// §6 no fabrication / no invented confidence math
t("§6 summary uses canonical strength (Strong/Moderate/Limited)", ["Strong", "Moderate", "Limited"].includes(f.summary.strength));
t("§6 EvidenceSummary is counts + corroborated flag, NOT a numeric score", typeof f.summary.corroborated === "boolean" && typeof f.summary.datedCount === "number" && !("score" in (f.summary as object)) && !("confidence" in (f.summary as object)));
t("§6 corroboration is not mechanically derived from source count in the fixture", f.summary.corroborated === true && f.summary.sourceCount === 3 /* asserted, not computed */);
t("§18 fixture is explicitly illustrative (no live research implied)", f.provenance === "illustrative_fixture" && f.illustrative === true);

// §7 counterevidence / limitation retained as a first-class field
t("§7 weakness (what weakens the case) retained", typeof f.weakness === "string" && f.weakness.length > 10);
t("§7 decision-critical validation retained", typeof f.validate === "string" && f.validate.length > 10);

// §1 no parallel ontology / no score / no re-ranking / no provider / no memory in the evidence path
t("§1 EvidenceReasoning component present", /function EvidenceReasoning\(/.test(src));
t("§1 renders canonical relation labels via evDirect/evCorroborating/evContext", /ui\.evDirect/.test(src) && /ui\.evCorroborating/.test(src) && /ui\.evContext/.test(src));
t("§7 renders 'what weakens the case' + validate", /ui\.evWeakens/.test(src) && /ui\.evValidate/.test(src));
t("§6/§8 renders an Evidence read that states 'no blended score'", /ui\.evRead\b/.test(src) && /evReadNote/.test(src));
t("§1 no aggregate score anywhere (no NN/100)", !/\d\s*\/\s*100/.test(src));
t("§1 landing does not import Account Memory", !/account-memory/.test(src));
t("§16 landing evidence path adds no provider/LLM import", !/providers|anthropic|tavily|exa/.test(src.split("EvidenceReasoning")[1] ?? ""));

// §17 localization: evidence labels exist in all 4 locales
for (const key of ["evEyebrow", "evTitle", "evWeakens", "evRead"]) {
  t(`§17 ${key} localized in 4 locales`, (src.match(new RegExp(`${key}: "`, "g")) || []).length === 4);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
