# LeadLens AI — Setup Guide

## Quick start (DEMO_MODE — zero API keys)

```bash
npm install
npm run dev
```
Open: http://localhost:3000/demo-pipeline

---

## Step-by-step

### 1. Install Node.js (if not installed)

Go to **https://nodejs.org** → click the green **LTS** button → install the .pkg file.
Then come back here.

### 2. Confirm env file

`.env.local` ships with `DEMO_MODE=true` — no edits needed for local testing.
If it doesn't exist: `cp .env.example .env.local`

### 3. Install dependencies

```bash
npm install
```

### 4. Start dev server

```bash
npm run dev
```

### 5. Open the demo pipeline

```
http://localhost:3000/demo-pipeline
```

### 6. Run the pipeline

1. Select a plan (Starter / Standard / Pro)
2. Edit the pre-filled form with your real offer
3. Click "Run pipeline"
4. Watch 7-agent animation (~5 seconds)
5. Review leads: HOT / WARM / COLD / DISCARD
6. Expand any card for full outreach sequence
7. Download CSV or Markdown

---

## What's mocked in DEMO_MODE

| Component              | DEMO_MODE               | Production                       |
|------------------------|-------------------------|----------------------------------|
| ICP Analyzer           | Deterministic from form | Claude claude-sonnet-4-6                  |
| Lead Finder            | 40-lead mock pool       | Apollo / PDL / Tavily            |
| Research Agent         | Pre-built enrichment    | Claude + Tavily web search       |
| Qualification          | Rule-based scoring      | Claude claude-sonnet-4-6                  |
| Personalization        | Template triggers       | Claude claude-sonnet-4-6                  |
| Outreach Copy          | Template fills          | Claude claude-sonnet-4-6                  |
| QC Agent               | Category-based rules    | Claude claude-sonnet-4-6                  |
| Report Agent           | Deterministic summary   | Claude claude-sonnet-4-6 analysis         |
| Payment                | Skipped                 | Stripe Checkout                  |
| Job persistence        | None (in-memory)        | Supabase PostgreSQL              |

---

## Connecting real APIs (production mode)

Edit `.env.local`:

```bash
DEMO_MODE=false

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Lead providers (at least one required)
APOLLO_API_KEY=            # Best for structured people search
PEOPLE_DATA_LABS_API_KEY=  # Large enrichment database
TAVILY_API_KEY=            # Web search (less structured, useful for research)
HUNTER_API_KEY=            # Email finding + verification

# Payments
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...    # $29
STRIPE_PRICE_STANDARD=price_...   # $97
STRIPE_PRICE_PRO=price_...        # $197

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Then restart: `npm run dev`

---

## Production checklist

### To accept real payments ($29/$97/$197)
- [ ] Create Stripe account + 3 products (Starter / Standard / Pro)
- [ ] Set STRIPE_* keys in .env
- [ ] Wire Stripe Checkout to onboarding flow
- [ ] Set up Stripe webhook → /api/webhook
- [ ] Test with Stripe test cards

### To persist jobs (Supabase)
- [ ] Create Supabase project
- [ ] Run `supabase-schema.sql` in SQL editor
- [ ] Set SUPABASE_* keys in .env
- [ ] Implement job creation in /api/onboarding
- [ ] Implement job status polling in /api/report

### To find real leads (providers)
- [ ] Choose provider: Apollo (recommended) or PDL
- [ ] Get API key (free tier available on both)
- [ ] Set APOLLO_API_KEY or PEOPLE_DATA_LABS_API_KEY
- [ ] Set HUNTER_API_KEY for email verification
- [ ] Set DEMO_MODE=false
- [ ] Test with 1 real run (Starter = 10 leads)

### To use Claude for AI agents
- [ ] Get Anthropic API key at console.anthropic.com
- [ ] Set ANTHROPIC_API_KEY
- [ ] Budget: ~$0.10–0.30 per Starter run (10 leads)
- [ ] Budget: ~$0.50–1.50 per Standard run (50 leads)
- [ ] Budget: ~$1–3 per Pro run (100 leads)

### To deploy on Vercel
```bash
npm install -g vercel
vercel --prod
```
Add all .env variables in Vercel → Settings → Environment Variables.

---

## How to test providers locally

```bash
# Test Apollo (10 leads, mock plan)
curl -X POST http://localhost:3000/api/demo \
  -H "Content-Type: application/json" \
  -d '{"plan":"starter","onboarding":{"company_name":"Test","company_description":"B2B SaaS","offer_description":"Pipeline gen service","value_proposition":"20 meetings/month","target_customer_description":"SaaS founders","tone":"direct","contact_email":"test@test.com"}}'
```

---

## Project structure

```
app/
  page.tsx                  — Landing page
  demo-pipeline/page.tsx    — Demo UI (form → pipeline → results)
  results/[jobId]/page.tsx  — Production results page (polls Supabase)
  api/
    demo/route.ts           — POST /api/demo (always works in DEMO_MODE)
    process/route.ts        — POST /api/process (main pipeline endpoint)
    report/route.ts         — GET|POST /api/report (export CSV/MD)
    webhook/route.ts        — POST /api/webhook (Stripe)

lib/
  pipeline.ts               — Main orchestrator (all 8 agents)
  anthropic.ts              — Claude API client
  agents/
    icp-agent.ts            — ICP + LeadSearchCriteria builder
    lead-finder-agent.ts    — Calls provider to find candidates
    research-agent.ts       — Enriches each lead with context
    qualification-agent.ts  — Scores + categorizes (HOT/WARM/COLD/DISCARD)
    personalization-agent.ts — Writes trigger sentence
    outreach-agent.ts       — Writes email, DM, follow-ups
    qc-agent.ts             — Quality control pass
    report-agent.ts         — Builds final LeadLensReport
  providers/
    lead-provider.ts        — Interface (LeadProvider)
    mock-lead-provider.ts   — 40 realistic mock leads (DEMO_MODE)
    apollo-lead-provider.ts — Apollo.io integration (TODO: test with key)
    people-data-labs-provider.ts — PDL integration (TODO: test with key)
    tavily-lead-provider.ts — Tavily web search integration
    hunter-provider.ts      — Hunter email finding/verification
    provider-selector.ts    — Picks best available provider
  utils/
    export.ts               — CSV + Markdown export
  supabase/
    client.ts               — Browser Supabase client
    server.ts               — Server Supabase client (service role)

types/index.ts              — All TypeScript types
static-demo/index.html      — Standalone demo (no Node needed)
```

---

## Stack

| Layer      | Tool                                  |
|------------|---------------------------------------|
| Frontend   | Next.js 14 (App Router) + Tailwind CSS |
| Language   | TypeScript                            |
| AI         | Anthropic Claude claude-sonnet-4-6 (production) |
| Lead DB    | Apollo / PDL / Tavily / Hunter        |
| Database   | Supabase PostgreSQL (production)      |
| Payments   | Stripe Checkout (production)          |
| Deploy     | Vercel                                |
