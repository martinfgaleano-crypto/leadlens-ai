import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeConversionPayload } from "../../lib/analytics/conversion-events";
import { PRODUCTS } from "../../lib/products/catalog";

const source = readFileSync(new URL("../../app/demo-pipeline/page.tsx", import.meta.url), "utf8");

assert.deepEqual(safeConversionPayload("pricing_plan_select", { plan: "pro", source_cta: "pricing" }), {
  event: "pricing_plan_select", plan: "pro", source_cta: "pricing",
});
assert.throws(() => safeConversionPayload("onboarding_submit", { company_name: "secret" } as never));
assert.throws(() => safeConversionPayload("onboarding_error", { error_category: "secret text" } as never));
assert.match(source, /setPlan\(p\)[\s\S]{0,120}setView\("form"\)/, "CTA must preselect plan before onboarding");
assert.match(source, /id="how-it-works"/, "How-it-works destination must exist");
assert.match(source, /getElementById\("how-it-works"\)/, "Hero secondary CTA must target its named section");
assert.match(source, /required label=\{copy\.fCompanyName\}/);
assert.match(source, /required label=\{copy\.fEmail\}/);
assert.equal(PRODUCTS.preview_launch_v0.price_amount, 7);
assert.equal(PRODUCTS.brief_launch_v0.price_amount, 25);
assert.equal(PRODUCTS.intelligence_launch_v0.price_amount, 59);
assert.equal(PRODUCTS.premium_launch_v0.price_amount, 129);

console.log("conversion plumbing fixtures: ok");
