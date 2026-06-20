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

**4. Lemon Squeezy checkout links**
```
NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL=https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL=https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL=https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL=https://leadlens.lemonsqueezy.com/checkout/...
```
- Get these from: app.lemonsqueezy.com → Products → [product] → Share
- These are public URLs — no secret, safe for `NEXT_PUBLIC_` exposure
- When set, pricing buttons redirect to Lemon Squeezy checkout

**Lemon Squeezy webhook (for automatic order persistence)**
```
LEMONSQUEEZY_WEBHOOK_SECRET=<from LS dashboard>
LEMONSQUEEZY_VARIANT_SAMPLE=<numeric variant id>
LEMONSQUEEZY_VARIANT_STARTER=<numeric variant id>
LEMONSQUEEZY_VARIANT_STANDARD=<numeric variant id>
LEMONSQUEEZY_VARIANT_PRO=<numeric variant id>
```
- Webhook URL: `https://leadlens-ai-xi.vercel.app/api/lemon-webhook`
- Events: check **order_created** only
- Without variant IDs, all orders fall back to plan "starter"

---

### Priority 4 — Required for order persistence and admin dashboard

**5. Supabase + SaaS Foundation schema**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
- Why: Stores orders, intakes, jobs, reports, and events; enables admin dashboard
- Schema: run `supabase/migrations/001_saas_foundation.sql` in the Supabase SQL Editor
- This creates tables: orders, customer_intakes, jobs, reports, job_events, admin_notes
- Note: uses service role key directly — no anon key needed for server-side access

**6. Admin API token**
```
ADMIN_SECRET_TOKEN=$(openssl rand -hex 32)
```
- Protects all `/api/admin/*` routes via `x-admin-token` header
- Set in `.env.local` for local dev, then **restart the dev server** for it to take effect
- Add same value to Vercel env vars for production
- Local admin dashboard: `http://localhost:3000/admin/login`
- Production admin dashboard: `https://your-domain.com/admin/login`
- Dev mode behavior: if token is NOT set, routes are open (console warning only). Always set it in production.

**7. Lemon Squeezy webhook secret**
```
LEMONSQUEEZY_WEBHOOK_SECRET=<from LS dashboard>
LEMONSQUEEZY_VARIANT_SAMPLE=<variant_id>
LEMONSQUEEZY_VARIANT_STARTER=<variant_id>
LEMONSQUEEZY_VARIANT_STANDARD=<variant_id>
LEMONSQUEEZY_VARIANT_PRO=<variant_id>
```
- Webhook URL to add in LS: `https://leadlens-ai-xi.vercel.app/api/lemon-webhook`
- LEMONSQUEEZY_VARIANT_* = numeric variant IDs from LS product dashboard
- Without these, variant → plan mapping falls back to "starter"

**Admin dashboard QA (run after setting items 5–7)**
1. `ADMIN_SECRET_TOKEN` set + server restarted → no "dev bypass" banner in `/admin`
2. `/admin/settings` shows `admin_token_configured: ✓`
3. `/admin/settings` shows `supabase_configured: ✓` after Supabase is connected
4. `/admin/settings` shows `lemonsqueezy_webhook_secret_configured: ✓` after webhook is set
5. `/admin` shows green "Core admin configuration ready" banner when all 3 are set

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

1. `NEXT_PUBLIC_LEMONSQUEEZY_*_URL` keys — enables real checkout (Lemon Squeezy)
2. `SUPABASE_*` keys — enables order/job persistence and admin dashboard
3. `LEMONSQUEEZY_WEBHOOK_SECRET` + variant IDs — enables automatic order creation
4. `HUNTER_API_KEY` (optional) — improves email coverage

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
