"use client";
import { useEffect, useState } from "react";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

type Settings = {
  supabase_configured: boolean;
  admin_token_configured: boolean;
  demo_mode: boolean;
  anthropic_configured: boolean;
  lemonsqueezy_webhook_secret_configured: boolean;
  lemonsqueezy_checkout_urls: Record<string, boolean>;
  lemonsqueezy_variants_configured: Record<string, boolean>;
  resend_configured: boolean;
  apollo_configured: boolean;
};

function Check({ ok, label, note, required = true }: { ok: boolean; label: string; note?: string; required?: boolean }) {
  const icon   = ok ? "✓" : required ? "✗" : "–";
  const color  = ok ? "#15803d" : required ? "#dc2626" : "#94a3b8";
  const bgColor = ok ? "#f0fdf4" : required ? "#fef2f2" : "#f8fafc";
  const borderColor = ok ? "#bbf7d0" : required ? "#fecaca" : "#e2e8f0";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", padding: "0.875rem 1rem", background: bgColor, border: `1px solid ${borderColor}`, borderRadius: "0.5rem", marginBottom: "0.5rem" }}>
      <span style={{ color, fontWeight: 800, fontSize: "1rem", lineHeight: 1, minWidth: 16, marginTop: "0.1rem" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{label}</div>
        {note && <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem", lineHeight: 1.4 }}>{note}</div>}
      </div>
      {!ok && required && (
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#dc2626", background: "#fee2e2", borderRadius: 999, padding: "0.15rem 0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Required</span>
      )}
      {!ok && !required && (
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", background: "#f1f5f9", borderRadius: 999, padding: "0.15rem 0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Optional</span>
      )}
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [refreshed, setRefreshed] = useState(false);

  async function load() {
    const res = await adminFetch("/api/admin/settings");
    if (!res.ok) { setError(`Error ${res.status}`); setLoading(false); return; }
    setSettings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function refresh() {
    setLoading(true);
    await load();
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2000);
  }

  const readyCount = !settings ? 0 : [
    settings.supabase_configured,
    settings.admin_token_configured,
    settings.lemonsqueezy_webhook_secret_configured,
    settings.anthropic_configured,
    Object.values(settings.lemonsqueezy_checkout_urls).some(Boolean),
  ].filter(Boolean).length;

  const total = 5;

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Settings</h1>
          <p style={{ color: "#64748b", margin: "0.2rem 0 0", fontSize: "0.875rem" }}>Environment configuration checklist</p>
        </div>
        <button onClick={refresh} disabled={loading}
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.55rem 1.1rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#475569" }}>
          {refreshed ? "Refreshed!" : "Refresh"}
        </button>
      </div>

      {loading && <div style={{ color: "#64748b", padding: "2rem" }}>Loading configuration...</div>}
      {error   && <div style={{ color: "#dc2626", padding: "1rem" }}>{error}</div>}

      {settings && (
        <>
          {/* Score */}
          <div style={{ background: readyCount === total ? "#f0fdf4" : "#fffbeb", border: `1px solid ${readyCount === total ? "#bbf7d0" : "#fde68a"}`, borderRadius: "0.75rem", padding: "1.25rem 1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: readyCount === total ? "#16a34a" : "#d97706", lineHeight: 1 }}>{readyCount}/{total}</div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                {readyCount === total ? "All critical services configured" : "Configuration incomplete"}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                {readyCount === total
                  ? "LeadLens is ready to accept and process orders."
                  : `${total - readyCount} critical service${total - readyCount > 1 ? "s" : ""} still need${total - readyCount === 1 ? "s" : ""} to be configured before orders can be processed.`}
              </div>
            </div>
          </div>

          {/* Core */}
          <Section title="Core services">
            <Check ok={settings.supabase_configured} label="Supabase (database)"
              note="NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — required to persist orders, jobs, and reports." />
            <Check ok={settings.admin_token_configured} label="Admin secret token"
              note="ADMIN_SECRET_TOKEN — required to secure this dashboard in production." />
            <Check ok={!settings.demo_mode} label="Demo mode disabled" required={false}
              note={settings.demo_mode ? "DEMO_MODE=true — pipeline runs in mock mode; no API calls made." : "DEMO_MODE is off — live pipeline is active."} />
          </Section>

          {/* Lemon Squeezy */}
          <Section title="Lemon Squeezy (payments)">
            <Check ok={settings.lemonsqueezy_webhook_secret_configured} label="Webhook secret"
              note="LEMONSQUEEZY_WEBHOOK_SECRET — required to auto-create orders when customers pay." />
            <Check ok={settings.lemonsqueezy_checkout_urls?.sample} label="Sample checkout URL" required={false}
              note="NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL — $7 sample pack link." />
            <Check ok={settings.lemonsqueezy_checkout_urls?.starter} label="Starter checkout URL" required={false}
              note="NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL — $29 starter plan link." />
            <Check ok={settings.lemonsqueezy_checkout_urls?.standard} label="Standard checkout URL" required={false}
              note="NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL — $79 standard plan link." />
            <Check ok={settings.lemonsqueezy_checkout_urls?.pro} label="Pro checkout URL" required={false}
              note="NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL — $149 pro plan link." />
          </Section>

          {/* Lemon Squeezy variant mapping */}
          <Section title="Lemon Squeezy variant IDs (webhook plan detection)">
            {Object.entries(settings.lemonsqueezy_variants_configured ?? {}).map(([plan, ok]) => (
              <Check key={plan} ok={ok as boolean} label={`${plan.charAt(0).toUpperCase() + plan.slice(1)} variant ID`} required={false}
                note={`LEMONSQUEEZY_${plan.toUpperCase()}_VARIANT_ID — maps LS variant to "${plan}" plan when webhook fires.`} />
            ))}
          </Section>

          {/* AI pipeline */}
          <Section title="AI pipeline">
            <Check ok={settings.anthropic_configured} label="Anthropic API key"
              note="ANTHROPIC_API_KEY — required to run the 8-agent lead research pipeline." />
          </Section>

          {/* Optional integrations */}
          <Section title="Optional integrations">
            <Check ok={settings.resend_configured} label="Resend (email)" required={false}
              note="RESEND_API_KEY — not yet used (email delivery is manual). Reserved for future automation." />
            <Check ok={settings.apollo_configured} label="Apollo (lead data)" required={false}
              note="APOLLO_API_KEY — not yet used in this phase. Reserved for Lead Hunter feature." />
          </Section>

          {/* Env reference */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Env variable reference</div>
            <pre style={{ margin: 0, fontSize: "0.75rem", color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" as const, fontFamily: "ui-monospace,monospace" }}>{[
              "# Supabase",
              "NEXT_PUBLIC_SUPABASE_URL=",
              "SUPABASE_SERVICE_ROLE_KEY=",
              "",
              "# Admin",
              "ADMIN_SECRET_TOKEN=",
              "",
              "# Anthropic",
              "ANTHROPIC_API_KEY=",
              "",
              "# Lemon Squeezy",
              "LEMONSQUEEZY_WEBHOOK_SECRET=",
              "NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL=",
              "NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL=",
              "NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL=",
              "NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL=",
              "LEMONSQUEEZY_SAMPLE_VARIANT_ID=",
              "LEMONSQUEEZY_STARTER_VARIANT_ID=",
              "LEMONSQUEEZY_STANDARD_VARIANT_ID=",
              "LEMONSQUEEZY_PRO_VARIANT_ID=",
              "",
              "# Mode",
              "DEMO_MODE=false",
            ].join("\n")}</pre>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
