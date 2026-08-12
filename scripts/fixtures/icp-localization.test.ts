import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const landing = readFileSync(new URL("../../app/demo-pipeline/page.tsx", import.meta.url), "utf8");
const rules = readFileSync(new URL("../../docs/LOCALIZATION_RULES.md", import.meta.url), "utf8");

for (const expansion of [
  "ICP (Ideal Customer Profile)",
  "ICP (Perfil de Cliente Ideal)",
  "ICP（理想顧客プロファイル）",
]) assert.ok(landing.includes(expansion), `landing must include ${expansion}`);

assert.match(rules, /non-negotiable/i);
assert.match(rules, /Do not rename backend fields/i);
assert.ok(!landing.includes("ICP (Ideal Customer Profile) adentro"), "Spanish must not use the English expansion");
assert.ok(!landing.includes("ICP (Ideal Customer Profile) dentro"), "Portuguese must not use the English expansion");

console.log("ICP localization fixtures: ok");
