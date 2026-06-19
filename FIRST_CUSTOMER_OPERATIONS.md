# LeadLens AI — First Customer Operations Playbook

This document is the operational guide for handling paid beta orders **manually, safely, and professionally** before any automation is in place. Follow it step by step for every order until a webhook-based flow is built.

---

## 1. Objective

Deliver a qualified, human-reviewed lead batch within 24–48 hours of receiving a paid order.  
Every step is manual, every report is reviewed, and nothing is sent to anyone automatically.

---

## 2. What happens when a payment arrives

1. **Lemon Squeezy sends you an email** — "New order from [customer name]" — with order ID, plan, amount, and customer email.
2. **Log the order immediately** (see Section 11 — Beta Order Tracking).
3. **Send the post-payment intake email** (see Section 4 — Email Templates) within 2 hours.
4. **Wait for the customer to reply** with their ICP details.
5. **Run the pipeline** once you have sufficient targeting info (see Section 6).
6. **Review quality** (see Section 7 — QA Checklist).
7. **Export and deliver** the report (see Section 8 and Section 5 — Delivery Email).
8. **Request feedback** and update the order log.

---

## 3. How to confirm a payment in Lemon Squeezy

1. Go to [app.lemonsqueezy.com](https://app.lemonsqueezy.com) → **Orders**.
2. Confirm:
   - Status: **Paid**
   - Product name matches a LeadLens Beta plan (Sample Pack / Starter / Standard / Pro)
   - Amount is correct ($7 / $29 / $79 / $149)
   - Customer email is real and readable
3. Copy and save: **Order ID**, **customer email**, **customer name**, **plan**, **amount paid**, **order date**.
4. If status is **Pending** or **Refunded**, do not start the batch — email the customer to confirm.

---

## 4. Customer Intake Requirements

### 4.1 Required fields

Before starting any pipeline run, you must have clear, specific answers to these:

| Field | Description | Example |
|---|---|---|
| **Customer name** | Contact person's full name | Ana García |
| **Customer email** | Where to deliver the report | ana@empresa.com |
| **Company name** | The customer's company | Contable Digital SAS |
| **Website** | Company URL | contabledigital.com |
| **What they sell** | Product or service, specific | SaaS de nómina para PYMEs colombianas |
| **Target customer type** | Role + company fit | CFO o Director Financiero en empresa con 20–200 empleados |
| **Target industry** | Sector(s) | Manufactura, retail, servicios profesionales |
| **Target geography** | Country/region | Colombia, México, Chile |
| **Target company size** | Revenue or headcount range | 20–200 empleados o $500k–$10M ARR |
| **Buyer titles** | Job titles to target | CFO, Director Financiero, Gerente Administrativo |
| **Exclusions** | What to skip | No competitors, no gov, no solo founders |
| **Existing customer examples** | 2–3 companies they've sold to | Argos, Bancolombia (customers, not prospects) |
| **Preferred tone** | Direct / consultative / casual | Consultative |
| **Output language** | Report + outreach language | es (Spanish) |
| **Any notes** | Edge cases, timing, blacklist | Avoiding any lead from [competitor] |

### 4.2 What to do if the customer gives incomplete information

| Situation | Action |
|---|---|
| Missing geography | Default to country of company HQ — confirm with customer |
| Missing buyer titles | Use common titles for the industry — note assumption in report |
| Vague ICP ("any business owner") | Reply asking for 1–2 examples of best customers + 1 example of a bad customer |
| No existing customer examples | Ask: "Who is your ideal customer? Who have you had success with?" |
| Output language not specified | Default to language of the intake email they wrote in |
| Tone not specified | Default to "consultative" |
| Target company size missing | Ask: "What's the typical headcount or revenue of your best customers?" |

**Rule:** If the ICP is too vague to produce useful leads, ask one round of clarifying questions before running. Do NOT run a pipeline on bad input and then try to fix the output.

### 4.3 ICP clarity score (internal)

Before running, score the ICP from 1–5:

| Score | Meaning | Action |
|---|---|---|
| 5 | Crystal clear — geography, titles, size, industry, examples | Run immediately |
| 4 | Mostly clear — 1 minor gap | Fill assumption, note in report, run |
| 3 | Partial — geography or titles missing | One email to clarify before running |
| 2 | Vague — no concrete examples, too broad | Two targeted questions before running |
| 1 | Unusable | Explain to customer and request rewrite |

---

## 5. How to review if the ICP is ready to run

Checklist before starting the pipeline:

- [ ] Company name and website are real and resolvable
- [ ] Offer is specific (not "we help companies grow")
- [ ] Target customer has defined titles OR a described role
- [ ] At least one industry is named
- [ ] Geography is named (not "global" without further detail)
- [ ] ICP clarity score ≥ 4 (or clarification received)
- [ ] No red flags (targeting restricted categories, unethical sectors, etc.)

---

## 6. How to run the batch

### 6.1 Environment setup

Run locally with the right mode:

```bash
# Hybrid mode (mock leads + real Anthropic AI for outreach)
DEMO_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
ALLOW_MOCK_LEADS_WITH_REAL_AI=true

# Full mock mode (no external APIs needed)
DEMO_MODE=true
```

Use **hybrid mode** for paying customers — it uses real AI for outreach copy while leads are sourced from the curated mock pool.

### 6.2 Running the pipeline

Option A — via the local demo form at `http://localhost:3000/demo-pipeline`:
1. Select the customer's plan (Sample Pack / Starter / Standard / Pro)
2. Fill onboarding form with customer's ICP details
3. Click "Run Demo Pipeline"
4. Let it complete

Option B — via API (advanced):
```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "standard",
    "onboarding": {
      "company_name": "Contable Digital",
      "company_description": "SaaS de nómina para PYMEs",
      "offer_description": "Automatización de nómina y liquidación de personal",
      "value_proposition": "Reduce errores de nómina en 90% y ahorra 8h/mes",
      "target_customer_description": "CFO o Director Financiero de empresa manufacturera 20–200 empleados en Colombia",
      "tone": "consultative",
      "contact_email": "ana@contabledigital.com",
      "output_language": "es",
      "target_market_region": "latin_america"
    }
  }'
```

### 6.3 Export results

After the pipeline completes, from the results page:
- Download **CSV** (for CRM import)
- Download **Markdown** (for the report document)

Or via API:
```bash
# CSV
curl -X POST "http://localhost:3000/api/report?format=csv" \
  -H "Content-Type: application/json" \
  -d '{"report": <paste full report JSON>}' \
  -o leadlens-report.csv

# Markdown
curl -X POST "http://localhost:3000/api/report?format=md" \
  -H "Content-Type: application/json" \
  -d '{"report": <paste full report JSON>}' \
  -o leadlens-report.md
```

---

## 7. How to review quality (QA Checklist)

Run this checklist **before every delivery**. Do not skip.

### Lead quality

- [ ] Each company exists (search Google / LinkedIn)
- [ ] Company fits the target industry
- [ ] Company fits the target geography
- [ ] Contact title matches buyer profile
- [ ] Company size is within stated range
- [ ] No obvious ICP mismatch (wrong sector, wrong size, wrong region)
- [ ] Source confidence score reviewed (flag anything below 0.6)
- [ ] Email status reviewed (flag "invalid" — do not include; flag "unknown" with note)
- [ ] No duplicate company names in the batch
- [ ] No leads from excluded companies/sectors
- [ ] No hallucinated companies (must be verifiable)
- [ ] Lead count matches the plan (2 / 10 / 50 / 100)

### Outreach quality

- [ ] No guaranteed results language ("you'll get 10 meetings", "guaranteed ROI")
- [ ] No false personalization (trigger must be real — verify at least 3 randomly)
- [ ] No false claims about the customer's company
- [ ] No aggressive spam tone
- [ ] First email is usable as-is (no placeholders like [NAME] left unfilled)
- [ ] LinkedIn DM is under 300 characters
- [ ] Follow-up 1 and Follow-up 2 are coherent with the first email
- [ ] All outreach is in the requested output language
- [ ] QC status "REVIEW_NEEDED" leads have been manually reviewed

### Delivery quality

- [ ] CSV opens correctly in Excel/Google Sheets
- [ ] Markdown report is readable and complete
- [ ] Plan lead count in report matches paid plan (Sample=2, Starter=10, Standard=50, Pro=100)
- [ ] Customer name in email is correct
- [ ] Customer email address is the one from the order
- [ ] Delivery email has been reviewed before sending

### If QA fails

| Issue | Action |
|---|---|
| Lead hallucinated | Remove from batch, note in report |
| Outreach has guaranteed claims | Edit manually before delivery |
| Wrong language in outreach | Re-run with explicit `output_language` |
| Lead count below plan | Note reason in report; do not pad with low-quality leads |
| >20% of leads are COLD/DISCARD | Consider re-run with refined ICP |

---

## 8. How to export and prepare delivery

1. **CSV file** — named `leadlens-[plan]-[customer-name]-[date].csv`
2. **Markdown report** — named `leadlens-[plan]-[customer-name]-[date].md`
3. Open both files and read them once more as a final check
4. Prepare the delivery email (see Section 5 templates)
5. Attach both files
6. Send from `martinfgaleano@gmail.com`

---

## 9. How to deliver the report

- Send via Gmail with both files attached
- Subject and body from template (Section 5 below)
- Send within 24–48h of receiving complete ICP details
- If delay is expected, email the customer proactively before the 48h mark
- After sending, update the order log (delivered = ✅, date, any notes)

---

## 10. How to request feedback

Include the feedback ask in the delivery email (see templates).  
Follow up once if no reply after 5 business days:

> "Hi [name], just checking in — did you get a chance to review the report? Any feedback helps me improve the next batch."

Log feedback received in the order tracking table.

---

## 11. How to handle refund requests

Policy is at [leadlens-ai-xi.vercel.app/refund](https://leadlens-ai-xi.vercel.app/refund).

| Scenario | Response |
|---|---|
| Report not delivered within 48h (no delay communicated) | Honor refund immediately |
| ICP mismatch — leads clearly outside target | Offer one free re-run OR refund |
| Technical failure (pipeline error, empty report) | Honor refund immediately |
| Customer changed their mind | Judgment call — if delivery not started, consider honoring |
| Customer unhappy with quality after delivery | Review batch; if justified, offer partial credit or re-run |
| Refund after 7 days | Follow stated policy; case-by-case beyond that |

**Process a refund in Lemon Squeezy:** Orders → [order] → Refund → Select full or partial.

---

## 12. How to handle clients with incomplete information

See Section 4.2. Additional rules:

- **Maximum 2 email rounds** of clarification before asking the customer to resubmit with a complete brief
- **Never run the pipeline** on a score-1 or score-2 ICP — the output will be useless and damage trust
- If customer is unresponsive after 72h, send a reminder:
  > "Hi [name], I haven't received your targeting details yet. I'll hold your order open for 5 more business days. After that I'll need to close or refund — just let me know."
- Log all clarification exchanges in the order notes

---

## 13. How to handle leads of low quality

- **< 60% HOT+WARM leads**: review ICP fit; if the ICP is clear, note in report and consider partial re-run on the weak segment
- **Leads from wrong geography**: remove, note, do not pad
- **Leads with no verifiable email**: flag in CSV as "email: unknown" — customer decides whether to enrich
- **Leads with "REVIEW_NEEDED" QC status**: manually review outreach; edit or exclude before delivery
- **Never inflate the batch** with irrelevant leads to hit the plan count — quality over quantity

---

## 14. How to record beta learnings

After each delivery, write 3 bullets in the log:

1. **What worked** — ICP elements that produced good leads
2. **What didn't** — segments, industries, or geographies that produced weak output
3. **One improvement** — a tweak to the prompt, ICP intake, or QA process

Use these notes to improve the intake form and pipeline prompts over time.

---

## 5 (continued) — Email Templates

### POST-PAYMENT INTAKE EMAIL

**Subject (EN):** Your LeadLens order is confirmed — quick targeting brief needed
**Subject (ES):** Tu pedido en LeadLens está confirmado — necesito tu brief de targeting

---

**English version:**

```
Subject: Your LeadLens order is confirmed — quick targeting brief needed

Hi [Customer Name],

Thank you for your LeadLens [Sample Pack / Starter / Standard / Pro] order.

To prepare your batch of [10 / 50 / 100] qualified leads, I need a brief targeting
summary from you. This takes about 5–10 minutes and makes a huge difference in quality.

Please reply with the following:

1. Company name and website
2. What you sell (be specific — product/service, for whom, at what price point)
3. Your target buyer title(s) (e.g. "VP of Sales", "CFO", "Founder")
4. Target industry or sector
5. Target geography (country or region)
6. Target company size (headcount or revenue range)
7. 2–3 examples of existing customers or ideal prospects
8. Any companies or sectors to exclude
9. Preferred tone: Direct / Consultative / Casual
10. Preferred report language: English / Spanish / Portuguese / Japanese

Once I receive your brief, I'll start your batch and deliver within 24–48 hours.

A couple of things to know:
- Your report is prepared manually and reviewed before delivery
- Nothing is sent automatically on your behalf — all outreach sequences are drafts for you to review and send yourself
- You'll receive a CSV + Markdown report with full lead profiles and outreach sequences

Looking forward to working with you.

Martin
LeadLens AI
martinfgaleano@gmail.com
```

---

**Spanish version:**

```
Asunto: Tu pedido en LeadLens está confirmado — necesito tu brief de targeting

Hola [Nombre del cliente],

Gracias por tu pedido de LeadLens [Sample Pack / Starter / Standard / Pro].

Para preparar tu batch de [10 / 50 / 100] leads calificados, necesito un breve resumen
de tu targeting. Toma 5–10 minutos y hace una diferencia enorme en la calidad del resultado.

Por favor responde con lo siguiente:

1. Nombre y sitio web de tu empresa
2. Qué vendes (sé específico/a — producto/servicio, para quién, a qué precio)
3. Títulos del comprador objetivo (ej. "VP de Ventas", "CFO", "Fundador")
4. Industria o sector objetivo
5. Geografía objetivo (país o región)
6. Tamaño de empresa objetivo (número de empleados o rango de ingresos)
7. 2–3 ejemplos de clientes actuales o prospectos ideales
8. Empresas o sectores a excluir
9. Tono preferido: Directo / Consultivo / Casual
10. Idioma del reporte: Inglés / Español / Portugués / Japonés

Una vez que reciba tu brief, comenzaré tu batch y lo entregaré en 24–48 horas.

Algunas cosas importantes:
- Tu reporte es preparado manualmente y revisado antes de entregarlo
- Nada se envía automáticamente en tu nombre — las secuencias de outreach son borradores para que tú revises y envíes cuando estés listo/a
- Recibirás un CSV + reporte en Markdown con perfiles completos de leads y secuencias de outreach

Quedo pendiente.

Martín
LeadLens AI
martinfgaleano@gmail.com
```

---

### REPORT DELIVERY EMAIL

**Subject (EN):** Your LeadLens report is ready — [N] leads inside
**Subject (ES):** Tu reporte de LeadLens está listo — [N] leads adentro

---

**English version:**

```
Subject: Your LeadLens report is ready — [N] leads inside

Hi [Customer Name],

Your LeadLens [Sample Pack / Starter / Standard / Pro] batch is ready. Find attached:

📎 leadlens-[plan]-[date].csv     — for CRM import or direct use
📎 leadlens-[plan]-[date].md      — full report with executive summary

Batch summary:
- Plan: [Sample Pack / Starter / Standard / Pro]
- Total leads: [N]
- HOT leads (score 8–10): [N]
- WARM leads (score 6–7): [N]
- Output language: [EN / ES / PT / JA]

How to use it:
1. Open the CSV — each row is one lead with full contact info, score, and outreach sequences
2. Sort by "Fit Score" or "Category" to find your best prospects first
3. Review the outreach drafts — edit to match your voice before sending
4. Nothing goes out automatically — you control every send

Important: all outreach sequences are drafts for your review. Do not send without reading them first.

If anything looks off or you have questions, reply to this email.

One small ask: if you have 2 minutes, I'd love to hear your feedback:
- Were the leads a good fit for your ICP?
- Were the outreach sequences useful?
- What could be better?

This is a founding beta, and your feedback directly shapes the product.

Thank you for being an early customer.

Martin
LeadLens AI
martinfgaleano@gmail.com
```

---

**Spanish version:**

```
Asunto: Tu reporte de LeadLens está listo — [N] leads adentro

Hola [Nombre del cliente],

Tu batch de LeadLens [Sample Pack / Starter / Standard / Pro] está listo. Adjunto encontrarás:

📎 leadlens-[plan]-[fecha].csv    — para importar a CRM o usar directamente
📎 leadlens-[plan]-[fecha].md     — reporte completo con resumen ejecutivo

Resumen del batch:
- Plan: [Sample Pack / Starter / Standard / Pro]
- Leads totales: [N]
- HOT leads (score 8–10): [N]
- WARM leads (score 6–7): [N]
- Idioma del output: [ES / EN / PT / JA]

Cómo usarlo:
1. Abre el CSV — cada fila es un lead con información de contacto, score y secuencias de outreach
2. Ordena por "Fit Score" o "Category" para encontrar tus mejores prospectos primero
3. Revisa los borradores de outreach — edítalos para que suenen con tu voz antes de enviar
4. Nada se envía automáticamente — tú controlas cada envío

Importante: todas las secuencias de outreach son borradores para tu revisión. No las envíes sin leerlas primero.

Si algo no se ve bien o tienes preguntas, responde este email.

Un pequeño favor: si tienes 2 minutos, me encantaría escuchar tu feedback:
- ¿Los leads eran un buen fit para tu ICP?
- ¿Las secuencias de outreach fueron útiles?
- ¿Qué podría mejorar?

Esto es una beta fundacional, y tu feedback impacta directamente el producto.

Gracias por ser un cliente temprano.

Martín
LeadLens AI
martinfgaleano@gmail.com
```

---

## 11 (continued) — Beta Order Tracking

Keep this table in a private spreadsheet (Google Sheets or Notion). Update it after every action.

| # | Order date | Customer | Email | Plan | Amount paid | ICP received | Batch started | Batch delivered | Status | Feedback | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 001 | YYYY-MM-DD | Name | email | Sample/Starter/Standard/Pro | $7/$29/$79/$149 | ✅/❌ | YYYY-MM-DD | YYYY-MM-DD | pending/running/delivered/refunded | yes/no/partial | — |

**Status values:**
- `awaiting_icp` — payment received, waiting for customer brief
- `icp_clarification` — asked for more info, waiting for reply
- `running` — pipeline in progress
- `qa_review` — QA in progress
- `delivered` — report sent
- `refunded` — order refunded
- `closed_no_response` — customer never replied (>5 business days)

---

## Operational Rules (permanent, no exceptions)

- **Do NOT send emails automatically** on behalf of customers
- **Do NOT automate LinkedIn** messages on behalf of customers
- **Do NOT use aggressive or non-consensual scraping** to source leads
- **Do NOT include guaranteed outcome claims** in outreach ("guaranteed meetings", "X demos")
- **Do NOT expose API keys** in logs, emails, or client-facing content
- **Do NOT share customer data** with third parties
- **Do NOT deliver a batch that hasn't passed QA**
- **Do NOT run the pipeline on a vague ICP** (score < 3) without clarification

---

## Quick reference: tools used for each step

| Step | Tool |
|---|---|
| Confirm payment | Lemon Squeezy dashboard → Orders |
| Log order | Google Sheets / Notion |
| Send intake email | Gmail (manual) |
| Run pipeline | Local dev `npm run dev` + form, or `curl` to `/api/process` |
| Export CSV | Results page download, or `POST /api/report?format=csv` |
| Export Markdown | Results page download, or `POST /api/report?format=md` |
| Deliver report | Gmail with attachments (manual) |
| Process refund | Lemon Squeezy dashboard → Orders → Refund |

---

*See also: [BETA_OPERATIONS_PLAYBOOK.md](BETA_OPERATIONS_PLAYBOOK.md)*  
*Last updated: June 2026*
