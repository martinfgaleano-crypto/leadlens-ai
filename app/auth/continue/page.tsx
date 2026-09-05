"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, persistCommercialIntent, type CommercialFlowState } from "@/lib/commercial/customer-flow";
import { ensureProfile } from "@/lib/commercial/ensure-profile";
import { C, font, focusRing } from "@/lib/commercial/theme";

// Real magic-link / confirmation landing (flow-agnostic). The Supabase browser client defaults to
// the IMPLICIT flow, so the clicked email link returns the session in the URL FRAGMENT
// (#access_token=…) — which a server route can never read. This is a CLIENT page: on a fresh page
// load the Supabase client's detectSessionInUrl (default) parses that fragment (implicit) OR a
// ?code (PKCE) and establishes the session here. We then restore the commercial selection and
// continue to checkout — never a silent dead-end, never a generic dashboard when intent exists.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AuthContinuePage() {
  const [failed, setFailed] = useState(false);
  const [flow, setFlow] = useState<CommercialFlowState | null>(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const f = parseCommercialFlowState(params);
      setFlow(f);
      const supabase = getSupabaseClient();
      if (!supabase) { setFailed(true); return; }

      // 1. Already signed in (link opened in an authenticated session) → continue immediately.
      let session = (await supabase.auth.getSession()).data.session;

      // 2. PKCE: an explicit ?code in the query (same-browser code_verifier required).
      if (!session) {
        const code = params.get("code");
        if (code) { try { await supabase.auth.exchangeCodeForSession(code); } catch { /* fall through to poll */ } }
      }

      // 3. Implicit: detectSessionInUrl parses the #fragment asynchronously on load — poll briefly.
      for (let i = 0; i < 12 && !session; i++) {
        session = (await supabase.auth.getSession()).data.session;
        if (session) break;
        await delay(200);
      }

      if (!session || !session.user) {
        setFailed(true);
        try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "verification_failed", meta: { method: "magic_link" } }), keepalive: true }); } catch { /* ignore */ }
        return;
      }

      await ensureProfile(supabase, session.user.id, session.user.email ?? "");
      await persistCommercialIntent(session.access_token, f);
      try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "verification_completed", meta: { method: "magic_link" } }), keepalive: true }); } catch { /* ignore */ }
      window.location.replace(f ? `/checkout/continue${commercialFlowQuery(f)}` : "/dashboard");
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      {!failed ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${C.line}`, borderTopColor: C.sky, margin: "0 auto 1.1rem", animation: "ll-spin .8s linear infinite" }} />
          <p style={{ color: C.ink, fontSize: "1.02rem", fontWeight: 700, margin: 0 }}>Email confirmed</p>
          <p style={{ color: C.sub, fontSize: ".9rem", margin: ".35rem 0 0" }}>Returning you to your LeadLens selection…</p>
        </div>
      ) : (
        <div style={{ textAlign: "center", maxWidth: "26rem" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fef2f2", color: "#dc2626", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: "1.1rem" }} aria-hidden>!</div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>We couldn’t complete sign-in from this link</h1>
          <p style={{ color: C.sub, fontSize: ".92rem", lineHeight: 1.6, margin: ".7rem 0 1.4rem" }}>
            The link may have expired, or it was opened in a different browser than the one you started in. You can request a fresh sign-in email and keep your selection.
          </p>
          <Link href={`/signup${commercialFlowQuery(flow)}`} className="ll-recover" style={{ display: "inline-block", textDecoration: "none", padding: ".8rem 1.5rem", fontSize: ".95rem", fontWeight: 700, color: "#fff", background: C.sky, borderRadius: ".7rem" }}>
            Send a new sign-in email
          </Link>
          <div style={{ marginTop: ".9rem" }}>
            <Link href={flow ? `/checkout/continue${commercialFlowQuery(flow)}` : "/pricing"} style={{ color: C.muted, fontSize: ".82rem", fontWeight: 600, textDecoration: "none" }}>Return to your selection</Link>
          </div>
        </div>
      )}
      <style>{`@keyframes ll-spin{to{transform:rotate(360deg)}} .ll-recover:focus-visible{outline:none;box-shadow:${focusRing}}`}</style>
    </div>
  );
}
