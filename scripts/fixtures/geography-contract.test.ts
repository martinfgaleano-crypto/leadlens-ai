import { assertGeographyContract, enforceCandidateGeography } from "@/lib/quality/geography-contract";
import { buildDeterministicICP } from "@/lib/agents/icp-agent";
import type { LeadCandidate, OnboardingData } from "@/types";

let passed = 0;
function test(name: string, fn: () => boolean) {
  if (!fn()) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`PASS: ${name}`);
}
function throws(fn: () => void, code: string) { try { fn(); return false; } catch (e) { return e instanceof Error && e.message.includes(code); } }

const onboarding: OnboardingData = {
  company_name: "Amor de Gea", company_description: "Bebidas herbales de bienestar para rutinas diarias.",
  offer_description: "Bebidas de extractos herbales para sueño, energía y digestión.", value_proposition: "Oferta natural diferenciada para canales de bienestar.",
  target_customer_description: "Retailers, hoteles, spas y empresas de bienestar que operan en Colombia.", tone: "consultative", contact_email: "pilot@example.test",
  output_language: "es", target_market_region: "latin_america", target_countries: ["Colombia"],
};
const { criteria } = buildDeterministicICP(onboarding, "sample");
test("exact country overrides broad LATAM region", () => criteria.target_geography.length === 1 && criteria.target_geography[0] === "Colombia");
test("matching geography contract passes", () => { assertGeographyContract(onboarding, criteria); return true; });
test("US substitution fails closed", () => throws(() => assertGeographyContract(onboarding, { ...criteria, target_geography: ["United States"] }), "GEOGRAPHY_CONTRACT_MISMATCH"));
test("country-region contradiction fails closed", () => throws(() => assertGeographyContract({ ...onboarding, target_market_region: "north_america" }, criteria), "GEOGRAPHY_REGION_MISMATCH"));
const candidates = [
  { id: "co", company: "GHL Hoteles", source: "public_signal", confidence_score: 1, country: "Colombia", location: "Bogotá, Colombia" },
  { id: "us", company: "Sprouts Farmers Market", source: "public_signal", confidence_score: 1, country: "United States", location: "Florida, United States" },
] as LeadCandidate[];
test("candidate gate removes wrong-country accounts", () => enforceCandidateGeography(candidates, ["Colombia"]).map(c => c.id).join() === "co");
console.log(`\n${passed}/5 geography contract assertions passed.`);
