// Unit tests: versioned catalog, server-side resolution, entitlements, legacy
// compatibility, report experience. Run: npm run test:product-catalog

import { PRODUCTS, resolveProduct, resolveEntitlementsForJob } from "@/lib/products/catalog";
import { resolveReportExperience, deriveMiniVerdict } from "@/lib/products/report-experience";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// Prices ($7/$25/$59/$129, one-time, launch)
t("preview $7", PRODUCTS.preview_launch_v0.price_amount === 7);
t("brief $25", PRODUCTS.brief_launch_v0.price_amount === 25);
t("intelligence $59", PRODUCTS.intelligence_launch_v0.price_amount === 59);
t("premium $129", PRODUCTS.premium_launch_v0.price_amount === 129);
t("all one-time launch prices", Object.values(PRODUCTS).every((p) => p.billing_type === "one_time" && p.launch_price === true));

// Operating limits (not the promise)
t("opportunity targets 2/6/12/18", [2, 6, 12, 18].join() === Object.values(PRODUCTS).map((p) => p.entitlements.opportunity_target).join());

// Server-side resolution: new codes, legacy plans, unknown fails closed
t("resolves new code", resolveProduct("intelligence_launch_v0")?.tier === "intelligence");
t("legacy sample → preview", resolveProduct("sample")?.product_code === "preview_launch_v0");
t("legacy starter → brief", resolveProduct("starter")?.product_code === "brief_launch_v0");
t("legacy standard → intelligence", resolveProduct("standard")?.product_code === "intelligence_launch_v0");
t("legacy pro → premium", resolveProduct("pro")?.product_code === "premium_launch_v0");
t("unknown code fails closed", resolveProduct("hacked_free_tier") === null);
t("price tampering impossible via resolution", resolveProduct("premium_launch_v0")!.price_amount === 129);

// Job resolution order: stored product_code wins over legacy plan
t("job with product_code uses it", resolveEntitlementsForJob({ plan: "pro", onboarding: { product_code: "preview_launch_v0" } })?.tier === "preview");
t("legacy job falls back to plan", resolveEntitlementsForJob({ plan: "standard", onboarding: {} })?.tier === "intelligence");

// Entitlement architecture invariants
t("preview has no portfolio", PRODUCTS.preview_launch_v0.entitlements.portfolio_statuses === "none");
t("preview has mini verdict", PRODUCTS.preview_launch_v0.entitlements.mini_verdict === true);
t("only premium has playbooks", Object.values(PRODUCTS).filter((p) => p.entitlements.playbooks).map((p) => p.tier).join() === "premium");
t("premium is capped (no unlimited)", PRODUCTS.premium_launch_v0.entitlements.icps.max === 2 && PRODUCTS.premium_launch_v0.entitlements.regions.max === 3);
t("evidence floor equal everywhere (what_changed/sources/why_now)", Object.values(PRODUCTS).every((p) => p.entitlements.what_changed && p.entitlements.sources_and_freshness && p.entitlements.why_now));

// Report experience
t("preview report: mini + verdict, no portfolio", (() => { const x = resolveReportExperience("preview_launch_v0"); return x.show_mini_verdict && !x.show_portfolio; })());
t("brief report shows portfolio", resolveReportExperience("brief_launch_v0").show_portfolio);
t("premium header strategic", resolveReportExperience("premium_launch_v0").header_label === "Strategic Executive Brief");
t("premium has no upgrade hint", resolveReportExperience("premium_launch_v0").upgrade_hint === null);

// Mini verdict is derived from real results, deterministically
t("verdict proceed on warm", deriveMiniVerdict({ hot: 0, warm: 1, cold: 1, discard: 0, total: 2 }).verdict === "proceed");
t("verdict refine on cold-only", deriveMiniVerdict({ hot: 0, warm: 0, cold: 2, discard: 0, total: 2 }).verdict === "refine");
t("verdict stop on discard-only", deriveMiniVerdict({ hot: 0, warm: 0, cold: 0, discard: 2, total: 2 }).verdict === "stop");

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
