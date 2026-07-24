import type { UniverseCompany } from "./company-universe";

export interface UniverseQuality {
  total: number;
  dynamic_count: number;
  seed_count: number;
  obvious_count: number;
  verified_domain_count: number;
  country_confirmed_count: number;
  role_known_count: number;
  buyer_side_count: number;
  buyer_channel_count: number;
  hospitality_count: number;
  seller_side_count: number;
  buyer_role_diversity: number;
  dynamic_ratio: number;
  obvious_ratio: number;
  verified_domain_ratio: number;
  country_confirmed_ratio: number;
  role_known_ratio: number;
  buyer_side_ratio: number;
  status: "diverse" | "review_required" | "weak";
  blockers: string[];
}

export function evaluateUniverseQuality(companies: UniverseCompany[]): UniverseQuality {
  const total = companies.length;
  const dynamic_count = companies.filter(c => c.universe_origin === "dynamic_enumeration").length;
  const seed_count = companies.filter(c => c.universe_origin === "vertical_seed").length;
  const obvious_count = companies.filter(c => c.visibility_tier === "obvious").length;
  const verified_domain_count = companies.filter(c => c.confidence === "verified" && !!c.domain).length;
  const country_confirmed_count = companies.filter(c => c.country && c.country_confidence && c.country_confidence !== "unknown").length;
  const knownRoles = companies.filter(c => c.account_role && c.account_role !== "unknown");
  const buyerRoles = new Set(["buyer_channel", "hospitality_operator", "end_user_operator"]);
  const sellerRoles = new Set(["brand_owner", "seller_network", "service_provider"]);
  const role_known_count = knownRoles.length;
  const buyer_side_count = knownRoles.filter(c => buyerRoles.has(c.account_role!)).length;
  const buyer_channel_count = knownRoles.filter(c => c.account_role === "buyer_channel").length;
  const hospitality_count = knownRoles.filter(c => c.account_role === "hospitality_operator").length;
  const seller_side_count = knownRoles.filter(c => sellerRoles.has(c.account_role!)).length;
  const buyer_role_diversity = new Set(knownRoles.map(c => c.account_role).filter(r => r && buyerRoles.has(r))).size;
  const ratio = (n: number) => total ? Number((n / total).toFixed(3)) : 0;
  const blockers: string[] = [];
  if (total === 0) blockers.push("empty_universe");
  if (total >= 5 && dynamic_count === 0) blockers.push("no_dynamic_discovery");
  if (total >= 5 && ratio(obvious_count) > 0.25) blockers.push("too_many_obvious_accounts");
  if (total >= 5 && ratio(verified_domain_count) < 0.4) blockers.push("low_verified_domain_coverage");
  if (total >= 5 && ratio(country_confirmed_count) < 0.8) blockers.push("low_country_evidence_coverage");
  // Apply the role contract only when the product actually knows enough roles;
  // legacy verticals with no annotations remain observable, not falsely bad.
  if (total >= 5 && ratio(role_known_count) >= 0.6) {
    if (ratio(buyer_side_count) < 0.6) blockers.push("low_buyer_side_coverage");
    if (seller_side_count > Math.floor(total * 0.2)) blockers.push("too_many_seller_side_accounts");
    if (total >= 10 && buyer_side_count >= 4 && buyer_role_diversity < 2) blockers.push("single_buyer_role_universe");
  }
  const severe = blockers.includes("empty_universe") || blockers.includes("no_dynamic_discovery") || blockers.includes("low_buyer_side_coverage");
  return {
    total, dynamic_count, seed_count, obvious_count, verified_domain_count, country_confirmed_count,
    role_known_count, buyer_side_count, buyer_channel_count, hospitality_count, seller_side_count, buyer_role_diversity,
    dynamic_ratio: ratio(dynamic_count), obvious_ratio: ratio(obvious_count), verified_domain_ratio: ratio(verified_domain_count), country_confirmed_ratio: ratio(country_confirmed_count),
    role_known_ratio: ratio(role_known_count), buyer_side_ratio: ratio(buyer_side_count),
    status: severe ? "weak" : blockers.length ? "review_required" : "diverse", blockers,
  };
}
