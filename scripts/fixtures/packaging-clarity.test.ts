// Customer-facing packaging clarity — locks the one-time $59 rename (Intelligence → Portfolio) and
// its differentiating bullets, WITHOUT changing economics, internal identifiers, or billing authority.
// Doctrine: same Intelligence truth quality across tiers; higher tiers differ by breadth/depth/export.

import { oneTimeCards, oneTimeCardFor, subscriptionCardFor } from "../../lib/commercial/plan-catalog";
import { PRODUCTS, resolveProduct } from "../../lib/products/catalog";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

// ── Rename: the $59/12 one-time tier is customer-facing "Portfolio", never "Intelligence". ──
const portfolio = oneTimeCardFor("intelligence_launch_v0")!;
t("one-time $59 tier renamed to Portfolio", portfolio.name === "Portfolio");
t("Portfolio is $59", portfolio.price === 59);
t("Portfolio capacity = 12 companies evaluated (plain language)", portfolio.capacity === "12 companies evaluated");
t("NO customer-facing one-time card is named 'Intelligence' / 'Intelligence — One-time'",
  oneTimeCards().every((c) => !/intelligence/i.test(c.name)));

// ── Frozen economics unchanged (price + account count per tier). ──
const byName = Object.fromEntries(oneTimeCards().map((c) => [c.productCode, c]));
t("Preview $7 / 2", byName["preview_launch_v0"].name === "Preview" && byName["preview_launch_v0"].price === 7 && byName["preview_launch_v0"].capacity === "2 companies evaluated");
t("Brief $25 / 6", byName["brief_launch_v0"].name === "Brief" && byName["brief_launch_v0"].price === 25 && byName["brief_launch_v0"].capacity === "6 companies evaluated");
t("Portfolio $59 / 12", byName["intelligence_launch_v0"].price === 59 && byName["intelligence_launch_v0"].capacity === "12 companies evaluated");
t("Premium $129 / 18", byName["premium_launch_v0"].name === "Premium" && byName["premium_launch_v0"].price === 129 && byName["premium_launch_v0"].capacity === "18 companies evaluated");

// ── Subscription "Intelligence" tier is UNTOUCHED (the word is correct there). ──
t("ongoing Intelligence subscription still named 'Intelligence'", subscriptionCardFor("intelligence")!.name === "Intelligence");

// ── Internal identifiers + billing mapping preserved (Part H). ──
t("internal id intelligence_launch_v0 unchanged", PRODUCTS["intelligence_launch_v0"].product_code === "intelligence_launch_v0");
t("STANDARD legacy slug still maps to the 12-account one-time product", PRODUCTS["intelligence_launch_v0"].legacy_plan === "standard" && PRODUCTS["intelligence_launch_v0"].entitlements.opportunity_target === 12);
t("resolveProduct('standard') → intelligence_launch_v0 (variant STANDARD authority intact)", resolveProduct("standard")?.product_code === "intelligence_launch_v0");
for (const [slug, code, n] of [["sample", "preview_launch_v0", 2], ["starter", "brief_launch_v0", 6], ["standard", "intelligence_launch_v0", 12], ["pro", "premium_launch_v0", 18]] as const) {
  t(`${slug} → ${code} → ${n} accounts`, resolveProduct(slug)?.product_code === code && resolveProduct(slug)?.entitlements.opportunity_target === n);
}

// ── Bullets: 3–4 per plan, non-empty, comparable; CSV only where truthful (Portfolio+Premium). ──
for (const c of oneTimeCards()) {
  t(`${c.name}: 4–5 bullets`, c.bullets.length >= 4 && c.bullets.length <= 5);
  t(`${c.name}: bullets non-empty`, c.bullets.every((b) => b.trim().length > 0));
}
const csvMentions = (code: string) => oneTimeCardFor(code)!.bullets.some((b) => /csv/i.test(b));
t("Portfolio bullets mention CSV export (intelligence tier offers CSV)", csvMentions("intelligence_launch_v0"));
t("Premium bullets mention CSV export", csvMentions("premium_launch_v0"));
t("Preview bullets do NOT claim CSV (not offered)", !csvMentions("preview_launch_v0"));
t("Brief bullets do NOT claim CSV (not offered)", !csvMentions("brief_launch_v0"));
// First bullet leads with the real account count for every tier.
t("account counts lead each plan bullets (2/6/12/18)", oneTimeCardFor("preview_launch_v0")!.bullets[0].startsWith("2 ") && oneTimeCardFor("brief_launch_v0")!.bullets[0].startsWith("6 ") && oneTimeCardFor("intelligence_launch_v0")!.bullets[0].startsWith("12 ") && oneTimeCardFor("premium_launch_v0")!.bullets[0].startsWith("18 "));
// §14: no CRM-tooling positioning on exports. §10: one-time copy must not misuse canonical "What Changed"
// (no prior LeadLens state on a first one-time run) — "recent developments" is the correct framing.
const allBulletText = oneTimeCards().flatMap((c) => [c.headline, c.body, ...c.bullets]).join("  ").toLowerCase();
t("no 'for your CRM' export positioning", !allBulletText.includes("for your crm"));
t("no canonical 'What Changed' claim in one-time copy (use recent developments)", !/what changed/i.test(allBulletText));

// ── Claim safety (§19/§20): no prohibited or over-reaching customer-facing claims. ──
const allText = oneTimeCards().flatMap((c) => [c.name, c.headline, c.body, ...c.bullets]).join("  ").toLowerCase();
for (const banned of ["most corroborated", "defensible commercial strategy", "defensible strategy", "hot", "warm", "cold", "buyer intent", "ready to buy", "sales-ready", "lead score", "outreach"]) {
  t(`no prohibited claim: "${banned}"`, !allText.includes(banned));
}
// Plain-language-first: every one-time plan speaks in "companies", not ontology-only.
t("all one-time plans use plain 'companies' language", oneTimeCards().every((c) => /compan(y|ies)/i.test([c.headline, c.body, ...c.bullets].join(" "))));
// Truth-quality parity: no tier claims better/deeper *truth or evidence quality* than another.
t("no tier claims superior truth/evidence quality", !/(better|superior|higher.?quality|more accurate)\s+(evidence|truth|intelligence)/i.test(allText));

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
