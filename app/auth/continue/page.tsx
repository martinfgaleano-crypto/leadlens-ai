"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, persistCommercialIntent } from "@/lib/commercial/customer-flow";
import { ensureProfile } from "@/lib/commercial/ensure-profile";
import { C, font } from "@/lib/commercial/theme";

// Browser-side magic-link landing. Supabase's default email template sends a sign-in LINK (not a
// numeric code) — clicking it lands on /auth/callback, which forwards the PKCE code here so the
// exchange happens in the SAME browser that started sign-in (the code_verifier lives here). We then
// establish the session, preserve the commercial selection, and continue to checkout — never a
// generic dashboard dump when purchase intent exists.
export default function AuthContinuePage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const flow = parseCommercialFlowState(params);
      const supabase = getSupabaseClient();
      if (!code || !supabase) { window.location.replace("/login?error=verification-failed"); return; }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session || !data.user) {
        // A cross-device/expired link cannot complete PKCE here — send back to sign-in cleanly.
        setFailed(true);
        setTimeout(() => window.location.replace(`/login?error=verification-failed${flow ? `&${commercialFlowQuery(flow).slice(1)}` : ""}`), 1200);
        return;
      }
      await ensureProfile(supabase, data.user.id, data.user.email ?? "");
      await persistCommercialIntent(data.session.access_token, flow);
      try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "verification_completed", meta: { method: "magic_link" } }), keepalive: true }); } catch { /* ignore */ }
      window.location.replace(flow ? `/checkout/continue${commercialFlowQuery(flow)}` : "/dashboard");
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${C.line}`, borderTopColor: C.sky, margin: "0 auto 1rem", animation: "ll-spin 0.8s linear infinite" }} />
        <p style={{ color: C.sub, fontSize: ".95rem" }}>{failed ? "That link couldn’t be verified. Redirecting…" : "Signing you in…"}</p>
      </div>
      <style>{`@keyframes ll-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
