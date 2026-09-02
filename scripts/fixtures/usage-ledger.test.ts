// Billing V1 — usage-period boundary math (per-account, monthly-anchored allowance).
// Pure + deterministic. The DB seams (seed/consume) are code-ready behind migration 062 and
// proven at the resolver level in the entitlements suite (ledger row → metered remaining).

import { monthlyPeriodBoundaries, currentUsagePeriod } from "../../lib/billing/usage-ledger";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };
const iso = (s: string) => new Date(s).toISOString();

// Anchor on the 14th; now after the 14th → current month window.
const a = "2026-01-14T10:00:00.000Z";
let p = monthlyPeriodBoundaries(a, Date.parse("2026-09-20T00:00:00Z"));
t("after anchor day → [this-14th, next-14th]", p.period_start === iso("2026-09-14T10:00:00Z") && p.period_end === iso("2026-10-14T10:00:00Z"));

// now before the 14th → previous month window.
p = monthlyPeriodBoundaries(a, Date.parse("2026-09-05T00:00:00Z"));
t("before anchor day → [prev-14th, this-14th]", p.period_start === iso("2026-08-14T10:00:00Z") && p.period_end === iso("2026-09-14T10:00:00Z"));

// Year boundary: Jan before the 14th → Dec previous year.
p = monthlyPeriodBoundaries(a, Date.parse("2026-01-05T00:00:00Z"));
t("year boundary rolls back correctly", p.period_start === iso("2025-12-14T10:00:00Z") && p.period_end === iso("2026-01-14T10:00:00Z"));

// Month-end clamp: 31st anchor in February.
const a31 = "2026-01-31T00:00:00.000Z";
p = monthlyPeriodBoundaries(a31, Date.parse("2026-02-15T00:00:00Z"));
t("31st anchor clamps to Feb 28", p.period_start === iso("2026-01-31T00:00:00Z") && p.period_end === iso("2026-02-28T00:00:00Z"));

// Containment invariant across a year of samples.
let contained = true;
for (let m = 0; m < 12; m++) {
  const now = Date.UTC(2026, m, 20);
  const w = monthlyPeriodBoundaries(a, now);
  if (!(Date.parse(w.period_start) <= now && now < Date.parse(w.period_end))) contained = false;
}
t("period always contains now (12-month sweep)", contained);

// currentUsagePeriod carries the allowance.
const cu = currentUsagePeriod(a, 30, Date.parse("2026-09-20T00:00:00Z"));
t("currentUsagePeriod attaches allowance", cu.allowance === 30 && cu.period_start === iso("2026-09-14T10:00:00Z"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
