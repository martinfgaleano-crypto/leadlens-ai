# LeadLens — SaaS Foundation + Vault + Lead Hunter Architecture

> **Status:** Design document only. No code changes. Written 2026-06-19.  
> **Purpose:** Serve as the single source of truth before any implementation begins.  
> A prompt saying "Implement Phase A" should be sufficient to start building without improvising.

---

## Table of Contents

1. [Current Project Audit](#1-current-project-audit)
2. [SaaS Foundation v1 Definition](#2-saas-foundation-v1-definition)
3. [LeadLens Vault Definition](#3-leadlens-vault-definition)
4. [Lead Hunter Definition](#4-lead-hunter-definition)
5. [Supabase Schema](#5-supabase-schema)
6. [API Routes](#6-api-routes)
7. [Admin Dashboard v1](#7-admin-dashboard-v1)
8. [Customer Flow — Future State](#8-customer-flow--future-state)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Risk Analysis](#10-risk-analysis)
11. [Compliance Boundaries](#11-compliance-boundaries)
12. [What NOT to Build Yet](#12-what-not-to-build-yet)
13. [First Implementation Task](#13-first-implementation-task)

---

## 1. Current Project Audit

### 1.1 What already exists

#### Types (`types/index.ts`) — EXCELLENT FOUNDATION
All core domain types are defined and production-ready:
- `PlanType` — `"starter" | "standard" | "pro" | "sample"`
- `LeadStatus` — `"pending" | "processing" | "completed" | "error"`
- `LeadCategory` — `"HOT" | "WARM" | "COLD" | "DISCARD"`
- `QCStatus` — `"APPROVED" | "REVIEW_NEEDED" | "FAILED"`
- `EmailStatus` — `"verified" | "unknown" | "not_found" | "invalid"`
- `LeadSource` — `"mock" | "apollo" | "tavily" | "hunter" | "people_data_labs" | "manual"`
- `OutputLanguage` — `"en" | "es" | "pt" | "ja"`
- `MarketRegion` — `"north_america" | "latin_america" | "europe" | "asia" | "global"`
- Full interface chain: `OnboardingData → ICP → LeadSearchCriteria → LeadCandidate → EnrichedLead → QualifiedLead → OutreachSequence → ProcessedLead → LeadLensReport`
- `BatchJob` with `stripe_session_id`, `payment_status`, `plan`, `onboarding`, `report`

#### Pipeline (`lib/pipeline.ts`) — COMPLETE
8-agent pipeline:
1. ICP Agent — builds Ideal Customer Profile from onboarding data
2. Lead Finder Agent — finds candidates from provider
3. Research Agent — enriches each candidate
4. Qualification Agent — scores against ICP (0–10, with score breakdown)
5. Personalization Agent — generates personalization trigger
6. Outreach Agent — generates email + LinkedIn DM + 2 follow-ups
7. QC Agent — reviews outreach quality
8. Report Agent — builds LeadLensReport with executive summary + patterns

#### Job Store (`lib/storage/job-store.ts`) — FUNCTIONAL
- In-memory store via `globalThis.__leadlens_jobs` Map
- Supabase fallback: `createJob`, `getJob`, `updateJob`, `listRecentJobs`
- Gracefully falls through to in-memory if Supabase not configured
- Only operates on `batch_jobs` table

#### Export (`lib/utils/export.ts`) — COMPLETE
- `exportToCSV()` — 24-column CSV, sorted by fit_score
- `exportToMarkdown()` — full narrative report with outreach sequences

#### Providers (`lib/providers/`) — INTERFACE READY
- `LeadProvider` interface defined (searchLeads, enrichLead?, findEmail?)
- Implementations: `apolloLeadProvider`, `peopleDataLabsProvider`, `tavilyLeadProvider`, `mockLeadProvider`
- `getLeadProvider()` — priority selector: DEMO → Apollo → PDL → Tavily → error
- `getEmailProvider()` — Hunter or provider's own findEmail

#### Supabase (`lib/supabase/`) — CLIENTS EXIST, NOT CONNECTED
- `client.ts` — browser client (uses ANON_KEY)
- `server.ts` — server client (uses SERVICE_ROLE_KEY)
- Both return `null` gracefully if env vars absent
- `supabase-schema.sql` — minimal, only `batch_jobs` table

#### API Routes — PARTIAL
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/checkout` | POST | Working | Stripe only; missing `sample` plan |
| `/api/jobs` | GET, POST | Working | POST missing `sample` plan |
| `/api/jobs/[jobId]` | GET, PATCH | Working | PATCH limited fields |
| `/api/process` | POST | Working | Missing `sample` plan |
| `/api/report` | POST | Working | Export CSV/MD from body |
| `/api/report` | GET | NOT IMPLEMENTED | Returns 501 |
| `/api/webhook` | POST | Stripe only | No Lemon Squeezy webhook |
| `/api/demo` | POST | Working | Full pipeline in demo mode |
| `/api/onboarding` | POST | Exists | Unknown implementation |
| `/api/upload` | POST | Exists | CSV upload flow (legacy) |
| `/api/provider-status` | GET | Working | Blocked in production |
| `/api/og` | GET | Working | OG image, edge runtime |

#### Email (`lib/email/send-report-email.ts`) — EXISTS
- Likely Resend-based but Resend not configured

#### Stripe (`lib/stripe.ts`) — CONFIGURED, NOT USED IN PRODUCTION
- `PLAN_PRICE_DATA` includes `sample` key

### 1.2 Key gaps identified

| Gap | Impact | Priority |
|---|---|---|
| No Lemon Squeezy webhook | Orders not tracked automatically | HIGH — blocks Phase A |
| No `orders` table | No persistent record of purchases separate from jobs | HIGH |
| No `customer_intakes` table | Intake is embedded in onboarding JSONB, not queryable | HIGH |
| No admin dashboard | Manual delivery not possible without SQL queries | HIGH |
| `sample` plan excluded from `/api/checkout`, `/api/jobs`, `/api/process` schemas | Sample Pack can't be processed | MEDIUM |
| `GET /api/report` returns 501 | Can't retrieve stored reports by job ID | MEDIUM |
| No vault tables | Zero commercial memory | Vault Phase |
| No signal tracking | No intelligence accumulation | Vault Phase |
| No deduplication layer | Same lead could be delivered to multiple customers | Vault Phase |
| `supabase-schema.sql` only has `batch_jobs` | Missing all other tables | Phases A + C |
| No admin auth | Admin dashboard would be unprotected | Phase B |

---

## 2. SaaS Foundation v1 Definition

### What it is

SaaS Foundation v1 is the **operational persistence layer** that allows LeadLens to survive a server restart, track every order from payment to delivery, and operate without depending on in-memory state.

It does NOT include customer accounts, login portals, billing management, or full automation.

### What it must enable

| Capability | How |
|---|---|
| Track a payment from Lemon Squeezy | LS webhook → `orders` table |
| Store customer intake brief | `customer_intakes` table, linked to order |
| Create and persist a job | `jobs` table (replaces/extends BatchJob) |
| Store the full pipeline report | `jobs.report` JSONB or separate `reports` table |
| Track job lifecycle | `job_events` table — created, intake_received, pipeline_started, completed, delivered, failed |
| Admin can see all orders | Admin dashboard reads from Supabase |
| Admin can change status | PATCH `/api/admin/jobs/[id]` |
| Admin can add internal notes | `admin_notes` table |
| Export CSV/MD from stored report | GET `/api/report?job_id=xxx&format=csv` |
| Manual delivery (no Resend yet) | Admin downloads file, attaches to Gmail manually |

### What it does NOT include yet

- Customer login or accounts
- Automated email delivery (Resend)
- Billing portal
- Subscription management
- Apollo integration
- Full automation of pipeline trigger on payment
- Customer-facing order tracking page

### Relationship to existing code

The existing `job-store.ts` already implements the in-memory + Supabase fallback pattern. SaaS Foundation v1 extends this pattern to:
1. A proper multi-table Supabase schema
2. A Lemon Squeezy webhook instead of (or alongside) Stripe webhook
3. An admin dashboard that reads from Supabase

---

## 3. LeadLens Vault Definition

### Strategic intent

LeadLens Vault is a **proprietary commercial intelligence database** that accumulates knowledge from every batch run. It transforms LeadLens from a stateless pipeline into a learning system.

The core insight: every lead discovered, scored, and delivered teaches LeadLens something about a market segment. The Vault preserves that knowledge so future batches benefit from past work.

### What the Vault stores

**Companies** — every company encountered in any batch, with industry, size, region, domain, and signals.

**Contacts/Leads** — every lead candidate ever discovered, with source, scores, and lifecycle status.

**Signals** — market signals attached to companies or leads (hiring, fundraising, product launch, etc.).

**Sources** — which provider or URL discovered each lead, with reliability scoring.

**Lead Usage History** — which lead was delivered to which client, in which batch, with which score.

**Batch Leads** — the many-to-many join between batches and leads.

**Suppression List** — leads and companies that should never be delivered (client request, bad data, legal flag).

**Client Reservations** — leads or companies reserved for a specific client for a time window.

### What the Vault answers

| Question | Table |
|---|---|
| Was this lead already delivered? | `lead_usage_history` |
| To which client? When? | `lead_usage_history.order_id`, `lead_usage_history.delivered_at` |
| What score did it get? | `lead_usage_history.fit_score` |
| Where was it found originally? | `contacts.source_id → sources` |
| What signals does it have? | `signals` (JOIN on company_id or contact_id) |
| What region/industry? | `companies.region`, `companies.industry` |
| Is it reserved for someone? | `client_reservations` |
| Should it be avoided? | `suppression_list` |
| What do we know about this company? | `companies` |
| What did past batches look like for this ICP? | `batch_metadata` (future) |

### Vault lifecycle of a lead

```
CANDIDATE → DISCOVERED → SCORED → SELECTED → RESERVED → DELIVERED → LEARNED
                                     ↓
                                  REJECTED (never delivered)
                                     ↓
                                  SUPPRESSED (never again)
```

### Strategic differentiation

Apollo sells a contact database. LeadLens Vault builds a **contextual intelligence layer** on top of any contact source. The same lead in Apollo is anonymous. In LeadLens Vault, it carries:
- Its full score history
- Which ICPs it fit
- Which clients received it
- What signals it had at the time
- Whether the outreach worked (future feedback loop)

This is the moat. Apollo can't replicate it. It's built from every batch LeadLens runs.

---

## 4. Lead Hunter Definition

### What it is

Lead Hunter is LeadLens's own lead discovery system. It finds lead candidates from public, permitted sources — especially in markets where Apollo has weak coverage (Latin America, Southeast Asia, niche verticals, local markets).

Lead Hunter does NOT replace Apollo on day one. It augments it. Over time, as Vault accumulates quality signals, Lead Hunter becomes the primary source.

### Core principle: search for signals, not just contacts

Apollo finds people by title + company + industry. Lead Hunter finds companies by **what they are doing right now** — signals that suggest they are in the market for what a given client sells.

### Signal types (all from public sources)

| Signal Category | Examples |
|---|---|
| Hiring signals | "Hiring SDR", "Hiring AE", "Hiring VP Sales" → in buying mode |
| Funding signals | Series A/B/C → have budget, aggressive growth |
| Product signals | New pricing page, new features page, new product launch |
| Expansion signals | New office announcement, new market entry, new language |
| Conference signals | Speaking at SaaStr, attending industry event |
| Association signals | Member of industry directory, chamber of commerce |
| Partnership signals | New partner announcement → evaluating vendors |
| Founder activity | Founder posting about a specific problem → pain signal |
| Job post patterns | Same role posted 3x → churn or hypergrowth |
| Local directories | Latin American startup registries, local chambers |
| SaaS marketplace listings | G2, Capterra, Product Hunt listings |

### Permitted source types

| Source Type | Method | Compliance |
|---|---|---|
| Public company websites | Read publicly visible content | OK |
| LinkedIn public profiles | Via LinkedIn API or individual manual look-up | OK with ToS constraints |
| Job boards (publicly indexed) | LinkedIn Jobs, Glassdoor, Workable public pages | OK |
| Startup directories | Crunchbase free tier, AngelList public, ProductHunt | OK |
| News aggregators | Tavily, Google News, RSS feeds | OK |
| Association directories | Local chambers, industry associations | OK |
| SaaS marketplaces | G2, Capterra public company profiles | OK |
| Public government business registries | CNPJ (Brazil), RFC (Mexico), etc. | OK |
| Conference speaker lists | Publicly published agendas | OK |

### What Lead Hunter does NOT do

- No automated LinkedIn connection requests or DMs
- No scraping behind paywalls or login walls
- No bypassing CAPTCHAs or bot detection
- No purchasing data from gray-market brokers
- No harvesting emails from raw HTML at scale
- No violating robots.txt where it prohibits crawling

### Lead candidate lifecycle in Lead Hunter

```
SIGNAL DETECTED
     ↓
CANDIDATE CREATED (source, url, confidence, signal_type)
     ↓
ENRICHMENT (company data, contact lookup if public)
     ↓
DEDUPLICATION CHECK (already in Vault?)
     ↓
QUEUE FOR REVIEW
     ↓
ADMIN/AI REVIEW
     ↓
APPROVED → enters Vault as "available"
REJECTED → enters Vault as "rejected" (won't reappear)
```

### Scoring dimensions

| Dimension | What it measures |
|---|---|
| Source confidence | How reliable is this source type? |
| Signal strength | How strong is the buying signal? |
| Data completeness | Do we have name, title, email, company? |
| Freshness | How recent is the signal? |
| ICP match (if ICP available) | Does this fit a known customer profile? |

### Lead Hunter vs Apollo: positioning

| Dimension | Apollo | Lead Hunter |
|---|---|---|
| Coverage | Global, strong US/EU | Builds from scratch, better in LatAm/niche |
| Data type | Contact database | Signal-first discovery |
| Freshness | Depends on their refresh cycle | Real-time signals |
| Context | Name + title + email | Signal + reason + timing |
| Cost | API credits | Own infrastructure cost |
| Learning | Static | Accumulates in Vault |
| Compliance | Their ToS | Our own policies |

---

## 5. Supabase Schema

### Design principles

1. **Server-only access** — all tables use service role key, never anon key from client
2. **RLS disabled** — for now; enabled when customer accounts are added
3. **JSONB for flexibility** — complex objects stored as JSONB; key fields extracted as columns for indexing
4. **UUID everywhere** — all primary keys are UUIDs
5. **Audit trail** — `created_at` and `updated_at` on all tables
6. **Soft deletes** — `deleted_at` preferred over hard deletes for compliance

---

### MUST-HAVE: SaaS Foundation v1

#### Table: `orders`

**Purpose:** Canonical record of every purchase. Created by Lemon Squeezy webhook, not by checkout redirect.

```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ls_order_id     TEXT UNIQUE,           -- Lemon Squeezy order ID
  ls_variant_id   TEXT,                  -- LS product variant (sample/starter/standard/pro)
  plan            TEXT NOT NULL,         -- "sample" | "starter" | "standard" | "pro"
  amount_cents    INT NOT NULL,          -- 700 | 2900 | 7900 | 14900
  currency        TEXT NOT NULL DEFAULT 'USD',
  customer_email  TEXT NOT NULL,
  customer_name   TEXT,
  status          TEXT NOT NULL DEFAULT 'paid',
  -- "paid" | "refunded" | "disputed" | "cancelled"
  intake_status   TEXT NOT NULL DEFAULT 'pending',
  -- "pending" | "received" | "complete"
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  -- "pending" | "in_progress" | "delivered" | "failed"
  ls_raw          JSONB,                 -- full LS webhook payload for reference
  notes           TEXT,                  -- admin free-text
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_customer_email_idx ON orders(customer_email);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_delivery_status_idx ON orders(delivery_status);
CREATE INDEX orders_created_at_idx ON orders(created_at DESC);
```

**Compliance note:** `customer_name` and `customer_email` are PII. Retain only as long as operationally needed. Do not expose in public APIs.

---

#### Table: `customer_intakes`

**Purpose:** The targeting brief submitted by the customer after purchase. Separate from order so it can arrive later.

```sql
CREATE TABLE customer_intakes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  company_name                TEXT NOT NULL,
  company_description         TEXT NOT NULL,
  offer_description           TEXT NOT NULL,
  value_proposition           TEXT NOT NULL,
  target_customer_description TEXT NOT NULL,
  average_ticket              TEXT,
  tone                        TEXT NOT NULL DEFAULT 'direct',  -- "direct" | "consultative" | "casual"
  contact_email               TEXT NOT NULL,
  output_language             TEXT NOT NULL DEFAULT 'en',
  target_market_region        TEXT NOT NULL DEFAULT 'global',
  raw_form                    JSONB,   -- full form submission for reference
  submitted_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customer_intakes_order_id_idx ON customer_intakes(order_id);
```

---

#### Table: `jobs`

**Purpose:** A pipeline execution unit. One order → one job. A job tracks the full lifecycle from intake received to report delivered.

```sql
CREATE TABLE jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  intake_id           UUID REFERENCES customer_intakes(id),
  plan                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  -- "pending" | "awaiting_intake" | "intake_received" | "queued"
  -- | "processing" | "completed" | "error" | "delivered"
  pipeline_mode       TEXT NOT NULL DEFAULT 'demo',
  -- "demo" | "hybrid" | "real"
  lead_count_target   INT NOT NULL,
  lead_count_delivered INT,
  error_message       TEXT,
  icp                 JSONB,          -- output of ICP agent
  report              JSONB,          -- full LeadLensReport
  report_csv_url      TEXT,           -- if stored in Supabase Storage
  report_md_url       TEXT,
  admin_approved      BOOLEAN DEFAULT FALSE,
  approved_at         TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX jobs_order_id_idx ON jobs(order_id);
CREATE INDEX jobs_status_idx ON jobs(status);
CREATE INDEX jobs_created_at_idx ON jobs(created_at DESC);
```

---

#### Table: `job_events`

**Purpose:** Immutable audit trail for every state change in a job's lifecycle.

```sql
CREATE TABLE job_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  -- "created" | "intake_requested" | "intake_received" | "pipeline_started"
  -- | "pipeline_completed" | "admin_review" | "approved" | "delivered"
  -- | "error" | "refunded" | "note_added"
  actor      TEXT NOT NULL DEFAULT 'system',  -- "system" | "admin" | "webhook"
  payload    JSONB,   -- optional event data (error message, note text, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX job_events_job_id_idx ON job_events(job_id);
CREATE INDEX job_events_created_at_idx ON job_events(created_at DESC);
```

---

#### Table: `admin_notes`

**Purpose:** Internal notes visible only to admin. Keeps a thread of comments per order or job.

```sql
CREATE TABLE admin_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID REFERENCES orders(id) ON DELETE CASCADE,
  job_id     UUID REFERENCES jobs(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_notes_order_id_idx ON admin_notes(order_id);
CREATE INDEX admin_notes_job_id_idx ON admin_notes(job_id);
```

---

### MUST-HAVE: Vault v1

#### Table: `companies`

**Purpose:** Master record for every company encountered across all batches and sources.

```sql
CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  domain          TEXT UNIQUE,        -- canonical domain (e.g. "acme.com")
  website_url     TEXT,
  linkedin_url    TEXT,
  industry        TEXT,
  sub_industry    TEXT,
  company_size    TEXT,               -- "1-10" | "11-50" | "51-200" | "201-500" | "500+"
  location_city   TEXT,
  location_country TEXT,
  region          TEXT,               -- MarketRegion enum
  description     TEXT,
  founded_year    INT,
  funding_stage   TEXT,               -- "bootstrapped" | "seed" | "series_a" | etc.
  is_suppressed   BOOLEAN NOT NULL DEFAULT FALSE,
  suppressed_at   TIMESTAMPTZ,
  suppressed_reason TEXT,
  metadata        JSONB,              -- flexible extra fields
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX companies_domain_idx ON companies(domain);
CREATE INDEX companies_industry_idx ON companies(industry);
CREATE INDEX companies_region_idx ON companies(region);
CREATE INDEX companies_is_suppressed_idx ON companies(is_suppressed);
```

---

#### Table: `contacts`

**Purpose:** Master record for every individual lead/contact ever discovered.

```sql
CREATE TABLE contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name        TEXT,
  first_name       TEXT,
  last_name        TEXT,
  title            TEXT,
  seniority        TEXT,              -- "c_level" | "vp" | "director" | "manager" | "individual"
  email            TEXT,
  email_status     TEXT DEFAULT 'unknown',  -- EmailStatus enum
  linkedin_url     TEXT,
  location         TEXT,
  source_id        UUID,              -- references sources table
  source_url       TEXT,
  confidence_score NUMERIC(4,3),     -- 0.000–1.000
  vault_status     TEXT NOT NULL DEFAULT 'candidate',
  -- "candidate" | "reviewed" | "approved" | "reserved" | "delivered" | "rejected" | "suppressed"
  is_suppressed    BOOLEAN NOT NULL DEFAULT FALSE,
  suppressed_at    TIMESTAMPTZ,
  suppressed_reason TEXT,
  raw_context      TEXT,              -- original text from discovery
  metadata         JSONB,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contacts_company_id_idx ON contacts(company_id);
CREATE INDEX contacts_email_idx ON contacts(email);
CREATE INDEX contacts_vault_status_idx ON contacts(vault_status);
CREATE INDEX contacts_is_suppressed_idx ON contacts(is_suppressed);
CREATE UNIQUE INDEX contacts_email_unique_idx ON contacts(email) WHERE email IS NOT NULL;
```

**Compliance note:** `email`, `full_name`, `linkedin_url` are PII under GDPR/CCPA. All are business contact info (B2B exemption applies in most jurisdictions), but must be handled carefully for EU contacts.

---

#### Table: `signals`

**Purpose:** Market signals attached to a company or contact. The intelligence layer that makes LeadLens different from a contact database.

```sql
CREATE TABLE signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL,
  -- "hiring_sdr" | "hiring_ae" | "hiring_vp_sales" | "fundraising"
  -- | "product_launch" | "new_office" | "conference_speaker"
  -- | "partnership" | "expansion" | "founder_post" | "job_post_pattern"
  -- | "association_directory" | "news_mention" | "pricing_page_change"
  signal_strength TEXT NOT NULL DEFAULT 'medium',  -- "weak" | "medium" | "strong"
  title           TEXT,               -- short label
  description     TEXT,               -- what the signal says
  source_url      TEXT,               -- where it was found
  source_type     TEXT,               -- "job_board" | "news" | "linkedin" | "directory" | etc.
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,        -- signals lose relevance over time
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB
);

CREATE INDEX signals_company_id_idx ON signals(company_id);
CREATE INDEX signals_contact_id_idx ON signals(contact_id);
CREATE INDEX signals_signal_type_idx ON signals(signal_type);
CREATE INDEX signals_detected_at_idx ON signals(detected_at DESC);
CREATE INDEX signals_is_active_idx ON signals(is_active);
```

---

#### Table: `sources`

**Purpose:** Registry of all discovery sources with reliability scoring. Enables source-level quality control.

```sql
CREATE TABLE sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,  -- "apollo" | "tavily" | "hunter" | "vault" | "linkedin_public" etc.
  source_type      TEXT NOT NULL,         -- "api" | "web_search" | "directory" | "manual" | "hunter"
  base_url         TEXT,
  description      TEXT,
  reliability_score NUMERIC(3,2),         -- 0.00–1.00, updated from delivery feedback
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Seed data (to insert at setup):
- `apollo` — API, score 0.85
- `people_data_labs` — API, score 0.80
- `tavily` — web_search, score 0.60
- `hunter` — API (email only), score 0.75
- `linkedin_public` — manual/web, score 0.70
- `vault` — internal, score 0.90 (re-used from prior batch)
- `manual` — manual, score 0.95

---

#### Table: `lead_usage_history`

**Purpose:** Every time a contact was delivered to a client. Enables deduplication and fairness.

```sql
CREATE TABLE lead_usage_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  company_id   UUID REFERENCES companies(id) ON DELETE SET NULL,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  fit_score    NUMERIC(4,2),          -- score at time of delivery
  category     TEXT,                  -- HOT | WARM | COLD at time of delivery
  icp_summary  TEXT,                  -- short description of the ICP this was delivered for
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_email TEXT NOT NULL        -- denormalized for quick lookups without joins
);

CREATE INDEX lead_usage_contact_id_idx ON lead_usage_history(contact_id);
CREATE INDEX lead_usage_order_id_idx ON lead_usage_history(order_id);
CREATE INDEX lead_usage_customer_email_idx ON lead_usage_history(customer_email);
CREATE UNIQUE INDEX lead_usage_dedup_idx ON lead_usage_history(contact_id, order_id);
```

---

#### Table: `batch_leads`

**Purpose:** The many-to-many join between jobs and contacts, with per-batch context.

```sql
CREATE TABLE batch_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  position        INT,                -- rank in this batch (1 = best)
  fit_score       NUMERIC(4,2),
  category        TEXT,               -- HOT | WARM | COLD | DISCARD
  qc_status       TEXT,               -- APPROVED | REVIEW_NEEDED | FAILED
  outreach_json   JSONB,              -- OutreachSequence for this specific batch
  enrichment_json JSONB,              -- EnrichedLead snapshot
  is_delivered    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX batch_leads_job_id_idx ON batch_leads(job_id);
CREATE INDEX batch_leads_contact_id_idx ON batch_leads(contact_id);
```

---

#### Table: `suppression_list`

**Purpose:** Contacts and companies that must never be delivered again.

```sql
CREATE TABLE suppression_list (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT,
  domain       TEXT,
  company_name TEXT,
  reason       TEXT NOT NULL,
  -- "client_request" | "legal" | "bad_data" | "duplicate" | "unsubscribe" | "competitor"
  added_by     TEXT NOT NULL DEFAULT 'admin',
  order_id     UUID REFERENCES orders(id),  -- which order triggered this
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX suppression_email_idx ON suppression_list(email);
CREATE INDEX suppression_domain_idx ON suppression_list(domain);
```

---

#### Table: `client_reservations`

**Purpose:** Reserve a set of contacts or companies for a specific client for a time window. Prevents another client from receiving the same lead in the same period.

```sql
CREATE TABLE client_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  contact_id     UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id     UUID REFERENCES companies(id) ON DELETE CASCADE,
  reserved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,  -- typically 90 days
  order_id       UUID REFERENCES orders(id)
);

CREATE INDEX client_reservations_customer_email_idx ON client_reservations(customer_email);
CREATE INDEX client_reservations_contact_id_idx ON client_reservations(contact_id);
CREATE INDEX client_reservations_expires_at_idx ON client_reservations(expires_at);
```

---

### OPTIONAL LATER

#### Table: `users`
Customer accounts with login. Not needed while all delivery is manual.

#### Table: `workspaces`
Multi-user teams. Not needed until B2B accounts are introduced.

#### Table: `subscriptions`
Monthly recurring plans. Not needed until SaaS recurring billing.

#### Table: `provider_logs`
Full request/response logs from Apollo, PDL, etc. Useful for debugging; costly to store.

#### Table: `audit_logs`
Full admin action log. Needed for compliance at scale; overkill for beta.

#### Table: `email_events`
Tracks delivered/opened/clicked emails from Resend. Needed when Resend is connected.

---

## 6. API Routes

### Convention

- All routes are under `/app/api/`
- All write routes require `Content-Type: application/json`
- All admin routes require `x-admin-token` header (matches `ADMIN_SECRET_TOKEN` env var)
- All routes return `{ error: string }` on failure with appropriate HTTP status

---

### SaaS Foundation v1 Routes

#### `POST /api/lemon-webhook`
**Purpose:** Receive Lemon Squeezy `order_created` events. Creates an `orders` row. Triggers intake request email (manual for now).

**Input:** Raw LS webhook payload (verified via `LEMONSQUEEZY_WEBHOOK_SECRET` HMAC-SHA256)

**Output:** `{ received: true }`

**Logic:**
1. Verify HMAC-SHA256 signature from `X-Signature` header
2. Parse `order_created` event
3. Map `ls_variant_id` → `plan` via env var table
4. Insert into `orders`
5. Create a `jobs` row with status `awaiting_intake`
6. Insert `job_events` row: `{ event_type: "created", actor: "webhook" }`
7. Log to console (manual email sent by admin separately)

---

#### `GET /api/admin/orders`
**Purpose:** List all orders for admin dashboard.

**Auth:** `x-admin-token` header

**Query params:** `?status=`, `?delivery_status=`, `?limit=`, `?offset=`

**Output:** `{ orders: Order[], total: number }`

---

#### `GET /api/admin/orders/[id]`
**Purpose:** Full detail for one order — includes intake, job, events, notes.

**Auth:** `x-admin-token`

**Output:** `{ order, intake, job, events, notes }`

---

#### `PATCH /api/admin/orders/[id]`
**Purpose:** Update order status, delivery status, or notes.

**Auth:** `x-admin-token`

**Input:** `{ status?, delivery_status?, notes? }`

**Output:** Updated order row

---

#### `POST /api/admin/intake/[orderId]`
**Purpose:** Admin submits intake on behalf of customer (or intake arrives via form).

**Auth:** `x-admin-token`

**Input:** `OnboardingData`

**Output:** `{ intake_id, job_id }`

**Logic:**
1. Insert `customer_intakes` row
2. Update `orders.intake_status = "received"`
3. Update `jobs.intake_id`, `jobs.status = "intake_received"`
4. Insert `job_events` row: `{ event_type: "intake_received" }`

---

#### `GET /api/admin/jobs`
**Purpose:** List all jobs with status for admin queue view.

**Auth:** `x-admin-token`

**Output:** `{ jobs: Job[], total: number }`

---

#### `GET /api/admin/jobs/[id]`
**Purpose:** Full job detail including report.

**Auth:** `x-admin-token`

---

#### `PATCH /api/admin/jobs/[id]`
**Purpose:** Update job status; mark as approved/delivered.

**Auth:** `x-admin-token`

**Input:** `{ status?, admin_approved?, delivered_at? }`

---

#### `POST /api/admin/jobs/[id]/run`
**Purpose:** Trigger pipeline execution for a specific job.

**Auth:** `x-admin-token`

**Logic:**
1. Fetch job + intake from Supabase
2. Update job status to `processing`
3. Run `runLeadLensPipeline`
4. Store report in `jobs.report`
5. Log `batch_leads` rows for each ProcessedLead
6. Upsert company + contact into Vault tables
7. Mark job `completed`

---

#### `POST /api/admin/notes`
**Purpose:** Add an admin note to an order or job.

**Auth:** `x-admin-token`

**Input:** `{ order_id?, job_id?, body: string }`

---

#### `GET /api/admin/report/[jobId]`
**Purpose:** Return stored report for a job in JSON, CSV, or Markdown.

**Auth:** `x-admin-token`

**Query:** `?format=json|csv|md`

---

### Vault Routes

#### `GET /api/vault/contacts`
**Purpose:** Search Vault contacts for admin/Lead Hunter use.

**Auth:** `x-admin-token`

**Query:** `?industry=`, `?region=`, `?status=`, `?q=` (full-text)

---

#### `GET /api/vault/contacts/[id]`
**Purpose:** Full contact detail including signals and usage history.

**Auth:** `x-admin-token`

---

#### `PATCH /api/vault/contacts/[id]`
**Purpose:** Update vault_status (approve, reject, suppress, reserve).

**Auth:** `x-admin-token`

**Input:** `{ vault_status?, is_suppressed?, suppressed_reason? }`

---

#### `GET /api/vault/companies`
**Purpose:** Search Vault companies.

**Auth:** `x-admin-token`

---

#### `POST /api/vault/signals`
**Purpose:** Manually add a signal to a company or contact.

**Auth:** `x-admin-token`

**Input:** `{ company_id?, contact_id?, signal_type, signal_strength, title, description, source_url }`

---

#### `POST /api/vault/suppression`
**Purpose:** Add email, domain, or company to suppression list.

**Auth:** `x-admin-token`

**Input:** `{ email?, domain?, company_name?, reason, order_id? }`

---

### Lead Hunter Routes (Phase D — design only)

#### `POST /api/lead-hunter/search`
**Purpose:** Initiate a signal-based search for lead candidates.

**Auth:** `x-admin-token`

**Input:** `{ icp: ICP, signals: string[], region: MarketRegion, limit: number }`

**Logic (future):** Queries configured public sources, returns candidates as `contacts` with `vault_status: "candidate"`.

---

#### `GET /api/lead-hunter/queue`
**Purpose:** Return contacts awaiting review in Lead Hunter queue.

**Auth:** `x-admin-token`

---

#### `PATCH /api/lead-hunter/review/[contactId]`
**Purpose:** Admin approves, rejects, or suppresses a Lead Hunter candidate.

**Auth:** `x-admin-token`

**Input:** `{ decision: "approved" | "rejected" | "suppressed", notes? }`

---

## 7. Admin Dashboard v1

### Purpose

A simple, internal-only Next.js page that lets the admin (you) manage orders, run pipelines, review leads, and export reports — without writing SQL queries.

### Temporary protection (pre-auth)

Until a proper login system exists, protect `/admin/*` routes with:

```
Env var: ADMIN_SECRET_TOKEN=<strong_random_string>
```

Two-layer protection:
1. **Middleware** (`middleware.ts`) — checks `x-admin-token` header OR `admin_token` cookie
2. **Vercel password protection** (free tier) — adds HTTP Basic Auth at the edge for all `/admin/*` paths

This is not production-grade auth but is sufficient for a single-admin beta. When ready for team access, replace with NextAuth.js + GitHub OAuth or magic link.

### Pages

#### `/admin` — Dashboard Home
- Summary cards: Total orders, Pending delivery, In progress, Completed
- Recent orders table (last 20)
- Quick links to queue and vault

#### `/admin/orders` — Orders Queue
- Table: Order ID, Plan, Customer email, Intake status, Delivery status, Created at
- Filter by status
- Click row → `/admin/orders/[id]`

#### `/admin/orders/[id]` — Order Detail
- Order metadata (plan, amount, LS order ID)
- Intake form status — "Received" or "Missing (send intake email)"
- Intake data display (if received)
- Job status with progress indicator
- Actions: "Run pipeline", "Mark delivered", "Export CSV", "Export MD"
- Admin notes thread (add note inline)
- Job event timeline

#### `/admin/jobs` — Jobs Queue
- All jobs with status, plan, lead count, created/completed timestamps
- Filter by status
- Actions: Run, Approve, Mark delivered

#### `/admin/vault/contacts` — Vault Contact Browser
- Search by name, company, email, industry, region
- Filter by vault_status
- Table: Name, Title, Company, Score, Status, Signals, Last used
- Click → contact detail with signals + usage history
- Bulk approve/reject/suppress

#### `/admin/vault/companies` — Company Browser
- Search by name, domain, industry, region
- View signals attached to company
- View contacts at company
- Suppress entire company (all contacts suppressed)

### Tech stack for admin dashboard

- Next.js pages under `/app/admin/` — server components where possible
- Supabase server client for all data
- No additional UI library needed — use inline styles consistent with existing `ll-*` pattern
- Admin token checked in middleware before any admin route renders

---

## 8. Customer Flow — Future State

```
1. CUSTOMER PAYS
   └─ Lemon Squeezy checkout at $7/$29/$79/$149
   └─ LS sends webhook to POST /api/lemon-webhook

2. ORDER CREATED (automated)
   └─ orders row: status=paid, delivery_status=pending
   └─ jobs row: status=awaiting_intake
   └─ job_event: created

3. INTAKE REQUESTED (manual, near-term)
   └─ Admin receives email notification from LS
   └─ Admin sends intake email template from Gmail
   └─ Customer replies with targeting brief
   (Future: customer fills form at /intake/[token])

4. INTAKE RECEIVED
   └─ Admin enters intake via /admin/orders/[id]
   └─ customer_intakes row created
   └─ jobs.status = intake_received
   └─ job_event: intake_received

5. PIPELINE QUEUED
   └─ Admin clicks "Run pipeline" in admin dashboard
   └─ POST /api/admin/jobs/[id]/run
   └─ jobs.status = processing
   └─ job_event: pipeline_started

6. PIPELINE RUNS
   └─ ICP Agent → Lead Finder → Research → Qualify → Personalize → Outreach → QC → Report
   └─ In Phase A: still uses existing in-memory pipeline
   └─ In Phase C: Vault check before/after Lead Finder
      ├─ Check suppression list
      ├─ Check already-delivered to same customer
      ├─ Prefer Vault candidates with strong prior scores
      └─ Log new candidates to Vault after run

7. REPORT STORED
   └─ jobs.report = LeadLensReport JSONB
   └─ batch_leads rows created (one per ProcessedLead)
   └─ contacts and companies upserted into Vault
   └─ jobs.status = completed

8. HUMAN REVIEW (admin)
   └─ Admin reviews report in /admin/orders/[id]
   └─ Checks QC_NEEDED leads manually
   └─ Approves: jobs.admin_approved = true
   └─ job_event: approved

9. DELIVERY
   (Near-term manual)
   └─ Admin exports CSV + MD from admin dashboard
   └─ Admin attaches to Gmail delivery email
   └─ Admin marks jobs.status = delivered, orders.delivery_status = delivered
   └─ job_event: delivered

   (Future automated with Resend)
   └─ POST /api/admin/jobs/[id]/deliver
   └─ Resend sends email with CSV + MD attached
   └─ email_events row created

10. LEAD USAGE LOGGED
    └─ lead_usage_history rows created for each delivered contact
    └─ batch_leads.is_delivered = true
    └─ client_reservations rows created (90-day hold)

11. VAULT LEARNS
    └─ Signals from batch stored in signals table
    └─ company/contact vault_status updated
    └─ Future: feedback loop when customer reports meeting booked
```

---

## 9. Implementation Roadmap

### Phase A — SaaS Foundation v1
**What:** Supabase schema + Lemon Squeezy webhook + admin routes + `sample` plan fix

**Scope:**
- Deploy Supabase schema: `orders`, `customer_intakes`, `jobs`, `job_events`, `admin_notes`
- Create `app/api/lemon-webhook/route.ts` — verify LS signature, create order + job
- Create admin API routes: orders CRUD, jobs CRUD, notes, report export
- Fix `sample` plan exclusion in `/api/checkout`, `/api/jobs`, `/api/process`
- Fix `GET /api/report` (501 → reads from `jobs.report` in Supabase)
- Migrate `lib/storage/job-store.ts` to write to `jobs` table instead of `batch_jobs`

**Dependencies:** Supabase project configured, LS webhook secret in env vars

**Complexity:** Medium — additive, no existing routes change behavior

**Success:** First real LS order is automatically recorded in Supabase. Admin can view it.

**Do NOT build:** Admin UI, customer login, Resend, Apollo, Vault tables

---

### Phase B — Admin Dashboard
**What:** `/admin/*` pages protected by env-var token

**Scope:**
- `middleware.ts` — admin token check for `/admin/*`
- `/admin` — home with summary cards
- `/admin/orders` — orders list + filter
- `/admin/orders/[id]` — full detail, intake entry, pipeline trigger, export
- `/admin/jobs` — jobs queue
- POST `/api/admin/jobs/[id]/run` — trigger pipeline
- POST `/api/admin/jobs/[id]/deliver` — mark delivered (manual, no Resend yet)

**Dependencies:** Phase A complete

**Complexity:** Medium — mostly UI over existing API routes

**Success:** Admin can receive an LS order, enter intake, run pipeline, download report, mark delivered — all from the browser. Zero SQL queries needed.

**Do NOT build:** Customer-facing pages, Resend, auth beyond env token

---

### Phase C — Vault v1
**What:** Vault Supabase tables + pipeline writes to Vault + admin Vault browser

**Scope:**
- Deploy Vault schema: `companies`, `contacts`, `signals`, `sources`, `lead_usage_history`, `batch_leads`, `suppression_list`, `client_reservations`
- Modify pipeline post-processing: upsert companies + contacts into Vault after each run
- Add suppression check before Lead Finder (skip suppressed contacts/companies)
- Add deduplication check: don't deliver same contact to same customer twice
- Add `/admin/vault/contacts` and `/admin/vault/companies` browser pages
- Add suppression management from admin UI

**Dependencies:** Phase B complete

**Complexity:** Medium-High — modifies pipeline flow, adds data layer

**Success:** After 3 batches, admin can see which companies appear repeatedly and which leads were already delivered. Vault has real data.

**Do NOT build:** Lead Hunter, automated enrichment loops, scoring algorithms

---

### Phase D — Lead Hunter v1
**What:** Signal-based discovery from public sources via Tavily + manual curation

**Scope:**
- `lib/lead-hunter/signal-detector.ts` — Tavily-based search for signals by type + ICP
- `lib/lead-hunter/signal-types.ts` — signal type definitions, source mappings
- `lib/lead-hunter/deduplication.ts` — check against existing Vault contacts
- Populate `signals` table from discovery runs
- Admin queue for reviewing Lead Hunter candidates
- `/api/lead-hunter/search`, `/api/lead-hunter/queue`, `/api/lead-hunter/review/[id]`
- `/admin/lead-hunter` — candidate review queue

**Dependencies:** Phase C complete (Vault must exist to check against)

**Complexity:** High — new domain, many edge cases

**Success:** For a given ICP, Lead Hunter finds 10+ real candidates with signals that admin can approve in under 10 minutes. Some become approved Vault contacts.

**Compliance gate:** Every source checked against robots.txt. No LinkedIn automated DMs. No paywall bypass.

---

### Phase E — Delivery Automation
**What:** Resend integration for automated report email delivery

**Scope:**
- Connect Resend with `RESEND_API_KEY`
- `lib/email/send-report-email.ts` — send email with CSV + MD as attachments
- `POST /api/admin/jobs/[id]/deliver` triggers Resend instead of manual export
- `email_events` table for delivery tracking

**Dependencies:** Phase B complete

**Complexity:** Low — Resend is straightforward, attachment support is standard

**Success:** Admin clicks "Deliver" and customer receives professional email with attachments within 30 seconds.

---

### Phase F — Customer Dashboard
**What:** Customer-facing order tracking (simple, read-only)

**Scope:**
- Auth via magic link (NextAuth.js + email, no password)
- Customer sees their orders and job status
- Customer can download their report when delivered
- No intake form yet (still email-based) OR simple intake form linked from delivery email

**Dependencies:** Phase E complete, production usage with multiple customers

**Complexity:** High — introduces auth, session management, customer-facing UI

**Do NOT build:** Team sharing, API access, self-serve plan changes

---

### Phase G — Provider Diversification
**What:** Apollo integration + Lead Hunter as primary source for target markets

**Scope:**
- Enable Apollo with proper API key in production
- Evaluate Apollo vs Vault+Lead Hunter quality by region
- Route ICP by region: US/EU → Apollo (strong), LatAm/niche → Lead Hunter + Vault
- Track provider quality in `sources` reliability_score

**Dependencies:** Phase D complete (Lead Hunter must have real data before comparison)

---

## 10. Risk Analysis

### Lead Quality Risks

| Risk | Description | Mitigation |
|---|---|---|
| AI hallucination | Research Agent invents company details or signals | QC Agent + admin review before delivery |
| Stale leads | Contact left company, email bounced | Email verification via Hunter; note "verify before sending" in reports |
| Duplicate leads | Same person delivered to two different clients | `lead_usage_history` dedup + `client_reservations` |
| Outdated signals | "Hiring SDR" signal 6 months old is irrelevant | `signals.expires_at`; never show signals older than 60 days without warning |
| Source unreliability | Tavily returns wrong company | `sources.reliability_score` tracks quality; reduce weight for bad sources |
| Low email verification | Mock data has placeholder emails | In production: Hunter.io verification required before delivery |
| ICP mismatch | Pipeline misinterprets customer's ICP | Admin reviews ICP output before approving pipeline run |

### Operational Risks

| Risk | Description | Mitigation |
|---|---|---|
| Manual review bottleneck | 100-lead Pro batch takes too long to review manually | Stage rollout: start with Sample + Starter; set expectation of 48h SLA |
| Pipeline timeout | 100 leads × 7 agents = possible timeout | Async job queue (Phase A priority), monitor per-lead timing |
| Cost overrun | 100 real leads × Anthropic API = non-trivial cost | Price check before Pro launch; calculate cost per lead vs revenue |
| Intake delay | Customer pays but never sends intake brief | Auto-reminder at 24h and 72h; refund policy at 7 days |
| Customer expectation | Customer expects AE-quality leads | Clear positioning: "qualified candidates + outreach drafts, not confirmed pipeline" |

### Compliance Risks

| Risk | Description | Mitigation |
|---|---|---|
| GDPR B2B data | EU business contact data has nuances | B2B legitimate interest usually applies; document lawful basis; add to privacy policy |
| CCPA California | CA residents' data rights | Honor deletion requests; don't sell data to third parties |
| CAN-SPAM | Outreach drafts must follow rules | Drafts are for human review before sending; we draft, they send |
| LinkedIn ToS | Automated scraping prohibited | Lead Hunter uses Tavily/news, not direct LinkedIn scraping |
| Country-specific laws | Brazil LGPD, Mexico LFPDPPP | Note in compliance docs; region-specific warnings |
| Data retention | How long to keep contact data | Define in privacy policy; Vault contacts: 2 years unless requested deletion |

### Technical Risks

| Risk | Description | Mitigation |
|---|---|---|
| Supabase cold start | First query after idle takes 1-2s | Acceptable for admin use; cache recent job list |
| in-memory store loss | Server restart loses uncompleted jobs | Phase A priority: all jobs must persist to Supabase immediately |
| LS webhook replay | LS retries webhook on failure → duplicate order | Deduplicate on `ls_order_id` UNIQUE constraint |
| Report JSONB size | 100-lead Pro report = large JSONB | Estimate ~2-3MB per 100-lead report; Supabase handles it; monitor |

---

## 11. Compliance Boundaries

### The three things LeadLens never does

1. **Never sends emails on behalf of customers.** All outreach drafts are for human review. The customer sends from their own account. This is not a sending platform.

2. **Never automates LinkedIn messages.** LinkedIn DM drafts are templates for human copy-paste. No automated connection requests, no automated DMs, no LinkedIn API for messaging.

3. **Never uses aggressive scraping.** Lead Hunter queries public APIs and indexed web content. It respects `robots.txt` where it restricts crawling. It never bypasses paywalls, CAPTCHAs, or login walls.

### Data handling rules

- **B2B only** — LeadLens processes business contact data (professional email, job title, company). Personal social media, home addresses, and personal email are never collected.
- **No selling data** — Vault data is never sold or shared with third parties. Each client's delivered leads are theirs alone.
- **Retention policy** — Order PII (customer_email, customer_name): 3 years for accounting. Contact data in Vault: 2 years, or until deletion request.
- **Deletion requests** — Honor within 30 days. Remove from Vault, anonymize in usage history.
- **EU contacts** — Document lawful basis as "legitimate interest (B2B prospecting)" in privacy policy. Honor GDPR right to object.
- **Lead Hunter sources** — All sources documented in `sources` table with `compliance_notes`. Any source that changes ToS to prohibit automated access is deactivated immediately.

### What "human-reviewed delivery" means (legally)

LeadLens's core claim is "human-reviewed." This means:
1. No report is delivered without admin QC review
2. QC-flagged leads (REVIEW_NEEDED) are checked before delivery
3. The admin explicitly approves the batch before it leaves the system

This is the compliance boundary that distinguishes LeadLens from a fully automated bulk scraper.

---

## 12. What NOT to Build Yet

| What | Why not yet |
|---|---|
| Customer login / auth | Zero customers. Auth adds complexity with zero current value. |
| Automated email delivery (Resend) | Manual Gmail delivery works for beta volume. Build when 5+ weekly orders. |
| Apollo integration | Costs money per query. Vault + mock is sufficient for first customers. Connect only when needed. |
| Subscription / monthly billing | One-time batches only. Monthly adds MRR complexity prematurely. |
| Multi-tenant workspaces | Single admin. Teams are months away. |
| Customer-facing order tracking | Customers can email to ask status. Fine for beta. |
| Full Lead Hunter automation | Manual + Tavily first. Automate only after process is proven. |
| Scoring ML model | Rule-based scoring (existing) is sufficient. ML requires training data we don't have yet. |
| Self-serve intake form | Email-based intake is fine for beta. Build form when intake becomes a bottleneck. |
| Billing portal / invoice PDF | Lemon Squeezy sends receipts automatically. |
| Provider comparison analytics | Not enough volume for meaningful comparison. |
| Mobile admin UI | Admin uses desktop. |
| Internationalized admin | Admin is solo. English only is fine. |

---

## 13. First Implementation Task

### Recommendation: Phase A — SaaS Foundation v1, starting with Supabase schema + Lemon Squeezy webhook

**Why this, and not admin dashboard first:**

The admin dashboard has zero value until there is real data in the database to display. The first real LS order will arrive before the dashboard is built. If the schema and webhook don't exist when that order arrives, the payment is captured by LS but nothing is recorded in LeadLens — you'll have to reconstruct the order manually.

The webhook is the single most time-sensitive piece. It must exist before the first real payment.

**Why not "connect Supabase and run" first:**

Supabase is already wired (clients exist, job-store falls back to it). The issue is the schema is incomplete (only `batch_jobs`, missing `orders`, `customer_intakes`, `jobs`, `job_events`). The schema must be deployed before the webhook writes to it.

### Exact first implementation task

**"Implement Phase A — SaaS Foundation v1"**

This means, in order:

1. Deploy new Supabase schema (run SQL in Supabase dashboard or migration):
   - `orders`, `customer_intakes`, `jobs`, `job_events`, `admin_notes`
   - Keep existing `batch_jobs` during transition; migrate/deprecate later

2. Create `app/api/lemon-webhook/route.ts`:
   - Verify LS signature
   - Handle `order_created` event
   - Insert into `orders` and `jobs`

3. Update `lib/storage/job-store.ts`:
   - Write to `jobs` table (new schema) in addition to or instead of `batch_jobs`

4. Fix `sample` plan exclusion:
   - Update Zod schemas in `/api/checkout`, `/api/jobs`, `/api/process` to include `"sample"`

5. Fix `GET /api/report`:
   - Read report from `jobs.report` JSONB by job_id

6. Add `LEMONSQUEEZY_WEBHOOK_SECRET` and `LEMONSQUEEZY_VARIANT_*` mapping to `.env.example`

7. Smoke test: simulate LS webhook payload → verify order + job appear in Supabase

**After Phase A is complete:** The system can receive a real payment, record it permanently, and a human admin can find it. That's the minimum viable operations layer.

---

*Document version: 1.0 — 2026-06-19*  
*Next document: LEADLENS_PHASE_A_IMPLEMENTATION.md (to be created when ready to build)*
