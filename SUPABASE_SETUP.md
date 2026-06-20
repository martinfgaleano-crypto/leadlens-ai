# LeadLens — Supabase Setup Guide

This guide covers everything needed to connect a real Supabase database to LeadLens.
Once complete, orders, jobs, intakes, reports, and notes will be persisted — and the
Admin Dashboard will show real data instead of empty states.

**Time to complete:** ~15 minutes.

---

## What you need before starting

- A [supabase.com](https://supabase.com) account (free tier is enough)
- Access to your `.env.local` file locally
- The dev server stopped (or you'll restart it after)

---

## Part 1 — Create a Supabase project

1. Go to **[supabase.com](https://supabase.com)** → Log in
2. Click **"New project"**
3. Choose your organization
4. Fill in:
   - **Name:** `leadlens-production` (or `leadlens-dev` for testing)
   - **Database password:** choose a strong password — **save it somewhere safe**, you won't see it again
   - **Region:** US East (closest to your users) or your preferred region
5. Click **"Create new project"**
6. Wait 1–2 minutes for the project to initialize (status will say "Setting up project")

---

## Part 2 — Run the schema migration

1. In Supabase, go to **SQL Editor** (left sidebar → Database → SQL Editor)
2. Click **"New query"**
3. Open this file on your computer:
   ```
   supabase/migrations/001_saas_foundation.sql
   ```
4. Copy the **entire contents** and paste into the SQL Editor
5. Click **"Run"** (or press Ctrl+Enter / Cmd+Enter)
6. You should see: `Success. No rows returned.`

> **If you see an error:** Check the exact error message. Common issues:
> - `relation already exists` — the table already exists; this is safe to ignore if you ran it before
> - `permission denied` — you're not using the service role; make sure you're in the SQL Editor, not a client

### Verify tables were created

After running, go to **Table Editor** (left sidebar) and confirm these 6 tables exist:

| Table | Purpose |
|---|---|
| `orders` | Every purchase (created by Lemon Squeezy webhook) |
| `customer_intakes` | Customer targeting briefs |
| `jobs` | Pipeline execution units |
| `reports` | Completed pipeline output |
| `job_events` | Immutable audit trail |
| `admin_notes` | Internal admin notes |

You should also see `batch_jobs` — that's a legacy table kept for compatibility.

---

## Part 3 — Get your API credentials

1. In Supabase, go to **Project Settings** (gear icon, bottom-left) → **API**
2. Find and copy these two values:

   **Project URL** — looks like:
   ```
   https://xxxxxxxxxxxx.supabase.co
   ```

   **service_role key** — under "Project API keys" → `service_role` → click "Reveal" then copy:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

> ⚠️ **SECURITY WARNING — READ THIS**
> - The `service_role` key has **full database access**. Treat it like a password.
> - **Never** commit it to git
> - **Never** paste it in ChatGPT, Slack, Discord, or any AI tool
> - **Never** put it in a `NEXT_PUBLIC_` variable (that exposes it to the browser)
> - **Never** share screenshots with the key visible
> - If you accidentally expose it: go to Supabase → Settings → API → Rotate keys immediately

---

## Part 4 — Add credentials to `.env.local`

Open `.env.local` in the project root and add/update:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Do **not** add `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the admin dashboard uses the service role
key server-side only and doesn't need the anon key.

---

## Part 5 — Restart the dev server

> **Important:** Always kill the dev server before restarting to avoid stale `.next` cache.

```bash
# In your terminal — stop existing server first
pkill -f "next" || true

# Wait a moment, then:
cd "/Users/martingaleano/Desktop/LeadLens /ai-agent-project"
rm -rf .next
npm run dev
```

The server will start on `http://localhost:3000`.

---

## Part 6 — Verify Supabase is connected

1. Open **`http://localhost:3000/admin/login`**
2. Enter your `ADMIN_SECRET_TOKEN`
3. Go to **`/admin/settings`**
4. You should see:

   ✅ `Supabase database` — **Configured**

   (Previously it showed ✗ Required)

If it still shows as missing, make sure you:
- Saved `.env.local` correctly (no extra spaces, no quotes around the values)
- Restarted the dev server after editing `.env.local`

---

## Part 7 — Supabase also needed in Vercel (production)

When you're ready to deploy with real persistence:

1. Go to **Vercel** → your LeadLens project → **Settings → Environment Variables**
2. Add these two variables (Production scope):
   ```
   NEXT_PUBLIC_SUPABASE_URL    = https://xxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY   = eyJ...
   ```
3. **Redeploy** (Vercel → Deployments → Redeploy latest)

---

---

## Local Persistence Smoke Test

Run this after completing Parts 1–6 above to confirm the full write path works.

### Step 1 — Confirm settings

1. Go to `http://localhost:3000/admin/login` → enter your admin token
2. Go to `/admin/settings`
3. Confirm: `Supabase database → ✅ Configured`
4. Go to `/admin` (Overview)

### Step 2 — Create a fake test order

The admin Overview page has a **"Seed test order"** button (dark, small) visible only in
development when Supabase is configured.

> Location: `/admin` → gray dashed box at the top → **"Seed test order"**

Click it. You should see a green success message like:
```
Created order abc12345… (starter) for test-1234567890@example-dev.com
```

**Alternative (if you prefer curl):**
```bash
curl -X POST http://localhost:3000/api/admin/dev/seed-order \
  -H "x-admin-token: YOUR_ADMIN_SECRET_TOKEN"
```

Expected response:
```json
{
  "ok": true,
  "message": "Dev seed order created.",
  "order_id": "...",
  "job_id": "...",
  "plan": "starter",
  "customer_email": "test-...@example-dev.com"
}
```

### Step 3 — Verify in Admin Dashboard

1. Go to `/admin/orders` → you should see the fake order in the table
2. Click **"View →"** to open the order detail
3. Confirm you can see:
   - Order summary (email, plan, amount)
   - Job section (job ID, status "awaiting_intake")
   - Intake section (empty — click "Save intake" after filling minimal fields)
4. Add an **internal note** in the "Internal notes" card → click "Add"
5. Confirm the note appears

### Step 4 — Verify in Supabase Table Editor

1. Go to Supabase → **Table Editor**
2. Check these tables have rows:

   | Table | What you should see |
   |---|---|
   | `orders` | 1 row with your fake order |
   | `jobs` | 1 row, status `awaiting_intake` |
   | `job_events` | 1 row, event_type `created` |
   | `admin_notes` | 1 row if you added a note |

If all 4 checks pass: **Supabase is fully connected and persisting data.**

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/admin/settings` still shows Supabase missing | `.env.local` not saved or server not restarted | Save `.env.local`, restart dev server |
| Seed order button not visible in `/admin` | Supabase not configured OR in production mode | Verify settings, restart server |
| `Error: Supabase not configured` from seed API | Env vars missing in server process | Restart server after editing `.env.local` |
| `seed-order` returns 404 in production | Correct — this endpoint is intentionally dev-only | Use only in local dev |
| Table not found errors | Migration didn't run | Re-run `001_saas_foundation.sql` in SQL Editor |
| Row Level Security error | RLS should be disabled by migration | Check `DISABLE ROW LEVEL SECURITY` ran for all tables |

---

## What stays manual (by design)

Even after Supabase is connected, these actions remain **manual**:

- **Sending email to customers** — you write the email manually from Gmail
- **LinkedIn outreach** — customers send it themselves after review
- **Running the pipeline** — admin clicks "Run pipeline" in `/admin/jobs/[id]`
- **Delivering the report** — admin attaches CSV + Markdown and sends from Gmail

This is intentional. LeadLens does not automate customer-facing communications.

---

## Summary of required env vars (Supabase only)

```env
# Required for Supabase persistence
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# NOT required for admin dashboard (future customer auth only)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

*Last updated: June 2026*
