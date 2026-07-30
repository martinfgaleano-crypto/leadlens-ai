# LeadLens Intelligence OS — Block 10

## Colombian entity resolution, provider query calibration and signal attribution recovery

Status: complete in code; migration 044 generated and intentionally not applied
Methodology target: `colombian-entity-resolution-v1`

## 10A. Block 9 identity-attribution audit

Audit artifact: `ml/data/entity-resolution/block9-identity-attribution-audit.json`.

The complete 56-row matrix was produced before changing identity thresholds or provider routing. Each row preserves account, source, provider, query family, name/domain/location/category/social/legal anchors, relationship state, identity decision, confidence, decisive evidence, missing evidence, prior rejection and correctness.

### Distribution

- Results inspected: 56/56.
- Exact company: 2.
- Same/similar commercial name but different company: 7.
- Unrelated namesake/result: 41.
- Directory profile: 3.
- Social profile: 2.
- Unresolved generic title: 1.
- Confirmed identity: 2.
- Wrong entity: 53.
- Unresolved: 1.
- Correct prior rejections: 56/56.

The two exact-company results were official-domain product pages for BioPlaza and Somos Consiente. Neither contained an atomic dated event, so their rejection remained correct.

The seven deceptive similar-name cases were mainly:

- “Natural + Mente” retrieving Natura expansion articles;
- Distribuidora DAM retrieving Damasco;
- Somos Consiente retrieving Somos Internet.

The remaining noise came from broad event terms returning unrelated Colombian and international companies such as Ferrari, Renault, Vertiv, Arturo Calle, Wyndham, Columbia and Bodytech.

### Root cause

Block 9 did not miss 54 attributable events because the identity threshold was too strict. Its broad Boolean account queries were interpreted as generic event searches and did not reliably retain the quoted target name as a required term. The identity gate correctly prevented those results from becoming signals.

The audit supports:

1. identity queries before any event query;
2. one event intent per provider query;
3. verified-domain and city/category anchors;
4. explicit similar-name exclusions;
5. stopping event spend for unresolved accounts.

It does **not** support lowering the `.65` event-attribution identity threshold or confirming entities through name similarity alone.

## 10B–10D. Resolution and attribution architecture

`lib/intelligence/colombian-entity-resolution.ts` now defines Colombia-aware name normalization, canonical profiles, typed anchors, official properties, candidates, immutable relationship graphs, provider query plans, provider health, identity-first budgets, event scope and explicit attribution. Dotted legal forms are collapsed before punctuation removal; legal suffixes are removed only from the comparison value. Generic business prefixes are recorded but retained.

Confirmation requires a strong anchor plus reinforcement or two strong anchors. Weak name similarity never confirms; a conflicting domain, geography or decisive category blocks or makes the candidate ambiguous. Parent, subsidiary, branch, distributor, retailer and marketplace identities remain separate.

Official website/social properties require ownership evidence. Properties controlled by the same verified domain retain one source-owner key and do not falsely create independent corroboration. Public Colombian registry surfaces remain optional anchors subject to access, freshness, lawful use and per-source automation assessment; Block 10 adds no restricted scraping.

## Provider calibration and Serper decision

Brave uses quoted exact-name, city/category and event-intent queries. Tavily uses broader Colombian semantic discovery and verified-domain event variants; extraction remains URL-selected. One minimal Serper request used POST `/search`, `X-API-KEY`, and JSON `q/num/hl/gl`. It returned `HTTP 400: Not enough credits`. This is account/quota, not malformed serialization. Serper is `disabled`, `automatic_fallback=false`, with manual re-enable after credits/configuration recovery. The probe stores no key or raw payload.

## Same-six identity-first pass

Artifact: `ml/data/entity-resolution/amor-de-gea-block10-2026-07-30T14-24-06-487Z.json`.

- Accounts: 6; identity queries: 18; successful-pass searches: 30; results: 106.
- Extractions: 0; all identity/event extraction caps respected.
- Confirmed identities: 6; high-confidence/probable/unresolved: 0/0/0.
- Verified domains: 6; verified official website properties: 6.
- Event-eligible accounts: 6.
- Dated event results: 0; directly attributable events/signals: 0/0.
- Cost: not measured because adapters returned no per-request cost.

The pass improved by resolving and rejecting identity noise earlier, not by weakening acceptance. Profiles were confirmed from persisted verified domains reinforced by recovered results on those domains. No social profile, legal name or NIT was invented. Two aborted development attempts reached only the first account identity phase before local reference errors; they created no artifact and no event search. Their calls are disclosed as unmeasured overhead outside successful-pass metrics.

## Block 9 comparison, persistence and integration

Block 9 had 18 searches, 56 results, 2 exact-company results, 53 wrong entities, 1 unresolved and 0 signals. Block 10 resolved 6/6 accounts before event spend, preserved false-positive protection, and still returned 0 signals because no valid dated event existed. Signal-attribution recovery is therefore 0.

Migration 044 is the smallest safe persistence addition: one tenant-scoped, append-only, service-role envelope for profile/candidate/anchor/relationship/property/provider-health/attribution/run history. It is generated but **not applied**. The Command Center reads the provider-free artifact and shows entity coverage, confirmed/unresolved accounts, verified domains/properties, event eligibility, direct events, bottleneck and sanitized health. Render performs no provider calls.

## Limitations, next block and stop

No lawful registry linkage or official social property was recovered in this bounded pass; provider cost remains unmeasured; Serper has no credits; and no dated directly attributable event was found. Outputs stay internal-only and ranking/report impact stays off.

Exact next block: Block 11 only under new authorization, after migration 044 review/application if durable entity history is required. Final Amor de Gea reporting, broad discovery, recurring monitoring, adaptive ranking and customer-facing promotion were not started.
