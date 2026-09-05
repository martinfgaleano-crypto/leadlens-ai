"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, type CommercialFlowState } from "@/lib/commercial/customer-flow";
import { C } from "@/lib/commercial/theme";
import { authCardStyles as S } from "@/lib/commercial/auth-styles";
import { friendlyAuthError } from "@/lib/commercial/auth-errors";

function track(event: string, meta: Record<string, string> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, ...meta }), keepalive: true }); } catch { /* never block */ }
}

// Build marker busts stale App Router/RSC caches from older deployments (guarded by
// admin-login-routing). OTP-first signup is passwordless, so this marker distinguishes it.
const LOGIN_BUILD = "signup-otp-v1";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<CommercialFlowState | null>(null);

  useEffect(() => setFlow(parseCommercialFlowState(new URLSearchParams(window.location.search))), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) { setError("Sign-in is temporarily unavailable. Please try again shortly."); return; }
    setError(""); setLoading(true);
    track("signup_started", flow?.selection.kind ? { kind: flow.selection.kind } : {});

    // Passwordless sign-in: signInWithOtp sends a magic link by default (current Supabase template),
    // and a numeric code once the email template includes the token. emailRedirectTo routes the link
    // through /auth/callback → /auth/continue so the browser establishes the session either way.
    const origin = window.location.origin;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${origin}/auth/callback?type=signup${commercialFlowQuery(flow).replace("?", "&")}`,
      },
    });

    setLoading(false);
    if (authError) { setError(friendlyAuthError(authError.message)); return; }
    track("verification_sent");
    const q = commercialFlowQuery(flow).replace("?", "&");
    router.push(`/verify?email=${encodeURIComponent(email.trim())}${q}`);
  }

  return (
    <div style={S.page} data-login-build={LOGIN_BUILD}>
      <div style={S.card}>
        <div style={{ textAlign: "center", marginBottom: "1.9rem" }}>
          <div style={S.logoBox}>L</div>
          <div style={S.eyebrow}>Account Opportunity Intelligence</div>
          <h1 style={S.h1}>Create your LeadLens account</h1>
          <p style={S.sub}>Save your selection, connect purchases to your workspace, and access your intelligence as it develops. We&apos;ll email you a secure sign-in link — no password to remember.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={S.label}>
            <span style={S.labelText}>Work email</span>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required autoComplete="email" autoFocus style={S.input}
              onFocus={e => { e.target.style.borderColor = C.sky; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,.14)"; }}
              onBlur={e => { e.target.style.borderColor = C.line; e.target.style.boxShadow = "none"; }}
            />
          </label>

          {error && <div style={S.errorBox} role="alert">{error}</div>}

          <button type="submit" disabled={loading || !email} style={loading || !email ? S.btnDisabled : S.btn}>
            {loading ? "Sending code…" : "Continue"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: C.muted, fontSize: ".72rem", marginTop: "1.15rem", lineHeight: 1.55 }}>
          By continuing you agree to our <Link href="/terms" style={S.link}>Terms</Link> and <Link href="/privacy" style={S.link}>Privacy Policy</Link>.
        </p>
        <p style={S.footer}>
          Already have an account? <Link href={`/login${commercialFlowQuery(flow)}`} style={S.link}>Sign in →</Link>
        </p>
      </div>
      <style>{`input:focus-visible{outline:none}`}</style>
    </div>
  );
}
