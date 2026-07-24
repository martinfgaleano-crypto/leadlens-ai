import { matchVerticalPack, packNeedsMap } from "@/lib/discovery/vertical-packs";
import type { ICP, LeadSearchCriteria } from "@/types";

let passed = 0;
function test(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`PASS: ${name}`);
}

const icp = { target_industries: ["natural products retail, wellness resorts and spas"], target_titles: ["head of procurement"], company_size_range: "mid to large", pain_points: [], disqualifiers: [], ideal_signals: [] } as ICP;
const criteria = { offer_summary: "herbal extract beverages for sleep, energy and digestive care", value_proposition: "natural wellbeing routines", buying_signals: ["nuevo programa de bienestar"], target_industries: icp.target_industries, target_geography: ["Colombia"] } as LeadSearchCriteria;
const pack = matchVerticalPack(icp, criteria);
test("Amor de Gea matches Colombia wellness channels pack", pack?.id === "wellness_channels_colombia");
const needs = pack ? packNeedsMap(pack, icp, criteria) : null;
test("pack includes channel expansion signals", needs?.relevant_signal_families.includes("expansion") === true);
test("client-provided signal is preserved", needs?.observable_signals.some(s => s.includes("nuevo programa de bienestar")) === true);
test("wellness pack has verified candidate domains", (pack?.seed_companies.filter(c => c.domain).length ?? 0) >= 8);
test("wellness pack prioritizes Colombian retail and hospitality buyers", pack?.seed_companies.some(c => c.name === "Grupo Éxito") === true && pack.seed_companies.some(c => c.name === "GHL Hoteles"));
test("third-party F&B is explicit counterevidence", pack?.counterevidence_hints.some(x => x.includes("third party")) === true);
const usPack = matchVerticalPack(icp, { ...criteria, target_geography: ["United States"] });
test("US target selects US pack without leaking Colombian seeds", usPack?.id === "wellness_channels_us" && !usPack.seed_companies.some(c => c.name === "Grupo Éxito"));
console.log(`\n${passed}/7 wellness vertical assertions passed.`);
