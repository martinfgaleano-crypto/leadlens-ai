import type { CommercialAccountResearch, ResearchCoverageState } from "./market-research-universe";

export interface CommercialResearchEvidence { source_id: string; url: string; domain: string; official: boolean; independent: boolean; content: string | null; extraction_ok: boolean; failure: string | null; }
export function isSameOrganizationDomain(hostOrUrl: string, corporateDomain: string): boolean {
  let host = hostOrUrl.toLowerCase();
  try { host = new URL(hostOrUrl).hostname.toLowerCase(); } catch { /* already a host */ }
  host = host.replace(/^www\./, ""); const domain = corporateDomain.toLowerCase().replace(/^www\./, "");
  return host === domain || host.endsWith(`.${domain}`);
}
const MECHANISMS: Array<[string, RegExp]> = [
  ["new_item_submission", /\b(new item submission|submit (?:a |your )?(?:new )?(?:item|product)|product submission)\b/i],
  ["supplier_registration", /\b(become (?:a |our )?(?:supplier|vendor)|supplier registration|vendor registration|prospective supplier)\b/i],
  ["brand_onboarding", /\b(submit your brand|brand submission|brand onboarding|new brand application)\b/i],
  ["local_supplier_program", /\b(local supplier|local producer|local forager|local brands? program)\b/i],
  ["wholesale_inquiry", /\b(wholesale (?:inquiry|application|account)|distribution inquiry)\b/i],
];
const BUYER_FUNCTIONS: Array<[string, RegExp]> = [
  ["category_management", /\b(category manager|category management|category review|category merchant)\b/i],
  ["procurement", /\b(procurement|purchasing team|purchasing department)\b/i],
  ["strategic_sourcing", /\b(strategic sourcing|sourcing manager|sourcing team)\b/i],
  ["merchandising", /\b(merchandis(?:e|ing|er)|grocery buyer|beverage buyer)\b/i],
  ["vendor_management", /\b(vendor management|supplier development|supplier relations)\b/i],
];

export function assessCommercialDepth(input: { account_ref: string; account_name: string; domain: string; route_id: string; decision: CommercialAccountResearch["decision"]; evidence: CommercialResearchEvidence[]; customer_dependency_ids: string[]; researched_at: string }): CommercialAccountResearch {
  const usable = input.evidence.filter((e) => e.extraction_ok && e.content);
  const official = usable.filter((e) => e.official);
  const officialText = official.map((e) => e.content).join("\n");
  const allText = usable.map((e) => e.content).join("\n");
  const mechanism = MECHANISMS.find(([, pattern]) => pattern.test(officialText)) ?? null;
  const buyerFunctions = BUYER_FUNCTIONS.filter(([, pattern]) => pattern.test(allText)).map(([name]) => name);
  const mechanismStatus: ResearchCoverageState = mechanism ? "VERIFIED" : official.length ? "RESEARCHED_NOT_FOUND" : input.evidence.some((e) => e.official) ? "FOUND_UNVERIFIED" : "RESEARCHED_NOT_FOUND";
  const independent = usable.filter((e) => e.independent);
  const failures = input.evidence.filter((e) => !e.extraction_ok && e.failure).map((e) => `${e.url}: ${e.failure}`);
  return {
    account_ref: input.account_ref, account_name: input.account_name, domain: input.domain, route_id: input.route_id, decision: input.decision,
    research_status: usable.length ? "VERIFIED" : input.evidence.length ? "FOUND_UNVERIFIED" : "RESEARCHED_NOT_FOUND",
    mechanism_status: mechanismStatus, mechanism_type: mechanism?.[0] ?? null, mechanism_source_ids: mechanism ? official.filter((e) => e.content && mechanism[1].test(e.content)).map((e) => e.source_id) : [],
    access_status: mechanism ? "VERIFIED" : mechanismStatus === "FOUND_UNVERIFIED" ? "FOUND_UNVERIFIED" : "RESEARCHED_NOT_FOUND",
    access_path: mechanism ? official.find((e) => e.content && mechanism[1].test(e.content))?.url ?? null : null,
    buyer_function_status: buyerFunctions.length ? "VERIFIED" : usable.length ? "RESEARCHED_NOT_FOUND" : "FOUND_UNVERIFIED", buyer_functions: buyerFunctions,
    corroboration_status: independent.length ? "ACHIEVED" : input.evidence.some((e) => e.independent) ? "NOT_FOUND" : "NOT_ATTEMPTED",
    counterevidence: [], customer_dependency_ids: input.customer_dependency_ids, retrieval_failures: failures, researched_at: input.researched_at,
    limitations: ["A public access mechanism is not buying intent, product acceptance or evidence of open category capacity.", ...(!mechanism ? ["No official supplier/product mechanism was verified in the retrieved pages."] : []), ...(!buyerFunctions.length ? ["No buyer function was verified from retrieved public text."] : [])],
  };
}
