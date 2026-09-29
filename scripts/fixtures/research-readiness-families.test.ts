// Research-readiness FAMILY taxonomy covers consumer-goods channels (food/beverage
// specialty retail, importers/distributors, wellness hospitality/spa, gifting) so a
// CPG/F&B customer's in-scope BUYER accounts reach Research — while out-of-family
// types (logistics, software) are still correctly rejected (no truth relaxation).
import { assessResearchReadiness } from "../../lib/lead-hunter/research-readiness";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

// Amor de Gea-style target (a premium F&B producer seeking US channel accounts).
const plan: any = {
  organizationTypes: [
    "Premium natural and specialty food and beverage retailers",
    "Specialty importers of premium natural and wellness brands",
    "Wellness hotels and hotel spa F&B buyers",
    "Premium corporate and consumer gifting companies",
  ],
  industries: ["Specialty food and beverage retail", "Natural and organic retail", "Spa and wellness services", "Premium gifting and curated boxes"],
};

const cand = (canonicalName: string, organizationType: string, domain = "example.com"): any => ({
  status: "identified",
  identity: { canonicalName, domain, confidence: "verified", organizationType },
  provenance: [{ origin: "dynamic_enumeration" }],
});

const ready = (org: string) => assessResearchReadiness(cand("Acme", org), plan).status;

t("specialty food retailer → research_ready", ready("specialty food retailer") === "research_ready");
t("natural foods grocer → research_ready", ready("natural foods grocer") === "research_ready");
t("gourmet food importer → research_ready", ready("gourmet food importer / distributor") === "research_ready");
t("wellness spa → research_ready", ready("day spa and wellness center") === "research_ready");
t("boutique hotel → research_ready", ready("boutique hotel") === "research_ready");
t("corporate gifting company → research_ready", ready("corporate gifting company") === "research_ready");
// Out-of-family types are still rejected — the gate is not weakened.
t("3PL logistics provider → NOT research_ready", ready("third-party logistics 3PL provider") !== "research_ready");
t("software company → NOT research_ready", ready("enterprise software company") !== "research_ready");
// Substring guards: 'important' must not read as an importer; 'delivery' not as a deli.
t("'important partner' does not match importer", assessResearchReadiness(cand("X", "important regional partner"), plan).status !== "research_ready");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
