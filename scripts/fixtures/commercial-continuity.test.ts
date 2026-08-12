// Commercial Continuity Contract — deterministic guards (0 provider calls).
// Locks the invariants the continuity sprint establishes:
//   1. Canonical plan catalog is the single source of truth for entitlement.
//   2. Capability flags stay HONEST — not-yet-automated capabilities are never
//      silently "active" (Premium strategy/playbooks/reinforced evidence).
//   3. Customer-facing metadata no longer sells the legacy "lead-gen + outreach"
//      category; it reflects Account Opportunity Intelligence.
// Run: npm run test:commercial-continuity
import { readFileSync } from "node:fs";
import { PRODUCTS, CAPABILITY_FLAGS, resolveProduct, resolveEntitlementsForJob } from "@/lib/products/catalog";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// ─── 1. Canonical entitlement source of truth ────────────────────────────────
t("1 exactly four canonical products", Object.keys(PRODUCTS).length === 4);
t("2 canonical tiers preview/brief/intelligence/premium", Object.values(PRODUCTS).map((p) => p.tier).join() === "preview,brief,intelligence,premium");
t("3 entitlement derives from stored product_code over client plan", resolveEntitlementsForJob({ plan: "pro", onboarding: { product_code: "preview_launch_v0" } })?.tier === "preview");
t("4 unknown client plan string fails closed (no default entitlement)", resolveProduct("free") === null && resolveProduct("") === null && resolveProduct(undefined) === null);
t("5 legacy plan names still resolve (no silent plan drift)", ["sample","starter","standard","pro"].map((p) => resolveProduct(p)?.tier).join() === "preview,brief,intelligence,premium");

// ─── 2. Capability-flag honesty (never imply un-automated guarantees) ─────────
const off = (id: string) => CAPABILITY_FLAGS[id]?.default === "flagged_off";
t("6 premium strategy NOT automated (flagged_off, never simulated)", off("premium_strategy_v0"));
t("7 opportunity playbooks flagged_off (depend on premium strategy)", off("opportunity_playbooks_v0"));
t("8 reinforced evidence flagged_off (extra corroboration not automated)", off("reinforced_evidence_v0"));
t("9 tier upgrade credit flagged_off (needs payment provider)", off("tier_upgrade_credit_v0"));
t("10 portfolio intelligence honestly partial (not overstated as active)", CAPABILITY_FLAGS.portfolio_intelligence_v0.default === "partial");
t("11 Premium advertises playbooks in entitlements while the flag stays off — honesty gap is flagged, not hidden",
  PRODUCTS.premium_launch_v0.entitlements.playbooks === true && off("opportunity_playbooks_v0"));

// ─── 3. Metadata terminology continuity (no legacy lead-gen category) ─────────
const layout = readFileSync("app/layout.tsx", "utf8");
const og = readFileSync("app/api/og/route.tsx", "utf8");
t("12 root metadata no longer brands 'LeadLens AI'", !/LeadLens AI/.test(layout));
t("13 root metadata no longer says 'Opportunity Snapshots'", !/Opportunity Snapshots/.test(layout));
t("14 root metadata states the canonical category", /Account Opportunity Intelligence/.test(layout));
t("15 OG image no longer sells 'Qualified B2B leads'", !/Qualified B2B leads/.test(og));
t("16 OG image no longer sells 'outreach drafts'/'write the outreach'", !/outreach drafts|write the outreach/.test(og));
t("17 OG image reflects account-level intelligence positioning", /Account Opportunity Intelligence|accounts worth working now|account-level intelligence/i.test(og));

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
