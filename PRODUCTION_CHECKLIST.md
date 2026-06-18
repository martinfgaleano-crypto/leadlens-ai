# LeadLens AI — Production Checklist

## Current status in DEMO_MODE

| Feature | Status |
|---|---|
| Full 8-agent pipeline | ✅ Working |
| Mock lead generation (Starter 10, Standard 50, Pro 100) | ✅ Working |
| HOT/WARM/COLD/DISCARD qualification | ✅ Working |
| Personalized outreach sequences | ✅ Working |
| CSV + Markdown export | ✅ Working |
| Landing page + pricing | ✅ Working |
| Form → pipeline → results flow | ✅ Working |
| No external APIs required | ✅ Confirmed |

---

## What's needed for real lead search

### Priority 1 — Required (nothing real works without these)

**1. Anthropic API key**
- Key: `ANTHROPIC_API_KEY`
- Why: Powers ICP analysis, outreach writing, QC, and report generation
- Get it: console.anthropic.com
- Impact: Enables Claude-generated personalized copy (vs. template copy in DEMO_MODE)

**2. At least one lead provider**

| Provider | Key | Best for |
|---|---|---|
| Apollo | `APOLLO_API_KEY` | Structured B2B contact search by title, industry, company size |
| People Data Labs | `PEOPLE_DATA_LABS_API_KEY` | Large enrichment database, good for company + person data |
| Tavily | `TAVILY_API_KEY` | Web research fallback, good for company context |

Recommendation: **Start with Apollo** — best coverage for B2B SaaS + agencies, supports title/industry/location filters.

---

### Priority 2 — Strongly recommended

**3. Hunter.io (email finding)**
- Key: `HUNTER_API_KEY`
- Why: Finds and verifies emails when Apollo doesn't have them
- Impact: Increases deliverable email rate by 20–40%

---

### Priority 3 — Required to accept payments

**4. Stripe**
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...      # $29
STRIPE_PRICE_STANDARD=price_...     # $79
STRIPE_PRICE_PRO=price_...          # $149
```
- Create products and prices in the Stripe dashboard first
- Set up a webhook pointing to `{app_url}/api/webhook`

---

### Priority 4 — Required for async job delivery

**5. Supabase**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
- Why: Stores batch jobs, enables async processing, email delivery after payment
- Create a `batch_jobs` table using the schema in `lib/supabase/`

---

## Recommended connection order

### Step 0 — Confirm DEMO_MODE works
```bash
# .env.local should have DEMO_MODE=true, all other keys blank
curl http://localhost:3001/api/provider-status
# Expect: demo_mode=true, ready_for_mock_demo=true
```
Run a Starter plan from the UI → confirm 10 leads, HOT/WARM/COLD output, CSV export.

---

### Step 1 — Real AI test with mock leads (hybrid mode)

This is the safest way to validate Claude output quality before touching any lead database.

```bash
# .env.local changes:
DEMO_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
ALLOW_MOCK_LEADS_WITH_REAL_AI=true
```

```bash
curl http://localhost:3001/api/provider-status
# Expect: ready_for_ai_test=true
```

Run Starter → inspect outreach subject lines, email bodies, and qualification reasoning.
If anything looks wrong, set `DEMO_MODE=true` again to revert immediately.

Once quality is acceptable: move to Step 2.

---

### Step 2 — Real lead search

```bash
APOLLO_API_KEY=...           # or PEOPLE_DATA_LABS_API_KEY
ALLOW_MOCK_LEADS_WITH_REAL_AI=false   # or remove entirely
```

```bash
curl http://localhost:3001/api/provider-status
# Expect: ready_for_real_lead_search=true
```

---

### Step 3 — Payments + persistence

1. `STRIPE_*` keys — enables real checkout
2. `SUPABASE_*` keys — enables job storage + async email delivery
3. `HUNTER_API_KEY` (optional) — improves email coverage

---

## How to test provider status

```bash
curl http://localhost:3001/api/provider-status
```

Returns:
```json
{
  "demo_mode": true,
  "anthropic_configured": false,
  "apollo_configured": false,
  "ready_for_mock_demo": true,
  "ready_for_real_lead_search": false,
  "ready_for_payment": false,
  "missing_required_for_real_run": ["ANTHROPIC_API_KEY", "Lead provider key", "Stripe keys", "Supabase keys"],
  "next_steps": [...]
}
```

---

## How to know you're ready for a real test run

`GET /api/provider-status` should return:
```json
{
  "demo_mode": false,
  "anthropic_configured": true,
  "apollo_configured": true,
  "ready_for_real_lead_search": true
}
```

Then set `DEMO_MODE=false` in `.env.local` and run a Starter plan ($29) to verify end-to-end.

---

## Security constraints (permanent)

- No automated email sending
- No automated LinkedIn messaging
- No aggressive scraping
- No sending to leads without human review
- No promises of specific meeting counts
- DEMO_MODE must always work without any external API
