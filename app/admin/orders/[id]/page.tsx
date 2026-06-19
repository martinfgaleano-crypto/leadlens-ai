"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AdminLayout from "../../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Types ────────────────────────────────────────────────────────────────────
type Order = { id: string; external_order_id: string | null; customer_email: string; customer_name: string | null; plan: string; amount_cents: number; currency: string; status: string; intake_status: string; delivery_status: string; checkout_id: string | null; payment_provider: string; notes: string | null; created_at: string; updated_at: string };
type Intake = { id: string; company_name: string; target_industry: string | null; target_geography: string | null; preferred_tone: string; output_language: string; onboarding_data: Record<string, unknown>; website: string | null; target_company_size: string | null; buyer_titles: string[] | null; exclusions: string | null; existing_customer_examples: string | null; notes: string | null; clarity_score: number | null; status: string; created_at: string };
type Job   = { id: string; plan: string; status: string; progress: number; error_message: string | null; admin_approved: boolean; report_id: string | null; started_at: string | null; completed_at: string | null; created_at: string };
type Event = { id: string; event_type: string; message: string | null; created_at: string };
type Note  = { id: string; note: string; created_by: string; created_at: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    paid: { bg: "#dcfce7", color: "#15803d" }, delivered: { bg: "#dcfce7", color: "#15803d" },
    completed: { bg: "#dcfce7", color: "#15803d" }, complete: { bg: "#dcfce7", color: "#15803d" },
    received: { bg: "#dbeafe", color: "#1d4ed8" }, intake_received: { bg: "#dbeafe", color: "#1d4ed8" },
    pending: { bg: "#fef3c7", color: "#92400e" }, awaiting_intake: { bg: "#fef3c7", color: "#92400e" },
    in_progress: { bg: "#e0e7ff", color: "#4338ca" }, processing: { bg: "#e0e7ff", color: "#4338ca" },
    error: { bg: "#fee2e2", color: "#dc2626" }, failed: { bg: "#fee2e2", color: "#dc2626" },
    refunded: { bg: "#f1f5f9", color: "#475569" }, cancelled: { bg: "#f1f5f9", color: "#475569" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return <span style={{ display: "inline-block", background: s.bg, color: s.color, borderRadius: 999, padding: "0.18rem 0.55rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{status.replace(/_/g, " ")}</span>;
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1.25rem" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "1rem", paddingBottom: "0.6rem", borderBottom: "1px solid #f8fafc", marginBottom: "0.6rem" }}>
      <span style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600, minWidth: 140, textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: "0.1rem" }}>{label}</span>
      <span style={{ color: "#0f172a", fontSize: "0.875rem", flex: 1 }}>{value ?? "—"}</span>
    </div>
  );
}

// ─── Intake form ──────────────────────────────────────────────────────────────
const TONES = ["direct", "consultative", "casual"] as const;
const LANGS = ["en", "es", "pt", "ja"] as const;
const REGIONS = ["north_america", "latin_america", "europe", "asia", "global"] as const;

function IntakeForm({ orderId, customerEmail, onSaved }: { orderId: string; customerEmail: string; onSaved: () => void }) {
  const [f, setF] = useState({
    company_name: "", company_description: "", offer_description: "", value_proposition: "",
    target_customer_description: "", average_ticket: "", tone: "direct" as typeof TONES[number],
    output_language: "en" as typeof LANGS[number], target_market_region: "" as string,
    website: "", target_industry: "", target_geography: "", target_company_size: "",
    buyer_titles: "", exclusions: "", existing_customer_examples: "", notes: "",
    clarity_score: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  function field(key: keyof typeof f, label: string, placeholder?: string, multiline = false) {
    return (
      <label key={key} style={{ display: "block", marginBottom: "0.875rem" }}>
        <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>{label}</span>
        {multiline
          ? <textarea value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
              rows={3} style={{ display: "block", width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" as const, outline: "none" }} />
          : <input type="text" value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
              style={{ display: "block", width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", fontFamily: "inherit", boxSizing: "border-box" as const, outline: "none" }} />
        }
      </label>
    );
  }

  async function handleSave() {
    setErr(""); setSaving(true);
    const buyer_titles = f.buyer_titles.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    const payload = {
      order_id: orderId, customer_email: customerEmail,
      company_name: f.company_name, company_description: f.company_description,
      offer_description: f.offer_description, value_proposition: f.value_proposition,
      target_customer_description: f.target_customer_description,
      average_ticket: f.average_ticket || undefined,
      tone: f.tone, output_language: f.output_language,
      target_market_region: f.target_market_region || undefined,
      website: f.website || undefined, target_industry: f.target_industry || undefined,
      target_geography: f.target_geography || undefined, target_company_size: f.target_company_size || undefined,
      buyer_titles: buyer_titles.length ? buyer_titles : undefined,
      exclusions: f.exclusions || undefined, existing_customer_examples: f.existing_customer_examples || undefined,
      notes: f.notes || undefined, clarity_score: f.clarity_score ? Number(f.clarity_score) : undefined,
    };
    const res = await adminFetch("/api/admin/intakes", { method: "POST", body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { onSaved(); }
    else {
      const d = await res.json().catch(() => ({ error: "Unknown error" }));
      setErr(typeof d.error === "string" ? d.error : JSON.stringify(d.error));
    }
  }

  return (
    <div>
      <p style={{ color: "#64748b", fontSize: "0.8rem", margin: "0 0 1.25rem" }}>Fill in customer targeting brief. Fields marked * are required by the pipeline.</p>
      {field("company_name", "Company name *")}
      {field("website", "Website")}
      {field("company_description", "Company description *", "What does the company do?", true)}
      {field("offer_description", "Offer / product being sold *", "What are they selling?", true)}
      {field("value_proposition", "Value proposition *", "Why would buyers care?", true)}
      {field("target_customer_description", "Target customer description *", "Describe the ideal buyer...", true)}
      {field("target_industry", "Target industry")}
      {field("target_geography", "Target geography")}
      {field("target_company_size", "Target company size")}
      {field("buyer_titles", "Buyer titles (comma or newline)", "VP Sales, Head of Growth, CEO...", true)}
      {field("average_ticket", "Average deal size / ticket")}
      {field("exclusions", "Exclusions / do not contact", "", true)}
      {field("existing_customer_examples", "Existing customer examples", "", true)}
      {field("notes", "Internal notes", "", true)}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
        <label>
          <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Tone</span>
          <select value={f.tone} onChange={e => setF(p => ({ ...p, tone: e.target.value as typeof TONES[number] }))}
            style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit" }}>
            {TONES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Language</span>
          <select value={f.output_language} onChange={e => setF(p => ({ ...p, output_language: e.target.value as typeof LANGS[number] }))}
            style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit" }}>
            {LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </label>
        <label>
          <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Region</span>
          <select value={f.target_market_region} onChange={e => setF(p => ({ ...p, target_market_region: e.target.value }))}
            style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit" }}>
            <option value="">Any</option>
            {REGIONS.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label>
          <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Clarity (1–10)</span>
          <input type="number" min={1} max={10} value={f.clarity_score} onChange={e => setF(p => ({ ...p, clarity_score: e.target.value }))}
            style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", fontFamily: "inherit", boxSizing: "border-box" as const }} />
        </label>
      </div>

      {err && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.625rem", color: "#dc2626", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{err}</div>}
      <button onClick={handleSave} disabled={saving}
        style={{ background: saving ? "#7dd3fc" : "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.7rem 1.5rem", fontWeight: 700, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
        {saving ? "Saving intake..." : "Save intake"}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [data, setData]         = useState<{ order: Order; intake: Intake | null; job: Job | null; events: Event[]; notes: Note[] } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [deliveryUpdate, setDeliveryUpdate] = useState("");
  const [saving, setSaving]     = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [runResult, setRunResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [copied, setCopied]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`/api/admin/orders/${id}`);
    if (!res.ok) {
      if (res.status === 404) setError("Order not found");
      else setError(`Error ${res.status}`);
      setLoading(false);
      return;
    }
    const d = await res.json();
    setData(d);
    setStatusUpdate(d.order.status);
    setDeliveryUpdate(d.order.delivery_status);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addNote() {
    if (!noteText.trim() || !data) return;
    setAddingNote(true);
    await adminFetch("/api/admin/notes", {
      method: "POST",
      body: JSON.stringify({ order_id: data.order.id, job_id: data.job?.id, note: noteText.trim() }),
    });
    setNoteText("");
    setAddingNote(false);
    load();
  }

  async function saveStatus() {
    if (!data) return;
    setSaving(true);
    await adminFetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: statusUpdate, delivery_status: deliveryUpdate }),
    });
    setSaving(false);
    load();
  }

  async function runPipeline() {
    if (!data?.job) return;
    if (!confirm("This will consume Anthropic API credits and run the full pipeline. Continue?")) return;
    setRunLoading(true);
    setRunResult(null);
    const res = await adminFetch(`/api/admin/jobs/${data.job.id}/run`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setRunLoading(false);
    setRunResult(res.ok
      ? { ok: true, msg: `Pipeline complete. ${d.total_leads ?? 0} leads generated.` }
      : { ok: false, msg: d.error ?? "Pipeline failed" });
    load();
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 2000); });
  }

  if (loading) return <AdminLayout><div style={{ color: "#64748b", padding: "2rem" }}>Loading order...</div></AdminLayout>;
  if (error)   return <AdminLayout><div style={{ color: "#dc2626", padding: "2rem" }}>{error}</div></AdminLayout>;
  if (!data)   return null;

  const { order, intake, job, events, notes } = data;
  const canRunPipeline = !!intake && !!job && !["processing", "completed", "delivered"].includes(job.status);
  const hasReport = !!job?.report_id;

  const suggestedSubject = `Your LeadLens ${order.plan.charAt(0).toUpperCase() + order.plan.slice(1)} batch is ready`;
  const suggestedBody = `Hi ${order.customer_name ?? "there"},\n\nYour LeadLens ${order.plan} lead batch is ready. Attached you'll find:\n\n• CSV lead file\n• Markdown report with outreach drafts\n\nPlease review and let me know if you'd like any adjustments for your next batch.\n\nBest,\nMartin / LeadLens`;

  return (
    <AdminLayout>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/admin/orders" style={{ color: "#0ea5e9", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>← Back to orders</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem" }}>
          <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Order</h1>
          <StatusBadge status={order.status} />
          <StatusBadge status={order.delivery_status} />
          <span style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{order.id.slice(0, 12)}…</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* LEFT COLUMN */}
        <div>
          {/* Order summary */}
          <Card title="Order summary">
            <Row label="Customer email"  value={order.customer_email} />
            <Row label="Customer name"   value={order.customer_name} />
            <Row label="Plan"            value={<span style={{ textTransform: "capitalize", fontWeight: 700 }}>{order.plan}</span>} />
            <Row label="Amount"          value={<span style={{ color: "#16a34a", fontWeight: 700 }}>${(order.amount_cents / 100).toFixed(2)} {order.currency?.toUpperCase() ?? "USD"}</span>} />
            <Row label="Payment status"  value={<StatusBadge status={order.status} />} />
            <Row label="Intake status"   value={<StatusBadge status={order.intake_status} />} />
            <Row label="Provider"        value={order.payment_provider} />
            <Row label="LS order ID"     value={order.external_order_id} />
            <Row label="Checkout ID"     value={order.checkout_id} />
            <Row label="Created"         value={new Date(order.created_at).toLocaleString()} />
            <Row label="Updated"         value={new Date(order.updated_at).toLocaleString()} />
          </Card>

          {/* Intake */}
          <Card
            title={intake ? "Customer intake" : "Intake — awaiting"}
            action={intake && !showIntakeForm
              ? <button onClick={() => setShowIntakeForm(true)} style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.3rem 0.7rem", fontSize: "0.72rem", cursor: "pointer", color: "#64748b", fontFamily: "inherit" }}>Edit</button>
              : null}
          >
            {intake && !showIntakeForm ? (
              <div>
                <Row label="Company"          value={intake.company_name} />
                <Row label="Website"          value={intake.website} />
                <Row label="Industry"         value={intake.target_industry} />
                <Row label="Geography"        value={intake.target_geography} />
                <Row label="Company size"     value={intake.target_company_size} />
                <Row label="Buyer titles"     value={intake.buyer_titles?.join(", ")} />
                <Row label="Tone"             value={intake.preferred_tone} />
                <Row label="Language"         value={intake.output_language?.toUpperCase()} />
                <Row label="Exclusions"       value={intake.exclusions} />
                <Row label="Clarity score"    value={intake.clarity_score != null ? `${intake.clarity_score}/10` : null} />
                <Row label="Notes"            value={intake.notes} />
                <div style={{ marginTop: "0.75rem", padding: "0.875rem", background: "#f8fafc", borderRadius: "0.5rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.5rem" }}>OnboardingData preview</div>
                  {Object.entries(intake.onboarding_data ?? {}).map(([k, v]) => (
                    <Row key={k} label={k.replace(/_/g, " ")} value={String(v ?? "")} />
                  ))}
                </div>
              </div>
            ) : (!intake || showIntakeForm) ? (
              <IntakeForm
                orderId={order.id}
                customerEmail={order.customer_email}
                onSaved={() => { setShowIntakeForm(false); load(); }}
              />
            ) : null}
          </Card>

          {/* Delivery prep */}
          <Card title="Delivery prep">
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Email subject</div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <code style={{ flex: 1, background: "#f8fafc", padding: "0.5rem 0.75rem", borderRadius: "0.4rem", fontSize: "0.8rem", color: "#0f172a", border: "1px solid #e2e8f0" }}>{suggestedSubject}</code>
                <button onClick={() => copyText(suggestedSubject, "subject")} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.4rem 0.75rem", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>{copied === "subject" ? "Copied!" : "Copy"}</button>
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Email body draft</div>
              <pre style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "0.4rem", fontSize: "0.78rem", whiteSpace: "pre-wrap" as const, margin: 0, border: "1px solid #e2e8f0", color: "#0f172a", lineHeight: 1.6 }}>{suggestedBody}</pre>
              <button onClick={() => copyText(suggestedBody, "body")} style={{ marginTop: "0.4rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.4rem 0.75rem", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>{copied === "body" ? "Copied!" : "Copy email body"}</button>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", padding: "0.75rem", background: "#f0f9ff", borderRadius: "0.5rem", border: "1px solid #bae6fd" }}>
              Send from your Gmail. Attach CSV + Markdown files downloaded from the report section. Do not send on behalf of the customer.
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Job status */}
          <Card title="Job status">
            {!job
              ? <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No job created yet for this order.</div>
              : (
                <div>
                  <Row label="Job ID"    value={<Link href={`/admin/jobs/${job.id}`} style={{ color: "#0ea5e9", fontFamily: "monospace", fontSize: "0.8rem" }}>{job.id.slice(0, 12)}…</Link>} />
                  <Row label="Status"    value={<StatusBadge status={job.status} />} />
                  <Row label="Progress"  value={`${job.progress}%`} />
                  <Row label="Approved"  value={job.admin_approved ? "Yes" : "No"} />
                  <Row label="Started"   value={job.started_at ? new Date(job.started_at).toLocaleString() : null} />
                  <Row label="Completed" value={job.completed_at ? new Date(job.completed_at).toLocaleString() : null} />
                  {job.error_message && (
                    <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.4rem", padding: "0.6rem 0.75rem", fontSize: "0.78rem", color: "#dc2626", marginTop: "0.5rem" }}>
                      {job.error_message}
                    </div>
                  )}
                  <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
                    {!canRunPipeline && !hasReport && (
                      <div style={{ color: "#94a3b8", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
                        {!intake ? "Submit intake before running pipeline." : "Pipeline already completed."}
                      </div>
                    )}
                    <button
                      onClick={runPipeline}
                      disabled={!canRunPipeline || runLoading}
                      style={{ background: canRunPipeline && !runLoading ? "#0ea5e9" : "#e2e8f0", color: canRunPipeline && !runLoading ? "#fff" : "#94a3b8", border: "none", borderRadius: "0.5rem", padding: "0.65rem 1.25rem", fontWeight: 700, fontSize: "0.85rem", cursor: canRunPipeline && !runLoading ? "pointer" : "not-allowed", fontFamily: "inherit", width: "100%" }}>
                      {runLoading ? "Running pipeline..." : "Run pipeline"}
                    </button>
                    {runResult && (
                      <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", background: runResult.ok ? "#dcfce7" : "#fee2e2", borderRadius: "0.4rem", fontSize: "0.8rem", color: runResult.ok ? "#15803d" : "#dc2626" }}>{runResult.msg}</div>
                    )}
                  </div>
                </div>
              )}
          </Card>

          {/* Report */}
          <Card title="Report">
            {!hasReport
              ? <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No report yet. Run the pipeline first.</div>
              : (
                <div>
                  <div style={{ color: "#15803d", fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem" }}>Report ready</div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
                    {[["json", "JSON"], ["csv", "CSV"], ["md", "Markdown"]].map(([fmt, label]) => (
                      <a key={fmt} href={`/api/admin/report/${job?.id}?format=${fmt}`} target="_blank" rel="noopener"
                        style={{ display: "block", padding: "0.6rem 1rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.5rem", color: "#0284c7", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none", textAlign: "center" as const }}>
                        Download {label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
          </Card>

          {/* Status update */}
          <Card title="Update status">
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", marginBottom: "0.3rem" }}>Payment status</label>
              <select value={statusUpdate} onChange={e => setStatusUpdate(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit" }}>
                {["paid", "refunded", "disputed", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", marginBottom: "0.3rem" }}>Delivery status</label>
              <select value={deliveryUpdate} onChange={e => setDeliveryUpdate(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", background: "#fff", fontFamily: "inherit" }}>
                {["pending", "in_progress", "delivered", "failed"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={saveStatus} disabled={saving}
              style={{ background: saving ? "#7dd3fc" : "#0f172a", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1rem", fontWeight: 700, fontSize: "0.8rem", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", width: "100%" }}>
              {saving ? "Saving..." : "Save status"}
            </button>
          </Card>

          {/* Admin notes */}
          <Card title="Internal notes">
            {notes.length === 0
              ? <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: "1rem" }}>No notes yet.</div>
              : notes.map(n => (
                <div key={n.id} style={{ paddingBottom: "0.75rem", marginBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "0.8rem", color: "#0f172a", marginBottom: "0.2rem" }}>{n.note}</div>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{n.created_by} · {new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } }}
                style={{ flex: 1, padding: "0.55rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.8rem", fontFamily: "inherit", outline: "none" }} />
              <button onClick={addNote} disabled={addingNote || !noteText.trim()}
                style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem 0.875rem", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                Add
              </button>
            </div>
          </Card>

          {/* Events timeline */}
          {events.length > 0 && (
            <Card title="Event log">
              <div>
                {events.map((ev, i) => (
                  <div key={ev.id} style={{ display: "flex", gap: "0.75rem", marginBottom: i < events.length - 1 ? "0.75rem" : 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0, marginTop: "0.35rem" }} />
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0f172a" }}>{ev.event_type.replace(/_/g, " ")}</div>
                      {ev.message && <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.1rem" }}>{ev.message}</div>}
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.1rem" }}>{new Date(ev.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
