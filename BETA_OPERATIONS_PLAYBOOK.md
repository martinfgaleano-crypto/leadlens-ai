# LeadLens AI — Beta Operations Playbook

This document describes the exact steps to go from Lemon Squeezy approval to accepting real
payments and delivering the first batch reports.

> **First customer?** See the complete step-by-step guide: [FIRST_CUSTOMER_OPERATIONS.md](FIRST_CUSTOMER_OPERATIONS.md)  
> It covers: order confirmation, customer intake, pipeline run, QA checklist, delivery templates (EN/ES), refund handling, and order tracking.

---

## PHASE A — Lemon Squeezy activation

### A1. Store approved → Create 4 products

In **app.lemonsqueezy.com → Products → New product**:

| Product name | Price | Type | Leads |
|---|---|---|---|
| LeadLens Beta Sample Pack | $7 USD | One-time | 2 |
| LeadLens Beta Starter | $29 USD | One-time | 10 |
| LeadLens Beta Standard | $79 USD | One-time | 50 |
| LeadLens Beta Pro | $149 USD | One-time | 100 |

Descriptions:
- **Sample Pack**: "2 qualified B2B leads with research, fit scoring and personalized outreach drafts. Human-reviewed. Limited-time beta offer."
- **Starter**: "10 qualified B2B leads with research, fit scoring and personalized outreach sequences. Delivered in 24–48h."
- **Standard**: "50 qualified B2B leads with research, fit scoring and personalized outreach sequences. Delivered in 24–48h."
- **Pro**: "100 qualified B2B leads with research, fit scoring, expanded research notes and personalized outreach sequences. Priority manual review. Delivered in 24–48h."

For each product:
- Payment type: **one-time**
- No trial, no subscription

### A2. Copy checkout links

For each product, go to **Products → [product] → Share** and copy the direct checkout URL.

These links are public and safe — they contain no secret. They are the same URLs you
would share on social media.

### A3. Add checkout links to Vercel

Go to **vercel.com → leadlens-ai project → Settings → Environment Variables** and add:

```
NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL    = https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL   = https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL  = https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL       = https://leadlens.lemonsqueezy.com/checkout/...
```

Set scope: **Production** (and Preview if desired).

### A4. Redeploy

Go to **Vercel → Deployments → Redeploy** (latest production deployment).  
Wait ~60 seconds for build to complete.

### A5. Test each checkout link

Open the live site and click each pricing button:
- Sample Pack callout → should open Lemon Squeezy checkout at $7
- Starter → should open Lemon Squeezy checkout at $29
- Standard → should open Lemon Squeezy checkout at $79
- Pro → should open Lemon Squeezy checkout at $149

Verify the price, currency (USD), and product name are correct.

### A6. Test purchase (if Lemon Squeezy allows)

Complete one test order (refund yourself afterward if needed) to confirm:
- Payment goes through
- You receive a Lemon Squeezy order confirmation email
- Customer lands on `/success` page
- `/success` page shows professional copy (no errors, no dark theme)

---

## PHASE B — First real order

> Full step-by-step detail in [FIRST_CUSTOMER_OPERATIONS.md](FIRST_CUSTOMER_OPERATIONS.md). This section is a quick reference.

When you receive the first order notification from Lemon Squeezy:

### B1. Confirm the order details
- Plan purchased (Sample Pack / Starter / Standard / Pro)
- Customer email and name
- Order ID / reference number
- Log in your order tracking table (see FIRST_CUSTOMER_OPERATIONS.md §11)

### B2. Send intake email within 2 hours

**Do not start the pipeline without the customer's targeting brief.**  
Send the post-payment intake email (EN or ES template in FIRST_CUSTOMER_OPERATIONS.md §5).  
Required fields: company, offer, buyer titles, industry, geography, company size, examples, tone, language.

### B3. Run the pipeline (after receiving complete brief)

Use **hybrid mode** for paying customers:
```bash
DEMO_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
ALLOW_MOCK_LEADS_WITH_REAL_AI=true   # hybrid: mock leads + real AI outreach
```

Run via local form at `http://localhost:3000/demo-pipeline` or via `POST /api/process`.

### B4. QA before delivery

Run the full QA checklist (FIRST_CUSTOMER_OPERATIONS.md §7) — mandatory, no exceptions.

### B5. Export and deliver

- Download CSV (`POST /api/report?format=csv`)
- Download Markdown (`POST /api/report?format=md`)
- Send delivery email from Gmail with both attachments (template in FIRST_CUSTOMER_OPERATIONS.md §5)

### B6. Update your order log

Mark: delivered, date, any notes on output quality, feedback received.

---

## PHASE C — Delivery SLA

- **Target**: 24–48 hours after order confirmation
- **Communicate delays proactively**: if you need more time, email the customer before the 48h mark
- **Refund policy**: see `/refund` — non-delivery, ICP mismatch, or technical failure within 7 days

---

## Operational constraints (permanent)

These rules apply to every order, forever:

- **Do NOT send emails automatically** on behalf of customers — they review and send manually
- **Do NOT automate LinkedIn messaging** for customers
- **Do NOT use aggressive scraping** to source leads
- **Do NOT include hard outcome claims** in outreach copy ("guaranteed meetings", "X demos per month")
- **Do NOT expose API keys** in logs, client code, or emails
- **Keep customer data minimal** — collect only what's needed to run the pipeline
- **Do NOT resell or share** customer business information with third parties

---

## PHASE D — SaaS Foundation Setup (Supabase + Admin API)

This phase enables automatic order tracking and the admin API. Complete after Lemon Squeezy approval.

### D1. Create Supabase project

1. Go to **supabase.com → New project**
2. Choose a region close to your users (US East or EU West)
3. Save the database password somewhere secure

### D2. Run schema migration

1. In Supabase: **SQL Editor → New query**
2. Paste the contents of `supabase/migrations/001_saas_foundation.sql`
3. Click **Run**
4. Verify tables created: orders, customer_intakes, jobs, reports, job_events, admin_notes

### D3. Get credentials

In Supabase: **Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (keep secret, server-only)

### D4. Add to Vercel environment variables

In Vercel: **Settings → Environment Variables** (Production scope):
```
NEXT_PUBLIC_SUPABASE_URL       = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJ...
SUPABASE_SERVICE_ROLE_KEY      = eyJ...
ADMIN_SECRET_TOKEN             = <openssl rand -hex 32>
```

### D5. Configure Lemon Squeezy webhook

In **app.lemonsqueezy.com → Settings → Webhooks → Add webhook**:
- URL: `https://leadlens-ai-xi.vercel.app/api/lemon-webhook`
- Events: check **order_created**
- Copy the signing secret → add to Vercel as `LEMONSQUEEZY_WEBHOOK_SECRET`

Get variant IDs from **Products → [product] → Edit → Variants**:
```
LEMONSQUEEZY_VARIANT_SAMPLE    = <numeric id>
LEMONSQUEEZY_VARIANT_STARTER   = <numeric id>
LEMONSQUEEZY_VARIANT_STANDARD  = <numeric id>
LEMONSQUEEZY_VARIANT_PRO       = <numeric id>
```

### D6. Redeploy and test

1. Vercel → Redeploy (latest production deployment)
2. Test admin API: `curl -H "x-admin-token: YOUR_TOKEN" https://leadlens-ai-xi.vercel.app/api/admin/orders`
3. Simulate a LS webhook (see test payload in FIRST_CUSTOMER_OPERATIONS.md)
4. Verify order appears in Supabase → Table Editor → orders

### D7. Admin API reference

All routes require header: `x-admin-token: YOUR_ADMIN_SECRET_TOKEN`

| Route | Method | Description |
|---|---|---|
| `/api/admin/orders` | GET | List all orders (filterable by status) |
| `/api/admin/orders/[id]` | GET | Order detail + intake + job + notes |
| `/api/admin/orders/[id]` | PATCH | Update status/delivery_status/notes |
| `/api/admin/jobs` | GET | List all jobs (filterable by status) |
| `/api/admin/jobs/[id]` | GET | Job detail + events + report metadata |
| `/api/admin/jobs/[id]` | PATCH | Update status/admin_approved |
| `/api/admin/jobs/[id]/run` | POST | Trigger pipeline for a job |
| `/api/admin/report/[jobId]` | GET | Report in JSON/CSV/MD (?format=csv) |
| `/api/admin/notes` | POST | Add admin note to order or job |
| `/api/admin/notes` | GET | List notes by order_id or job_id |
| `/api/lemon-webhook` | POST | Lemon Squeezy webhook receiver |

---

## PHASE E — Lemon Squeezy API + webhooks (optional, later)

This phase is NOT required to accept payments or deliver reports.  
Enable only when you want automated order confirmation or job queue integration.

When ready:
1. Go to **app.lemonsqueezy.com → Settings → API Keys** → create key → add to Vercel as `LEMONSQUEEZY_API_KEY`
2. Go to **Settings → Webhooks** → create webhook → URL: `https://leadlens-ai-xi.vercel.app/api/lemon-webhook`
3. Copy signing secret → add to Vercel as `LEMONSQUEEZY_WEBHOOK_SECRET`
4. Implement `app/api/lemon-webhook/route.ts` to process `order_created` events
5. Test with a real order

---

## Quick reference: Vercel env vars by phase

| Var | Phase | Required for |
|---|---|---|
| `DEMO_MODE=true` | Now | Public site |
| `NEXT_PUBLIC_APP_URL` | Now | Public site |
| `NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL` | After LS approval | Sample Pack checkout |
| `NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL` | After LS approval | Checkout buttons |
| `NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL` | After LS approval | Checkout buttons |
| `NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL` | After LS approval | Checkout buttons |
| `ANTHROPIC_API_KEY` | When hybrid/real mode | AI pipeline |
| `LEMONSQUEEZY_API_KEY` | Optional later | API/webhook integration |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Optional later | Automated order processing |
| `APOLLO_API_KEY` | Optional later | Real lead sourcing |

---

---

## Analytics

LeadLens does **not** use any third-party analytics by default. No Google Analytics, no Mixpanel, no tracking pixels.

If you want basic page-view data, add **Vercel Analytics** (zero-config, privacy-friendly):
1. Run `npm install @vercel/analytics` in the project root
2. Import and render `<Analytics />` in `app/layout.tsx`:
   ```tsx
   import { Analytics } from "@vercel/analytics/react";
   // inside RootLayout: <body>...{children}<Analytics /></body>
   ```
3. Redeploy to Vercel — data appears in the Vercel dashboard under **Analytics**.

No cookies, no GDPR modal required for Vercel Analytics (aggregated, IP-free).

---

## Key operational documents

| Document | Purpose |
|---|---|
| [FIRST_CUSTOMER_OPERATIONS.md](FIRST_CUSTOMER_OPERATIONS.md) | Complete first-order guide: intake, pipeline, QA, email templates, tracking |
| [BETA_LAUNCH_CHECKLIST.md](BETA_LAUNCH_CHECKLIST.md) | Pre-launch checklist (LS setup, Vercel, test purchase) |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | When connecting real APIs (Supabase, Apollo, Resend) |

---

*Last updated: June 2026*
