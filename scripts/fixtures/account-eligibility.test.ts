// Account eligibility gate (§4): offer-side producers/brands and wrong-geography
// entities are EXCLUDED before customer selection; real buyers/channels stay eligible.
// Conservative — ambiguity resolves to eligible (no legitimate account dropped).
import { assessAccountEligibility } from "../../lib/intelligence/account-eligibility";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

const US = { geographies: ["United States"] };
const ex = (o: Parameters<typeof assessAccountEligibility>[0]) => assessAccountEligibility(o, US).outcome;

// EXCLUDE — offer-side brands/producers that resell nothing (the §4 cases).
t("Alter Eco (food brand) → exclude", ex({ company: "Alter Eco", industry: "Natural and organic grocery chain", country: "United States", companySummary: "Alter Eco Foods is a US-based natural and organic food brand headquartered in Houston, TX." }) === "exclude");
t("Wild Oats (food brand) → exclude", ex({ company: "Wild Oats", industry: "Natural and organic grocery chain", country: "United States", companySummary: "Wild Oats is a Boulder-founded natural and organic food brand established in 1987." }) === "exclude");
t("Generic CPG manufacturer (no channel) → exclude", ex({ company: "X", industry: "beverage", country: "United States", companySummary: "X is a beverage brand that manufactures its own functional drinks." }) === "exclude");

// ELIGIBLE — real buyers / channels.
t("Whole Foods (grocery retailer) → eligible", ex({ company: "Whole Foods Market", industry: "natural grocery retail", country: "United States", companySummary: "Whole Foods is the leading natural and organic grocery retailer operating 500+ stores." }) === "eligible");
t("Iberia Foods (importer/distributor) → eligible", ex({ company: "Iberia Foods", industry: "Latin American premium food import", country: "United States", companySummary: "Iberia Foods is a US-based Latin American premium food importer and distributor." }) === "eligible");
t("BAVE mixed producer/distributor without third-party role → research_more", ex({ company: "BAVE", industry: "importer", country: "United States", companySummary: "BAVE manufactures, imports, and distributes food and beverage products." }) === "research_more");
t("Canyon Ranch (wellness resort operator/procurer) → eligible", ex({ company: "Canyon Ranch", industry: "wellness resorts and spas", country: "United States", companySummary: "Canyon Ranch is a luxury wellness resort and spa brand operating multiple flagship properties." }) === "eligible");

// WRONG GEOGRAPHY.
t("Australian meat processor → exclude (wrong geography)", ex({ company: "Thomas Foods International", industry: "food", country: "Australia", companySummary: "Thomas Foods International is an Australian meat processor." }) === "exclude");

// Ambiguity is retained for research but cannot consume a customer slot.
t("ambiguous commercial role → research_more", ex({ company: "Y", industry: "specialty food", country: "United States", companySummary: "Y operates in the specialty food sector." }) === "research_more");
t("missing research summary → research_more", ex({ company: "Z", industry: "specialty food", country: "United States", companySummary: null }) === "research_more");

// Offer-aware generalization (§ Intelligence Value Reset): a SERVICES / B2B-direct
// customer (targetRole "direct_buyer") treats an established in-geo company — including
// a manufacturer that produces its own product — as a plausible direct buyer, not a
// role-ambiguous or offer-side exclusion. The default "channel" behavior is unchanged.
const direct = (summary: string) => assessAccountEligibility({ company: "M", industry: "manufacturer", country: "United States", companySummary: summary }, { geographies: ["United States"], targetRole: "direct_buyer" }).outcome;
t("direct_buyer: plain manufacturer is eligible (was role-ambiguous under channel model)", direct("A US industrial processing technology manufacturer with global plants.") === "eligible");
t("direct_buyer: own-product producer is eligible (not offer-side-excluded)", direct("A premium beverage brand that manufactures its own products.") === "eligible");
t("channel default still excludes an own-product producer", ex({ company: "P", industry: "beverage", country: "United States", companySummary: "A premium beverage brand that manufactures its own products." }) === "exclude");
t("direct_buyer still excludes wrong geography", assessAccountEligibility({ company: "F", country: "Germany", companySummary: "A manufacturer." }, { geographies: ["United States"], targetRole: "direct_buyer" }).outcome === "exclude");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
