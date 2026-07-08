"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../_components/AdminLayout";
import { adminFetch } from "@/lib/admin/admin-client";

// ─── Beta Readiness (internal) ────────────────────────────────────────────────
// One page answering: is LeadLens ready to receive a beta customer?
// Critical config comes live from system-health; product/business/operational
// items are manual checklists persisted in localStorage (works without
// Supabase). Booleans only — never secret values.

type EnvHealth = {
  supabase_url_set: boolean;
  supabase_anon_key_set: boolean;
  supabase_service_role_set: boolean;
  admin_secret_set: boolean;
  internal_run_secret_set: boolean;
  cron_secret_set: boolean;
  app_url_set: boolean;
  demo_mode: boolean;
  production_safe: boolean;
  missing_for_production: string[];
};

type Health = {
  env_health?: EnvHealth;
  ls_secret_set?: boolean;
  ls_variants_configured?: boolean;
  apollo_key_set?: boolean;
  supabase_reachable?: boolean;
};

const MANUAL_KEY = "leadlens_beta_readiness_manual";

const PRODUCT_CHECKS: { label: string; href: string }[] = [
  { label: "Landing reachable", href: "/demo-pipeline" },
  { label: "Signup reachable", href: "/signup" },
  { label: "Login reachable", href: "/login" },
  { label: "Dashboard route", href: "/dashboard" },
  { label: "Report page route", href: "/results/example" },
  { label: "Admin monitor ops", href: "/admin/monitor-runs" },
  { label: "Vault Foundation (internal)", href: "/admin/vault-foundation" },
];

const BUSINESS_ITEMS = [
  "Legal pages present (privacy/terms)",
  "Refund page present",
  "Support/contact email present on landing",
  "Pricing current on landing",
  "Apollo disabled / licensed-only (see Critical config)",
  "No automatic email sending claimed anywhere",
  "No LinkedIn automation claimed anywhere",
  "No guaranteed meetings/revenue claimed anywhere",
];

const OPERATIONAL_ITEMS = [
  "Supabase migrations 001–029 applied",
  "Manual QA steps 1–55 completed (BETA_SMOKE_QA.md)",
  "First customer playbook reviewed (BETA_OPERATIONS_PLAYBOOK.md)",
  "Test order created end-to-end",
  "Test monitor run completed (baseline + comparison)",
  "Test report downloaded (CSV + Markdown)",
  "Test feedback saved and visible in admin",
];

function CheckRow({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", padding: "0.45rem 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ fontSize: "0.85rem", width: 20, flexShrink: 0 }}>{ok === null ? "…" : ok ? "✅" : "❌"}</span>
      <div>
        <div style={{ fontSize: "0.82rem", color: "#0f172a", fontWeight: 600 }}>{label}</div>
        {detail && <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{detail}</div>}
      </div>
    </div>
  );
}

export default function BetaReadinessPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [manual, setManual] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/system-health");
      if (res.ok) setHealth(await res.json().catch(() => null));
      else setHealth({});
    })();
    try {
      const raw = localStorage.getItem(MANUAL_KEY);
      if (raw) setManual(JSON.parse(raw));
    } catch { /* fresh state */ }
  }, []);

  function toggle(item: string) {
    setManual(prev => {
      const next = { ...prev, [item]: !prev[item] };
      try { localStorage.setItem(MANUAL_KEY, JSON.stringify(next)); } catch { /* no persistence */ }
      return next;
    });
  }

  const eh = health?.env_health ?? null;
  const criticalReady = !!eh?.production_safe;
  const manualTotal = BUSINESS_ITEMS.length + OPERATIONAL_ITEMS.length;
  const manualDone = [...BUSINESS_ITEMS, ...OPERATIONAL_ITEMS].filter(i => manual[i]).length;

  const sectionStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1.1rem 1.25rem", marginBottom: "1.25rem" };
  const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: "0.6rem" };

  return (
    <AdminLayout>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ color: "#0f172a", fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Beta Readiness</h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
          One answer to: can we put a real beta customer on this deploy?
        </p>
      </div>

      {/* Verdict banner */}
      <div style={{ marginBottom: "1.25rem", padding: "0.85rem 1.1rem", borderRadius: "0.6rem", fontWeight: 700, fontSize: "0.9rem",
        background: criticalReady && manualDone === manualTotal ? "#f0fdf4" : "#fef3c7",
        border: `1px solid ${criticalReady && manualDone === manualTotal ? "#bbf7d0" : "#fde68a"}`,
        color: criticalReady && manualDone === manualTotal ? "#15803d" : "#92400e" }}>
        {criticalReady && manualDone === manualTotal
          ? "READY — critical config complete and all manual checks marked done."
          : `NOT READY — ${criticalReady ? "" : "critical config incomplete. "}Manual checks: ${manualDone}/${manualTotal} done.`}
      </div>

      {/* Critical configuration (live) */}
      <div style={sectionStyle}>
        <div style={titleStyle}>Critical configuration (live)</div>
        <CheckRow ok={eh ? eh.supabase_url_set && eh.supabase_service_role_set : null} label="Supabase configured" detail="URL + service role" />
        <CheckRow ok={eh?.supabase_anon_key_set ?? null} label="Supabase anon key (customer auth)" />
        <CheckRow ok={eh?.admin_secret_set ?? null} label="ADMIN_SECRET_TOKEN" />
        <CheckRow ok={eh?.internal_run_secret_set ?? null} label="INTERNAL_RUN_SECRET (processor)" />
        <CheckRow ok={eh?.cron_secret_set ?? null} label="CRON_SECRET (drainer auto-recovery)" />
        <CheckRow ok={eh?.app_url_set ?? null} label="NEXT_PUBLIC_APP_URL (async triggers)" />
        <CheckRow ok={health ? !!health.ls_secret_set : null} label="Lemon Squeezy webhook secret" />
        <CheckRow ok={health ? !!health.ls_variants_configured : null} label="Lemon checkout variants" />
        <CheckRow ok={eh ? !eh.demo_mode : null} label="Demo mode OFF" detail={eh?.demo_mode ? "DEMO_MODE=true — must be off for real customers" : undefined} />
        <CheckRow
          ok={health ? true : null}
          label="Apollo licensed-only enforcement"
          detail={health?.apollo_key_set
            ? "API key present — customer-facing use stays blocked unless APOLLO_LICENSED_PROVIDER_ENABLED=true (requires data licensing)"
            : "No Apollo key configured"}
        />
        {eh && eh.missing_for_production.length > 0 && (
          <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "#dc2626" }}>
            Missing for production: {eh.missing_for_production.join(", ")}
          </div>
        )}
      </div>

      {/* Product readiness (open each to verify) */}
      <div style={sectionStyle}>
        <div style={titleStyle}>Product readiness — open each route to verify</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {PRODUCT_CHECKS.map(c => (
            <Link key={c.href} href={c.href} target="_blank" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999, padding: "0.3rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, color: "#0f172a", textDecoration: "none" }}>
              {c.label} ↗
            </Link>
          ))}
        </div>
      </div>

      {/* Manual checklists */}
      {[
        { title: "Business readiness (manual)", items: BUSINESS_ITEMS },
        { title: "Operational readiness (manual)", items: OPERATIONAL_ITEMS },
      ].map(section => (
        <div key={section.title} style={sectionStyle}>
          <div style={titleStyle}>{section.title}</div>
          {section.items.map(item => (
            <label key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", padding: "0.4rem 0", borderBottom: "1px solid #f8fafc", cursor: "pointer" }}>
              <input type="checkbox" checked={!!manual[item]} onChange={() => toggle(item)} style={{ marginTop: "0.15rem" }} />
              <span style={{ fontSize: "0.82rem", color: manual[item] ? "#15803d" : "#0f172a" }}>{item}</span>
            </label>
          ))}
        </div>
      ))}

      <p style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
        Manual checks persist in this browser only (localStorage). Live config comes from /api/admin/system-health — values are never shown.
      </p>
    </AdminLayout>
  );
}
