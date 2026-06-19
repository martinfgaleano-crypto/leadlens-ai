"use client";
import { useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

type Settings = {
  supabase_configured: boolean;
  admin_token_configured: boolean;
  dev_bypass_active: boolean;
  demo_mode: boolean;
  anthropic_configured: boolean;
  lemonsqueezy_webhook_secret_configured: boolean;
  lemonsqueezy_checkout_urls: Record<string, boolean>;
  lemonsqueezy_variants_configured: Record<string, boolean>;
  resend_configured: boolean;
  apollo_configured: boolean;
  pdl_configured: boolean;
  hunter_configured: boolean;
  tavily_configured: boolean;
};

function Check({
  ok,
  label,
  envVar,
  note,
  required = true,
}: {
  ok: boolean;
  label: string;
  envVar?: string;
  note?: string;
  required?: boolean;
}) {
  const bgColor    = ok ? "#f0fdf4" : required ? "#fef2f2" : "#f8fafc";
  const borderColor = ok ? "#bbf7d0" : required ? "#fecaca" : "#e2e8f0";
  const iconColor  = ok ? "#15803d" : required ? "#dc2626" : "#94a3b8";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", padding: "0.875rem 1rem", background: bgColor, border: `1px solid ${borderColor}`, borderRadius: "0.5rem", marginBottom: "0.5rem" }}>
      <span style={{ color: iconColor, fontWeight: 800, fontSize: "1rem", lineHeight: 1, minWidth: 16, marginTop: "0.1rem" }}>
        {ok ? "✓" : required ? "✗" : "–"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{label}</div>
        {envVar && (
          <code style={{ display: "inline-block", marginTop: "0.2rem", fontSize: "0.72rem", color: "#475569", background: "rgba(0,0,0,0.05)", padding: "0.1rem 0.4rem", borderRadius: "0.25rem", fontFamily: "ui-monospace,monospace" }}>
            {envVar}
          </code>
        )}
        {note && <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem", lineHeight: 1.45 }}>{note}</div>}
      </div>
      <span style={{
        fontSize: "0.68rem", fontWeight: 700, borderRadius: 999, padding: "0.15rem 0.6rem",
        textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
        color: ok ? "#15803d" : required ? "#dc2626" : "#64748b",
        background: ok ? "#dcfce7" : required ? "#fee2e2" : "#f1f5f9",
      }}>
        {ok ? "Configured" : required ? "Required" : "Optional"}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1.25rem" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{title}</div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );
}

const SETUP_STEPS = [
  { n: 1, title: "Create Supabase project", detail: "Go to supabase.com → New project. Copy NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Project Settings → API." },
  { n: 2, title: "Run migration SQL", detail: "In Supabase SQL editor, run the contents of supabase/migrations/001_saas_foundation.sql to create all tables." },
  { n: 3, title: "Add Supabase env vars to Vercel", detail: "Vercel dashboard → Settings → Environment Variables. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
  { n: 4, title: "Add ADMIN_SECRET_TOKEN to Vercel", detail: "Generate a strong random token (e.g. openssl rand -hex 32). Add as ADMIN_SECRET_TOKEN in Vercel env vars. Also add to .env.local for local use, then restart the dev server." },
  { n: 5, title: "Configure Lemon Squeezy webhook", detail: "After LS store approval: Settings → Webhooks → Add webhook. URL: https://your-domain.com/api/lemon-webhook. Copy the signing secret to LEMONSQUEEZY_WEBHOOK_SECRET." },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [refreshed, setRefreshed] = useState(false);

  async function load() {
    setError("");
    const res = await adminFetch("/api/admin/settings");
    if (!res.ok) {
      setError(`Settings unavailable (${res.status}) — check server logs.`);
      setLoading(false);
      return;
    }
    setSettings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function refresh() {
    setLoading(true);
    await load();
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2500);
  }

  const criticalItems = settings ? [
    settings.admin_token_configured,
    settings.supabase_configured,
    settings.lemonsqueezy_webhook_secret_configured,
    settings.anthropic_configured,
    Object.values(settings.lemonsqueezy_checkout_urls ?? {}).some(Boolean),
  ] : [];
  const readyCount = criticalItems.filter(Boolean).length;
  const total = criticalItems.length || 5;

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Settings</h1>
          <p style={{ color: "#64748b", margin: "0.2rem 0 0", fontSize: "0.875rem" }}>Environment configuration checklist — no secrets are shown here.</p>
        </div>
        <button onClick={refresh} disabled={loading}
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.55rem 1.1rem", fontSize: "0.8rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", color: "#475569" }}>
          {refreshed ? "Refreshed!" : loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1rem", fontSize: "0.85rem", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {settings?.dev_bypass_active && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: 700, color: "#713f12", fontSize: "0.8rem", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dev bypass active</div>
          <div style={{ color: "#713f12", fontSize: "0.8rem", lineHeight: 1.5 }}>
            Admin routes are currently open without token verification. Add <code style={{ background: "rgba(0,0,0,0.08)", padding: "0.1rem 0.3rem", borderRadius: "0.25rem", fontFamily: "monospace" }}>ADMIN_SECRET_TOKEN</code> to <code style={{ background: "rgba(0,0,0,0.08)", padding: "0.1rem 0.3rem", borderRadius: "0.25rem", fontFamily: "monospace" }}>.env.local</code> and restart the dev server to enable authentication.
          </div>
        </div>
      )}

      {settings && (
        <>
          {/* Ready score */}
          <div style={{ background: readyCount === total ? "#f0fdf4" : "#fffbeb", border: `1px solid ${readyCount === total ? "#bbf7d0" : "#fde68a"}`, borderRadius: "0.75rem", padding: "1.25rem 1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div style={{ fontSize: "2.25rem", fontWeight: 800, color: readyCount === total ? "#16a34a" : "#d97706", lineHeight: 1, minWidth: 56 }}>{readyCount}/{total}</div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                {readyCount === total ? "All critical services configured" : "Configuration incomplete"}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                {readyCount === total
                  ? "LeadLens is ready to accept and process live orders."
                  : `${total - readyCount} critical service${total - readyCount !== 1 ? "s" : ""} still missing. See setup steps below.`}
              </div>
            </div>
          </div>

          {/* Core */}
          <Section title="Core services (required for production)">
            <Check
              ok={settings.admin_token_configured}
              label="Admin secret token"
              envVar="ADMIN_SECRET_TOKEN"
              note={settings.admin_token_configured
                ? "Dashboard is protected by token authentication."
                : "Set a strong random token. Add to .env.local, restart dev server. Add to Vercel env vars for production."}
            />
            <Check
              ok={settings.supabase_configured}
              label="Supabase database"
              envVar="NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
              note={settings.supabase_configured
                ? "Database is connected via service role."
                : "Create a Supabase project and run the migration SQL. Required to persist orders, jobs, and reports."}
            />
            <Check
              ok={!settings.demo_mode}
              label="Demo mode disabled"
              envVar="DEMO_MODE"
              required={false}
              note={settings.demo_mode
                ? "DEMO_MODE=true — pipeline runs in mock mode, no real API calls are made."
                : "DEMO_MODE is off — live pipeline is active."}
            />
          </Section>

          {/* Lemon Squeezy */}
          <Section title="Lemon Squeezy (payments — required for automated order creation)">
            <Check
              ok={settings.lemonsqueezy_webhook_secret_configured}
              label="Webhook signing secret"
              envVar="LEMONSQUEEZY_WEBHOOK_SECRET"
              note={settings.lemonsqueezy_webhook_secret_configured
                ? "Orders will be auto-created on payment."
                : "Required to auto-create orders when customers pay. Configure after LS store approval."}
            />
            <Check ok={settings.lemonsqueezy_checkout_urls?.sample}   label="Sample checkout URL ($7)"    envVar="NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL"   required={false} />
            <Check ok={settings.lemonsqueezy_checkout_urls?.starter}  label="Starter checkout URL ($29)"  envVar="NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL"  required={false} />
            <Check ok={settings.lemonsqueezy_checkout_urls?.standard} label="Standard checkout URL ($79)" envVar="NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL" required={false} />
            <Check ok={settings.lemonsqueezy_checkout_urls?.pro}      label="Pro checkout URL ($149)"     envVar="NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL"      required={false} />
          </Section>

          {/* LS variant IDs */}
          <Section title="Lemon Squeezy variant IDs (maps webhook to plan)">
            <p style={{ color: "#64748b", fontSize: "0.78rem", margin: "0 0 0.875rem", lineHeight: 1.5 }}>
              Each LS product variant ID must map to a plan so the webhook knows which plan was purchased.
              Find these in Lemon Squeezy → Products → [product] → Variants.
            </p>
            {Object.entries(settings.lemonsqueezy_variants_configured ?? {}).map(([plan, ok]) => (
              <Check
                key={plan}
                ok={ok as boolean}
                label={`${plan.charAt(0).toUpperCase() + plan.slice(1)} variant ID`}
                envVar={`LEMONSQUEEZY_VARIANT_${plan.toUpperCase()}`}
                required={false}
                note={`Maps LS variant to "${plan}" plan in webhook handler.`}
              />
            ))}
          </Section>

          {/* AI pipeline */}
          <Section title="AI pipeline">
            <Check
              ok={settings.anthropic_configured}
              label="Anthropic API key"
              envVar="ANTHROPIC_API_KEY"
              note={settings.anthropic_configured
                ? "8-agent pipeline can run using Claude."
                : "Required to run the 8-agent lead research pipeline. Get at console.anthropic.com."}
            />
          </Section>

          {/* Optional integrations */}
          <Section title="Optional integrations (future features)">
            <Check ok={settings.resend_configured}  label="Resend (transactional email)"   envVar="RESEND_API_KEY"           required={false} note="Reserved for future automated email delivery. Not yet used — delivery is manual." />
            <Check ok={settings.apollo_configured}  label="Apollo (B2B contacts)"           envVar="APOLLO_API_KEY"           required={false} note="Reserved for Lead Hunter feature. Not yet active." />
            <Check ok={settings.pdl_configured}     label="People Data Labs (enrichment)"   envVar="PEOPLE_DATA_LABS_API_KEY" required={false} note="Reserved for lead enrichment. Not yet active." />
            <Check ok={settings.hunter_configured}  label="Hunter.io (email verification)"  envVar="HUNTER_API_KEY"           required={false} note="Reserved for email verification. Not yet active." />
            <Check ok={settings.tavily_configured}  label="Tavily (web research)"           envVar="TAVILY_API_KEY"           required={false} note="Reserved for web research fallback in pipeline. Not yet active." />
          </Section>

          {/* Next setup steps */}
          <Section title="Next setup steps">
            <div>
              {SETUP_STEPS.map(step => (
                <div key={step.n} style={{ display: "flex", gap: "1rem", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0ea5e9", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.8rem", flexShrink: 0 }}>{step.n}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a", marginBottom: "0.2rem" }}>{step.title}</div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Env variable reference */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Full .env.local reference</div>
            <pre style={{ margin: 0, fontSize: "0.75rem", color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" as const, fontFamily: "ui-monospace,monospace" }}>{[
              "# Admin (server-only)",
              "ADMIN_SECRET_TOKEN=your-strong-random-token",
              "",
              "# Supabase",
              "NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co",
              "SUPABASE_SERVICE_ROLE_KEY=service_role_key_here",
              "",
              "# AI pipeline",
              "ANTHROPIC_API_KEY=sk-ant-...",
              "",
              "# Lemon Squeezy",
              "LEMONSQUEEZY_WEBHOOK_SECRET=lmsqzy_...",
              "NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL=https://your-store.lemonsqueezy.com/checkout/...",
              "NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL=https://your-store.lemonsqueezy.com/checkout/...",
              "NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL=https://your-store.lemonsqueezy.com/checkout/...",
              "NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL=https://your-store.lemonsqueezy.com/checkout/...",
              "LEMONSQUEEZY_VARIANT_SAMPLE=123456",
              "LEMONSQUEEZY_VARIANT_STARTER=123457",
              "LEMONSQUEEZY_VARIANT_STANDARD=123458",
              "LEMONSQUEEZY_VARIANT_PRO=123459",
              "",
              "# Mode",
              "DEMO_MODE=false",
              "",
              "# Optional — future features",
              "RESEND_API_KEY=re_...",
              "APOLLO_API_KEY=",
              "PEOPLE_DATA_LABS_API_KEY=",
              "HUNTER_API_KEY=",
              "TAVILY_API_KEY=",
            ].join("\n")}</pre>
            <p style={{ margin: "0.875rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
              Never commit .env.local to git. Never expose ADMIN_SECRET_TOKEN, service role keys, or API keys to the browser.
            </p>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
