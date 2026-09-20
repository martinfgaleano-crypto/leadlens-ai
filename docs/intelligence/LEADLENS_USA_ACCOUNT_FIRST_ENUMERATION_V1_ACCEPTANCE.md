# LeadLens — USA Account-First Operating-Company Enumeration V1 Acceptance

Sprint verdict: **PARTIAL** — the controlled experiment **validated the enumeration source layer**
(directory/association/list pages exist, are report-vendor-free, are scrapeable, and real operators
resolve to canonical domains) but **disproved production safety of name-based admission**: enumeration
pages mix real companies with industry-category headers, and category names keyword-match SEO domains,
so a bounded name-list discriminator admits ~80% wrong entities (§50). No enumeration code was shipped;
the product is unchanged. Builds on `LEADLENS_USA_OPERATING_COMPANY_DISCOVERY_V1_ACCEPTANCE.md`.

Branch `intelligence-launch-acceptance-v1` · start HEAD `4bb1b4f` · end HEAD `4bb1b4f` (+ this doc) ·
worktree `leadlens-landing-v2`. No product code change. No push. No merge. Frozen core / other
worktree untouched.

## Providers
Brave HEALTHY · Tavily HEALTHY · Firecrawl HEALTHY (`/v1/scrape` returned markdown). Serper not
required. Exa/SAM.gov/Data.gov not integrated. No Anthropic spend (deterministic extraction + heuristic
identity resolution); only bounded search + 2 scrapes per run.

## Phase B — controlled experiment (three bounded steps)

**1. Source probe (does enumeration find company-listing pages?) — YES.** Buyer-category enumeration
queries ("list of manufacturing companies in the United States", "US manufacturers association members
directory", "top food & beverage manufacturers United States", …) returned **0 market-research-vendor
hosts** (vs event-first's mordorintelligence/technavio flood) and 7–8/8 list-ish pages: `nam.org`,
`fmamfg.org`, `midwestmanufacturers.com` member directories; IndustryWeek "IW U.S. 500 manufacturers";
`foodprocessing.com` Top 100; Wikipedia manufacturer lists; `thomasnet.com` plant lists. **The source
layer works.**

**2. Extraction + identity proof — real companies resolve cleanly, but crude extraction admits noise.**
Firecrawl-scraping a Wikipedia manufacturer list (90 KB markdown) + resolving link texts via the real
`resolveCorporateIdentity`: Apple→apple.com, Ford→ford.com, Toyota→toyota.com, Volkswagen/Samsung/
Foxconn resolved to correct canonical domains (≥6 real operators obtainable) — **but** crude extraction
also admitted countries ("Germany"→germany.info), publishers ("Fortune Global 500"→fortune.com), and a
global revenue list yields foreign-HQ firms (geography, §19).

**3. Strictly-gated module + live proof — the hard blocker surfaced.** A dependency-injected
`enumerateOperatingCompanies` (source-discovery → scrape → `extractCompanyNames` → `resolveCorporateIdentity`
→ `classifyOrganization` → dedup) with a strict non-company reject (countries, publisher/aggregator
hosts, list artifacts, clause fragments, and — after one hardening cycle — industry-category words) and
**15/15 deterministic fixtures** (admits Apple/Ford/Acme Foods; rejects Germany/Fortune/Bloomberg/
duplicates; directory never becomes an account). Run **live** on the US industrial-automation context it
admitted 10 candidates, of which only **2 were real companies** (Rockwell Automation→rockwellautomation.com,
Arrow→arrow.com); the other 8 were **industry categories** ("Plastics"→plasticsindustry.org,
"Textiles"→textiles.org, "Shipbuilding"→usashipbuilding.com, "Electronic Manufacturing"→…, "Companies
Database"→…). A data-vendor category-menu page (`cience.com`) was scraped, and **category words
keyword-match SEO/industry-org domains**, so name-list rejection is whack-a-mole.

## Controlled experiment decision
**ENUMERATION_PROMISING_BUT_INCOMPLETE.** Source discovery + scrape + identity resolution of real
companies is proven viable; **company-vs-industry-category discrimination on mixed enumeration pages is
the unsolved blocker** and cannot be made production-safe with a bounded name-list. Per §50 (wrong-company
= FIX-BEFORE-CLOSE) and §55 (leave the product unchanged when safe value is not demonstrated), the module
was **not shipped** and was removed; the product is unchanged.

## Why name-list rejection fails (the core finding)
Real companies (Rockwell Automation, Arrow) and industry categories ("Plastics", "Textiles") are both
capitalized noun phrases, and both resolve to plausible domains (a company's own site vs an industry
`.org`/SEO domain). Neither `extractCompanyNames` (name shape) nor `resolveCorporateIdentity` (keyword
domain match) nor `classifyOrganization` (marks both `private_company`) can separate them. A stronger
discriminator is required.

## Blueprint for a production-safe build (next increment)
1. **Source quality:** prefer curated *company* directories (association member lists — nam.org,
   fmamfg.org; Wikipedia `Category:X_companies_of_the_United_States`) over data-vendor category menus;
   classify source structure before extraction.
2. **Discriminator (the decisive piece):** one of — (a) a bounded LLM classification per candidate
   ("operating company" vs "industry/sector category" vs "publisher/directory", grounded to the source
   line); (b) corporate-domain verification that rejects industry-`.org`/SEO category domains and
   requires a genuine company site (fetch + own-brand check); or (c) extraction only from structured
   company-directory markup (member-row schemas), never free prose.
3. **Geography:** US-specific sources + verified US operating presence (§19), not HQ or `.com`.
4. **Reuse:** the strict non-company primitives designed here (country/publisher/host/clause/category
   rejects), `resolveCorporateIdentity`, `classifyOrganization`, and the existing `hunt` admission +
   Account-First/Event-First fusion. Emit `RawDiscoveredOrg{origin:"account_first_enumeration"}`;
   directory never becomes an account; source never becomes Evidence/Timing.

## Truth safety
No code shipped → no new violation. The prior identity-precision guard (`plausibleSubject`, 5eb02c7)
is intact. Deterministic gate remains green at HEAD.

## Status
USA discovery: **USA_DISCOVERY_NO_SAFE_IMPROVEMENT** this session (source layer validated; safe admission
not achieved). Readiness unchanged: Preview/Brief/Portfolio/Premium USA — **GUIDED_BETA**.

## Remaining primary blocker
**Company-vs-industry-category discrimination** in Account-First enumeration (and, behind it, the USA
productive Candidate-Universe recall it exists to fix).

## Next three moves
1. Build the **discriminator** (bounded LLM company/category/publisher classifier, grounded per source
   line) — the single decisive piece; validate on the same live US industrial-automation source set
   (target: ≥6 admitted with 0 category/publisher entities).
2. Add **source-structure classification** so category-menu pages (cience.com-style) are skipped in
   favor of member/company directories; re-run the bounded live proof.
3. Only when the live proof admits clean operators with ~0 wrong entities, wire the module into the
   productive Account-First path and run the frozen US Track A contexts once each.

## Canonical artifacts (by path)
- `docs/intelligence/LEADLENS_USA_OPERATING_COMPANY_DISCOVERY_V1_ACCEPTANCE.md`
- `docs/intelligence/LEADLENS_INTELLIGENCE_{CORE_AND_TIERS_COMPLETION_V1,PRODUCTIZATION_AND_RELEASE_V2}_ACCEPTANCE.md`
- `lib/discovery/corporate-identity.ts` (`resolveCorporateIdentity`) · `lib/discovery/organization-type.ts` (`classifyOrganization`) · `lib/lead-hunter/candidate-universe.ts` (`hunt`, `RawDiscoveredOrg`)
