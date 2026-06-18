# LeadLens AI — Beta Operations Playbook

This document describes the exact steps to go from Lemon Squeezy approval to accepting real
payments and delivering the first batch reports.

> **First customer?** See the complete step-by-step guide: [FIRST_CUSTOMER_OPERATIONS.md](FIRST_CUSTOMER_OPERATIONS.md)  
> It covers: order confirmation, customer intake, pipeline run, QA checklist, delivery templates (EN/ES), refund handling, and order tracking.

---

## PHASE A — Lemon Squeezy activation

### A1. Store approved → Create 3 products

In **app.lemonsqueezy.com → Products → New product**:

| Product name | Price | Type |
|---|---|---|
| LeadLens Beta Starter | $29 USD | One-time |
| LeadLens Beta Standard | $79 USD | One-time |
| LeadLens Beta Pro | $149 USD | One-time |

For each product:
- Payment type: **one-time**
- No trial, no subscription
- Description: brief mention of lead count and delivery time (e.g. "10 qualified B2B leads + personalized outreach sequences. Delivered in 24–48h.")

### A2. Copy checkout links

For each product, go to **Products → [product] → Share** and copy the direct checkout URL.

These links are public and safe — they contain no secret. They are the same URLs you
would share on social media.

### A3. Add checkout links to Vercel

Go to **vercel.com → leadlens-ai project → Settings → Environment Variables** and add:

```
NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL   = https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL  = https://leadlens.lemonsqueezy.com/checkout/...
NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL       = https://leadlens.lemonsqueezy.com/checkout/...
```

Set scope: **Production** (and Preview if desired).

### A4. Redeploy

Go to **Vercel → Deployments → Redeploy** (latest production deployment).  
Wait ~60 seconds for build to complete.

### A5. Test each checkout link

Open the live site and click each pricing card button:
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
- Plan purchased (Starter / Standard / Pro)
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

## PHASE D — Lemon Squeezy API + webhooks (optional, later)

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
| `NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL` | After LS approval | Checkout buttons |
| `NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL` | After LS approval | Checkout buttons |
| `NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL` | After LS approval | Checkout buttons |
| `ANTHROPIC_API_KEY` | When hybrid/real mode | AI pipeline |
| `LEMONSQUEEZY_API_KEY` | Optional later | API/webhook integration |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Optional later | Automated order processing |
| `APOLLO_API_KEY` | Optional later | Real lead sourcing |

---

---

## Key operational documents

| Document | Purpose |
|---|---|
| [FIRST_CUSTOMER_OPERATIONS.md](FIRST_CUSTOMER_OPERATIONS.md) | Complete first-order guide: intake, pipeline, QA, email templates, tracking |
| [BETA_LAUNCH_CHECKLIST.md](BETA_LAUNCH_CHECKLIST.md) | Pre-launch checklist (LS setup, Vercel, test purchase) |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | When connecting real APIs (Supabase, Apollo, Resend) |

---

*Last updated: June 2026*
