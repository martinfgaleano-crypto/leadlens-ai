# LeadLens AI — Beta Launch Checklist

**Goal:** Accept first real paying customers. Full pipeline works. Payments flow. Report delivered.

---

## Status legend
- ✅ Done / working now
- 🔧 Needs configuration (env var)
- ⬜ Not started

---

## Tier 1 — Minimum viable (must have before taking money)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Full 8-agent pipeline in DEMO_MODE | ✅ | Confirmed working |
| 2 | Hybrid mode (Claude + mock leads) | ✅ | `ALLOW_MOCK_LEADS_WITH_REAL_AI=true` |
| 3 | ANTHROPIC_API_KEY configured | ✅ | Claude sonnet-4-6 |
| 4 | Landing page + pricing page | ✅ | /demo-pipeline |
| 5 | Form → pipeline → results flow | ✅ | Fully working |
| 6 | HOT/WARM/COLD/DISCARD qualification | ✅ | Calibrated scoring |
| 7 | Personalized outreach (email + DM + follow-ups) | ✅ | 4-part structure, no hard claims |
| 8 | QC agent with REVISION suggestions | ✅ | Working |
| 9 | CSV + Markdown export | ✅ | Working |
| 10 | Multilingual form (en/es/pt/ja) | ✅ | Added to form |
| 11 | Market region selector | ✅ | Added to form |
| 12 | Job store (in-memory fallback) | ✅ | `lib/storage/job-store.ts` |
| 13 | `/api/checkout` endpoint | ✅ | With DEMO_MODE fallback |
| 14 | `/api/jobs` + `/api/jobs/[jobId]` | ✅ | CRUD working |
| 15 | Stripe keys configured | 🔧 | Add STRIPE_SECRET_KEY + prices |
| 16 | At least one real lead provider | 🔧 | Apollo $49/mo when ready |
| 17 | Resend email delivery | 🔧 | Add RESEND_API_KEY |
| 18 | Manual delivery process confirmed | ⬜ | Who sends the report CSV? |

---

## Tier 2 — Strongly recommended for beta

| # | Item | Status | Notes |
|---|------|--------|-------|
| 19 | Custom domain + SSL | ⬜ | Vercel or similar |
| 20 | `FROM_EMAIL` configured (Resend) | 🔧 | Set to verified sender |
| 21 | Supabase for job persistence | 🔧 | Optional — in-memory fallback works |
| 22 | Stripe webhook configured | 🔧 | `/api/webhook` endpoint exists |
| 23 | Apollo API key (paid plan) | 🔧 | $49/mo — needed for real leads |
| 24 | Privacy + Terms pages | ⬜ | Basic legal coverage |
| 25 | Contact page / email | ⬜ | For beta support |
| 26 | NEXT_PUBLIC_APP_URL set correctly | 🔧 | Remove trailing `=` in .env.local |

---

## Tier 3 — Post-launch improvements

| # | Item | Status | Notes |
|---|------|--------|-------|
| 27 | Supabase async job queue | ⬜ | Enables "pay now, deliver in 48h" |
| 28 | Dashboard for job status | ⬜ | Simple job list page |
| 29 | Hunter.io email verification | ⬜ | Improves email deliverability |
| 30 | Tavily web research integration | ⬜ | Better company context |
| 31 | People Data Labs enrichment | ⬜ | Larger lead DB |

---

## Before taking first payment — verify these

### 1. Hybrid mode test
```bash
# .env.local:
DEMO_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
ALLOW_MOCK_LEADS_WITH_REAL_AI=true

# Run Starter plan → inspect output quality
# Must pass: HOT leads, good email copy, no hard claims, QC pass/review
```

### 2. Provider status check
```bash
curl http://localhost:3000/api/provider-status
# Expect: ready_for_ai_test=true, ready_for_paid_beta=false (until Stripe added)
```

### 3. Export check
- CSV must download and open in Excel/Sheets
- Markdown must be readable and well-formatted

### 4. Stripe test mode

#### 4a. Create products in Stripe Dashboard (optional — inline pricing works without this)
```
https://dashboard.stripe.com/test/products
→ Create product "LeadLens Beta Starter" → Add price: $29 USD one-time → copy Price ID (price_...)
→ Create product "LeadLens Beta Standard" → Add price: $97 USD one-time → copy Price ID
→ Create product "LeadLens Beta Pro" → Add price: $197 USD one-time → copy Price ID
```

#### 4b. Configure .env.local with Stripe test keys
```bash
STRIPE_SECRET_KEY=sk_test_...           # from dashboard.stripe.com/test/apikeys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...         # from stripe CLI (step 4c) or dashboard
# Optional — if created in 4a:
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_STANDARD=price_...
STRIPE_PRICE_PRO=price_...
```

#### 4c. Start Stripe webhook forwarding (local)
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook
# Copy the webhook signing secret printed → set as STRIPE_WEBHOOK_SECRET
```

#### 4d. Test checkout flow
```bash
# 1. POST /api/checkout with plan=starter — should return { checkout_url, job_id }
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"plan":"starter","onboarding":{"company_name":"Test Co","company_description":"SaaS platform","offer_description":"CRM tool","value_proposition":"Save time","target_customer_description":"Sales managers","tone":"direct","contact_email":"test@example.com"}}'

# 2. Open checkout_url in browser
# 3. Use test card: 4242 4242 4242 4242 | exp 12/34 | CVC 123
# 4. After payment → redirected to /success?session_id=...&job_id=...
# 5. Cancel → redirected to /cancel?job_id=...
```

#### 4e. Verify webhook delivery
```bash
# In the stripe CLI terminal, confirm:
# ✔ checkout.session.completed → 200 OK
# Check server logs for: [webhook] checkout.session.completed | job_id=...
# GET /api/jobs/{job_id} → should show payment_status: "paid"
```

#### 4f. Confirm provider-status reflects Stripe config
```bash
curl http://localhost:3000/api/provider-status | jq '{
  stripe_key_configured,
  stripe_webhook_configured,
  stripe_prices_configured,
  ready_for_checkout,
  ready_for_paid_beta
}'
# Expect: stripe_key_configured=true, ready_for_checkout=true, ready_for_paid_beta=true
```

#### 4g. Switch to live mode (when ready to take real money)
```
1. Replace sk_test_... → sk_live_... in STRIPE_SECRET_KEY
2. Replace pk_test_... → pk_live_... in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
3. Create new webhook endpoint in Stripe Dashboard → https://yourdomain.com/api/webhook
4. Update STRIPE_WEBHOOK_SECRET with the live webhook signing secret
5. Create live products + prices → update STRIPE_PRICE_* env vars
6. Deploy and test with a real $1 card purchase before going public
```

### 5. Email delivery test (when Resend is configured)
```bash
# RESEND_API_KEY=re_...
# FROM_EMAIL=you@yourdomain.com
# Run pipeline and confirm email received
```

---

## Pricing strategy

### Current model — Beta pay-per-batch (active)

| Plan | Price | Leads | Type |
|------|-------|-------|------|
| Beta Starter | $29 | 10 | One-time batch |
| Beta Standard | $97 | 50 | One-time batch |
| Beta Pro | $197 | 100 | One-time batch |

**Rationale:** Pay-per-batch removes commitment friction for first-time buyers. Customers can evaluate the quality of leads and outreach before deciding on recurring investment.

**Marketing rule:** Do NOT position LeadLens as "permanently subscription-free." The batch model is the entry point, not the ceiling. Copy should always leave the door open: *"Start with one batch. Upgrade to monthly when ready."*

### Future model — Monthly recurring plans (draft, not active)

Introduce after 10–20 confirmed beta customers or when recurring demand is visible.

| Plan | Price | Leads/month | Target |
|------|-------|-------------|--------|
| Growth Starter | $149/mo | 50 | Solo founders, consultants |
| Growth Pro | $299/mo | 150 | Small sales teams, SaaS |
| Agency | $599+/mo | 400+ | Agencies, multi-client, priority review |

> These are **draft prices only** — not active products. Do not build Stripe recurring billing until 10+ paying batch customers confirm they want monthly.

### Transition trigger

Switch to offering monthly plans when:
- ≥10 beta customers have purchased at least one batch
- At least 3 customers ask "can I get this every month?"
- OR monthly demand is visibly high in support/email threads

---

## Permanent constraints (never remove)

- No automated email sending to leads
- No automated LinkedIn messaging
- No aggressive scraping
- No hard outcome claims in outreach ("guaranteed meetings", "X demos per month")
- DEMO_MODE=true must always work with zero external APIs
- No exposing API keys in logs or client-side code
