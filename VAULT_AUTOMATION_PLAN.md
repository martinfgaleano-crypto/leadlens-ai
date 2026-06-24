# LeadLens Vault Automation Plan

## Vision

Transform LeadLens Vault from a passive cache (leads stored after customer searches) into a
**self-growing intelligence layer** that accumulates proprietary company intelligence before
customers ever ask for it. Each stage below is independently deployable.

---

## Stage 1 — Manual Scout + Manual Review (NOW)

**What is built:**
- `vault_candidates` table — staging area for discovered companies
- Scout engine (`lib/vault-candidates/scout.ts`) — accepts any externally discovered company
- Review engine (`lib/vault-candidates/reviewer.ts`) — validates, deduplicates, approves/rejects
- Promotion engine (`lib/vault-candidates/promote.ts`) — moves approved candidates into Vault
- Admin UI (`/admin/vault-candidates`) — human triage queue

**How it works:**
1. Admin manually adds a company via the UI or API (`POST /api/admin/vault-candidates`)
2. Admin runs review (auto-checks) and approves/rejects
3. Admin clicks "Promote" → company enters `vault_leads` + `company_profiles`
4. Future customer searches matching that company get instant vault hits

**When to move to Stage 2:**
- When the candidate queue exceeds ~50 new entries per week (manual review becomes a bottleneck)

**Risks:**
- Low volume; depends on admin discipline to add candidates regularly

---

## Stage 2 — Manual Scout + Claude Review

**What changes:**
- Admin still discovers companies manually (or via import/upload)
- Claude reviews each candidate automatically using the review API
- Claude fills `claude_review_notes` with structured reasoning
- Confidence scores are assigned by Claude, not manually

**Integration point:**
- `POST /api/admin/vault-candidates/[id]` with `{ action: "review" }` already exists
- Extend reviewer to call Anthropic Claude API with the candidate data and return structured JSON:
  ```
  { status, reason, confidence_score, notes }
  ```
- Wire this to a scheduled task or post-insert trigger

**Claude prompt template (example):**
```
You are a B2B company quality reviewer. Given this company:
  Name: {company_name}
  Website: {website}
  Country: {country}
  Industry: {industry}
  Notes: {raw_notes}

Score the company 0–100 for B2B lead quality. Return JSON:
{ "confidence_score": N, "status": "approved|rejected|needs_review", "reason": "..." }
```

**When to move to Stage 3:**
- When Stage 2 is running stably and the review queue is consistently cleared automatically

**Risks:**
- Claude review cost per candidate (~$0.01–0.05 each depending on prompt length)
- Claude can hallucinate company details — never auto-promote without domain verification
- Confidence threshold must be tuned to avoid mass approval of low-quality entries

**Safeguards:**
- All Claude approvals remain in `approved` state; promotion is a separate manual step until Stage 3 is trusted
- `confidence_score < 75` candidates require human review even if Claude says "approved"
- Rate-limit Claude review to N candidates per hour

---

## Stage 3 — Claude Scout + Claude Review

**What changes:**
- Claude Scout routines discover companies proactively from external signals
- Claude Review validates and scores them automatically
- High-confidence approvals can be auto-promoted (with safeguards)

**Scout sources (examples):**
| Source | Type | Signal |
|--------|------|--------|
| Crunchbase API | API | Recently funded companies in target sectors |
| Product Hunt | RSS | New B2B SaaS launches |
| LinkedIn Company Search | API (requires partner) | Companies matching ICP industry + size |
| G2 category pages | Structured scrape (legal review needed) | SaaS companies by category |
| Job boards (Indeed/Greenhouse) | RSS | Companies hiring roles matching ICP |

**`candidate_sources` table** is already created. Each scout routine registers itself:
```sql
INSERT INTO candidate_sources (source_name, source_type, active, notes)
VALUES ('crunchbase_funded', 'api', true, 'Recently funded B2B SaaS companies');
```

**Scout routine lifecycle:**
1. Cron triggers Claude Task (e.g., every night at 2am)
2. Claude Task fetches from source, extracts company data
3. `bulkInsertCandidates()` stages new entries
4. `candidate_sources.last_run` + `last_results` updated
5. Claude Review runs automatically on new candidates
6. High-confidence (>= 85) candidates are auto-promoted; others wait for human approval

**When to move to Stage 4:**
- When approval rate from Claude Scout is consistently > 70% and false-positive rate (bad companies in vault) stays < 5%

**Risks:**
- Source rate limits and ToS (especially LinkedIn, G2)
- Scout may find many companies in the wrong niche if prompts aren't precise
- Cost scales with volume (both scout fetches and review API calls)

**Safeguards:**
- `candidate_sources.active = false` kills any scout in one DB update
- Hard cap: no more than 500 auto-promotions per day
- Auto-promoted records tagged `discovered_by = "claude_scout_auto"` for audit trail
- Weekly human spot-check of 20 random auto-promoted candidates

---

## Stage 4 — Autonomous Vault Growth

**What changes:**
- The full pipeline runs without human intervention
- Claude Scout identifies new sources based on ICP drift (customer ICPs shift over time)
- Self-healing: if a source's approval rate drops below 40%, it is auto-disabled

**Architecture:**
```
Vercel Cron (nightly)
  → Scout Task: fetch from registered sources
      → bulkInsertCandidates()
  → Review Task: Claude reviews all "new" candidates
      → approveCandidate() or rejectCandidate()
  → Promote Task: promoteAllApproved()
      → vault_leads + company_profiles updated
  → Health check: approval_rate, source quality, duplicate rate
      → disable underperforming sources
      → alert admin if overall approval_rate < 50%
```

**Vault compounding effect:**
- Every customer search adds leads to the vault
- Every Claude Scout run adds companies to the vault
- Each new customer search gets progressively cheaper (more vault hits, fewer Apollo calls)
- Target: 80%+ vault hit rate within 12 months of Stage 4 launch

**Risks:**
- Quality drift: vault fills with outdated or wrong companies if no cleanup
- Cost at scale: 10,000 candidates/month × review cost is non-trivial
- Data freshness: company websites and contacts change; vault leads can go stale

**Safeguards:**
- Vault leads older than 180 days get a `stale` flag and are deprioritised in search
- Scout sources have a `last_results` quality check — if last 3 runs produce <10% approval, auto-disable
- Monthly vault cleanup job: remove records with no customer match in 6+ months
- Emergency kill switch: `candidate_sources` with `active = false` stops all scouting instantly
- Spending cap: `VAULT_SCOUT_DAILY_LIMIT` env var caps total candidates processed per day

---

## Implementation Checklist

### Stage 1 (Complete)
- [x] `vault_candidates` table (migration 022)
- [x] `candidate_sources` table (migration 022)
- [x] Scout engine — `lib/vault-candidates/scout.ts`
- [x] Reviewer engine — `lib/vault-candidates/reviewer.ts`
- [x] Promotion engine — `lib/vault-candidates/promote.ts`
- [x] Pipeline stats — `lib/vault-candidates/stats.ts`
- [x] Admin API — `GET/POST /api/admin/vault-candidates`
- [x] Admin API — `GET/PATCH /api/admin/vault-candidates/[id]`
- [x] Admin UI — `/admin/vault-candidates`
- [x] Vault Performance extended with candidate metrics

### Stage 2 (Next)
- [ ] Extend `reviewCandidate()` to call Claude API when `ANTHROPIC_API_KEY` is set
- [ ] Scheduled review task (Vercel Cron or manual trigger)
- [ ] Structured review response schema with confidence scoring

### Stage 3
- [ ] `candidate_sources` active integration (scout routines update `last_run`)
- [ ] First Claude Scout routine (recommend: Crunchbase or job board RSS — lowest legal risk)
- [ ] Auto-promotion logic for high-confidence candidates

### Stage 4
- [ ] Self-disabling source health check
- [ ] Vault staleness flags + cleanup job
- [ ] ICP-aware scout (reads customer ICPs to tune searches)
- [ ] Spending cap enforcement

---

## Key Metrics to Track

| Metric | Stage 1 target | Stage 4 target |
|--------|---------------|----------------|
| Candidates/week | > 10 (manual) | > 500 (autonomous) |
| Approval rate | > 60% | > 70% |
| Promotion rate | > 80% of approved | > 95% of approved |
| Vault hit rate (customer searches) | 20–40% | 80%+ |
| Apollo calls saved/month | 0 | > 60% |
