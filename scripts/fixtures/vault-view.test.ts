import { deriveCompanyType, buildCompanyViews, summarize, inventory, type VaultCompanyRow } from "../../lib/admin/vault-view";

let passed = 0, failed = 0;
function check(name: string, cond: boolean) { if (cond) { passed++; } else { failed++; console.error(`FAIL: ${name}`); } }
const eq = (name: string, a: unknown, b: unknown) => check(`${name} (got ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b));

// ── deriveCompanyType: deterministic, bounded, Unknown fallback ──
eq("consultancy", deriveCompanyType({ name: "Acme Consulting", industry: null }), "Consultancy");
eq("agency", deriveCompanyType({ name: "Bright Agency", industry: "Marketing" }), "Agency");
eq("manufacturer", deriveCompanyType({ name: "Thor Industries", industry: "RV Manufacturing" }), "Manufacturer");
eq("distributor", deriveCompanyType({ name: "Grainger", industry: "Industrial Distribution" }), "Distributor");
eq("logistics", deriveCompanyType({ name: "XPO", industry: "Freight & Logistics" }), "Logistics");
eq("saas", deriveCompanyType({ name: "Datadog", industry: "Cloud Software" }), "Software / SaaS");
eq("healthcare", deriveCompanyType({ name: "Pfizer", industry: "Pharmaceuticals" }), "Healthcare");
eq("financial", deriveCompanyType({ name: "JPMorgan", industry: "Banking" }), "Financial Services");
eq("energy", deriveCompanyType({ name: "NextEra", industry: "Renewable Energy" }), "Energy");
eq("unknown-empty", deriveCompanyType({ name: "", industry: null }), "Unknown");
eq("unknown-generic", deriveCompanyType({ name: "Globex", industry: "Diversified Holdings" }), "Unknown");
// precedence: consultancy wins over industry keywords when name says consulting
eq("precedence", deriveCompanyType({ name: "Manufacturing Consulting Group", industry: "Manufacturing" }), "Consultancy");

// ── buildCompanyViews: event/source counts from agg ──
const rows: VaultCompanyRow[] = [
  { id: "a", name: "Alpha Mfg", domain: "alpha.com", industry: "Manufacturing", region: null, country: "US", source_status: "customer_run", first_seen_at: null, last_seen_at: null, observation_count: 1 },
  { id: "b", name: "Beta Consulting", domain: "beta.com", industry: null, region: null, country: "US", source_status: "customer_run", first_seen_at: null, last_seen_at: null, observation_count: 2 },
  { id: "c", name: "Gamma", domain: "gamma.io", industry: null, region: null, country: "CO", source_status: "provider_search", first_seen_at: null, last_seen_at: null, observation_count: 1 },
];
const agg = new Map([
  ["a", { events: 3, sourceIds: new Set(["s1", "s2"]) }],
  ["b", { events: 1, sourceIds: new Set(["s1"]) }],
]);
const views = buildCompanyViews(rows, agg);
eq("view a events", views[0].eventCount, 3);
eq("view a sources", views[0].sourceCount, 2);
eq("view c no events", views[2].eventCount, 0);
eq("view a type", views[0].companyType, "Manufacturer");

// ── summarize: totals, composition, growth windows ──
const NOW = Date.UTC(2026, 7, 30, 12, 0, 0); // 2026-08-30T12:00Z
const iso = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const growthRows: VaultCompanyRow[] = [
  { id: "n1", name: "NewCo", domain: null, industry: "Manufacturing", region: null, country: "US", source_status: "customer_run", first_seen_at: iso(2), last_seen_at: iso(2), observation_count: 1 }, // new 24h
  { id: "r1", name: "OldCo", domain: null, industry: "Banking", region: null, country: "US", source_status: "customer_run", first_seen_at: iso(240), last_seen_at: iso(3), observation_count: 2 }, // reobserved 24h (first 10d ago, last 3h ago)
  { id: "o1", name: "StaleCo", domain: null, industry: null, region: null, country: "CO", source_status: "provider_search", first_seen_at: iso(500), last_seen_at: iso(500), observation_count: 1 }, // neither
];
const gv = buildCompanyViews(growthRows, new Map());
const sum = summarize(gv, 42, 17, NOW);
eq("total companies", sum.companies, 3);
eq("total events passthrough", sum.events, 42);
eq("total sources passthrough", sum.sources, 17);
eq("countries distinct (US,CO)", sum.countries, 2);
eq("new 24h", sum.newCompanies24h, 1);
eq("reobserved 24h", sum.reobserved24h, 1);
eq("new 7d includes new24h only (others older)", sum.newCompanies7d, 1);
eq("reobserved 7d", sum.reobserved7d, 1);
check("byCountry sorted desc", sum.byCountry[0].count >= sum.byCountry[sum.byCountry.length - 1].count);
check("companyTypes excludes Unknown from count", sum.companyTypes === 2); // Manufacturer + Financial Services (StaleCo Unknown)

// ── inventory: search, filter, sort by last_seen desc, paginate ──
const invAll = inventory(gv, {});
eq("inventory total", invAll.total, 3);
eq("inventory sort last_seen desc first", invAll.items[0].id, "n1"); // n1 last_seen 2h ago is most recent
const invSearch = inventory(gv, { q: "newco" });
eq("search by name", invSearch.total, 1);
const invCountry = inventory(gv, { country: "CO" });
eq("filter country", invCountry.total, 1);
const invType = inventory(gv, { companyType: "Manufacturer" });
eq("filter type", invType.total, 1);
const invPage = inventory(gv, { pageSize: 2, page: 2 });
eq("paginate pageSize", invPage.pageSize, 2);
eq("paginate page2 count", invPage.items.length, 1);
eq("paginate pages", invPage.pages, 2);
const invClamp = inventory(gv, { page: 99 });
eq("page clamp to last", invClamp.page, 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
