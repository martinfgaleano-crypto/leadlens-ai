# LeadLens — Account-First Discovery Architecture Report

1. Initial HEAD `05a75553e5899cdb1ec5f3cb1f1caea9f1e2345c`; `main` matched `origin/main`; only the two authorized runtime JSON files were modified.
2. Production `/login` returned 200; Admin remained protected with 307.
3. Current pipeline: commercial hypothesis → keyword query → webpage → domain → late entity/identity → qualification. Context is strong at qualification but too late to protect retrieval.
4. Funnel loss: V1 90 raw/56 domains/24 verified/18 qualified; V2 39/28/6/1. V2 filtered better but webpage-first retrieval sharply limited useful entity yield.
5. Contamination: articles, directories, product/category pages, brands, suppliers seeking distributors, foreign entities, social/location duplicates and unresolved businesses.
6. Buyer/seller errors: distribution language was treated as buyer evidence; Vitaliah proves that “become a distributor/our products” is supplier evidence, not distributor-buyer evidence.
7. Source map: route-specific preferred/rejected ecosystems now exist for specialty retail, hospitality/spa, gifting and selective distribution.
8. Entity types: buyer account, retailer, hospitality, spa, gifting intermediary, distributor, brand, manufacturer, product, article/media, directory, marketplace, association, event and unknown.
9. Business roles: potential buyer, reseller, curator, hospitality user, gifting intermediary, distributor buyer, supplier, brand seeking distribution, manufacturer and unclear.
10. Business-model gate: only verified/strongly inferred models with official identity, activity, Colombia relevance, compatible buyer role and third-party behavior may enrich.
11. Canonical identity: stable ID, names, official domain, socials, branches, parent, geography, route, entity/role, sources, confidence, activity and history.
12. Discovery/evidence separation: directories may harvest names but cannot validate procurement, multibrand behavior, recurrence, openness or timing.
13. Strategies: directory-to-official, stockist mining, association membership, catalog extraction, local clusters and adjacency networks.
14. Enforced order: ecosystem → harvest → classify → identity → buyer role → business model → context structural gate → enrichment → qualification → portfolio.
15. Under-enriched triage: 41 persisted domains structurally classified; non-account and unresolved entities are marked preventable before candidate creation. No broad research occurred.
16. Fixtures: plausible buyers and weak/non-buyers remain sanitized test cases; production classifiers do not hardcode company names.
17. Metrics: entity yield, buyer rate, domain resolution, model verification, contamination, brand-as-buyer error, identity/context pass, qualification, research efficiency, cost/time and portfolio challenge.
18. Baselines: V1 and V2 are preserved. Account-first status is `NOT YET TESTED`; no superiority claim is permitted.
19. Future plan `amor_account_first_validation_v1`, `FOUNDER REVIEW`, not executed.
20. Future budget: 4 ecosystems, 4 calls, 20 entities, 10 domains, 6 verified models, 4 qualified challengers.
21. Admin: internal Account-First Discovery section with diagnosis, contamination, triage, source maps, strategies, order, metrics and validation plan.
22. Tests: account-first classifier/gates/order/triage/plan and bounded-search/result contracts passed.
23. TypeScript: `npx tsc --noEmit` passed.
24. Build: passed, 134/134 pages; Admin pilot first-load JS remains 119 kB.
25. Migration: none.
26. Files: reusable discovery module/tests, Admin workspace, architecture report and continuity notes; runtime JSON excluded.
27. Commit target: `feat: design account-first opportunity discovery`.
28. Push/deployment required after commit.
29. Founder decision: approve/revise the four-ecosystem validation plan and its success/stop rules.
30. Activation event: explicit founder authorization naming `amor_account_first_validation_v1` and approving up to four provider calls.
31. Stop: 0 provider calls, V3R3 unchanged, no V3R4, client contact, report delivery, outreach, CRM or Phase 5B.

Continuation: validation `amor_account_first_validation_v1` used four Tavily calls. Two authoritative ecosystems were accepted but yielded no resolvable buyer account; 18/20 weak sources were stopped and enrichment waste was zero. Verdict: INCONCLUSIVE; return to source-map design.
