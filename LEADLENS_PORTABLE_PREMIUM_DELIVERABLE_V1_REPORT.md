# LeadLens — Portable Premium Deliverable (V1)

Adds a **second distribution surface**: a portable, self-contained, premium HTML artifact a
customer opens by double-click — no login, no server, no account, works offline. The
authenticated workspace is preserved unchanged. Both are powered by the same normalized
`DeliverableViewModel`. Initial HEAD `4a36f79`.

## Architecture

```
report snapshot → assembleInstitutionalReport (server, authorized)
              → DeliverableViewModel (curated; adapters: institutional / Amor pilot)
              → A. Workspace  (/results/[jobId]/brief — authenticated, persistent)
              → B. Portable   (renderPortableHtml — static .html, no login/server)
```

Same intelligence, two surfaces. No business logic duplicated: the portable renderer consumes
the exact same view model the workspace does.

## Portable generator

- **`lib/deliverable/portable/portable-payload.ts`** — sanitizers (`esc`, `safeUrl` [http/https
  only], `jsonForScript` [neutralizes `</script>`, `<`, `>`, `&`, U+2028/9]), `safeFilename`,
  a **forbidden-marker secret scanner**, and a whitelist helper.
- **`lib/deliverable/portable/render-portable.ts`** — `renderPortableHtml(vm): string`. One
  self-contained `.html`: inline CSS (system fonts, no webfont/CDN), inline vanilla JS (no
  React/eval/network), **all five panels pre-rendered** as escaped HTML, and a tiny embedded
  JSON payload holding only the two CSV exports. Panels: Portfolio · Account Briefs · Compare ·
  Evidence · How to read.
- **`scripts/deliverable/generate-portable.ts`** (`npm run deliverable:generate -- --fixture
  amor|alt`) — loads the view model, renders HTML, **secret-scans before writing** (aborts on
  any hit), and writes to `output/deliverables/<slug>/<date>/`: HTML + Portfolio CSV +
  Evidence CSV + an internal `manifest.json` (never delivered). Job-based generation is
  documented as server-side (needs authorized snapshot + ownership; not run in this CLI).

## Security (embedded-data whitelist)

The artifact is a static export: anything inside is readable by the recipient, so only curated,
customer-safe data crosses in. **Embedded:** headline/summary, decision states, per-account
thesis/why/what-changed/evidence-summary/sources(label,url,date,age,relation,claim)/counter-
signals/limitations/validations/decision/next-step, commercial context, validation queue,
coverage counts, the two CSV strings + filenames. **Never embedded:** raw `report_json`,
`processed_leads`, `feature_snapshot`, provider/admin metadata, LLM-judge/calibration outputs,
Supabase ids, service-role, API keys, tokens. Verified by a build-time secret scan **and** a
test-time scan (portable test 14–15). Injection is escaped (test 18–19); `javascript:`/`data:`
URLs are dropped (test 20, 22); source `<a>` links are the only external navigation.

## No-friction / offline guarantees (verified)

- **No login / no Supabase / no API / no CDN / no webfont** — 0 external `<script>`/`<link>`;
  measured live via `file://`: `document.querySelectorAll('script[src]')` = [] and
  `link[href]` = []. Interface works fully offline; only source links need internet.
- **file:// portability** — opened the real Amor artifact from the project dir AND after
  **copying it to a different directory** (`/tmp/.../scratchpad`): tabs switch, account
  switching shows exactly one brief, compare toggles — all functional.
- **JS-disabled fallback** — the Portfolio panel is not hidden by default, so the opening
  summary is readable without JS (test 10).
- **Point-in-time** — a static-note footer ("reflects the evidence available at the time of
  generation"); no "live dashboard" framing.

## Real Amor de Gea artifact (generated)

`output/deliverables/amor-de-gea/2026-08-03/`
- `LeadLens_Opportunity_Portfolio_Amor_de_Gea_2026-08-03.html` — **92.8 KB**, 10 accounts, ES
- `LeadLens_Portfolio_Amor_de_Gea_2026-08-03.csv` — 5.1 KB
- `LeadLens_Evidence_Amor_de_Gea_2026-08-03.csv` — 2.0 KB
- `manifest.json` (internal)

Amor pilot data was **not modified** (read-only). No bespoke Amor code. Second fixture
(`--fixture alt`, 6 EU accounts, Premium) also generated to prove genericity.

## QA

- **Desktop (1280) + mobile (390/375):** premium render; page horizontal overflow **0**; compare
  matrix scrolls inside its card; tabs scroll on mobile; download buttons stack; ≥44px targets.
- **Interactivity (live file://):** tab switch, account switch (one brief shown), compare
  column toggle, all working with zero network.
- **PDF:** the portable HTML carries deliberate `@media print` styles (all panels revealed,
  chrome hidden, page-break rules) + a "Print / Save as PDF" button — the customer saves a
  clean LeadLens PDF from the file. No auto-generated `.pdf` is produced by the CLI (honest: no
  headless print engine here); the print path is the documented export step.
- **Tests:** `test:portable` **25/25** (self-contained, no-CDN, no-eval, secret scan, injection
  escaping, URL sanitization, Unicode ES+JP, all panels, embedded-CSV parity). Regressions all
  green: `test:deliverable` 52/52, `test:v7-landing-guards` 78/78, `test:commercial-continuity`
  17/17. `tsc` clean. `npm run build` clean.

## Tier support
One generator, capability-gated (`ReportExperience`): Preview shows a smaller safe subset;
Brief/Intelligence/Premium reveal more depth. Amor renders under its pilot label. No entitlement
logic changed.

## Files
`lib/deliverable/portable/{portable-payload,render-portable}.ts`,
`scripts/deliverable/generate-portable.ts`, `scripts/fixtures/portable-deliverable.test.ts`,
`package.json`, generated `output/deliverables/**`, this report. **Workspace, adapters, view
model, landing — unchanged.**

## Limitations / remaining
- **P0:** none.
- **P1:** headless PDF generation in the pipeline (currently print-to-PDF from the HTML); a ZIP
  bundle of the package; job-based server generation wired to a real authorized snapshot.
- **P2:** hash-based deep links inside the file; per-client branding; Safari/Edge file:// matrix
  beyond the primary Chromium check.

**NOT PUSHED** (GitHub Desktop) — founder handoff for deploy/delivery.
