"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, persistCommercialIntent, type CommercialFlowState } from "@/lib/commercial/customer-flow";
import { ensureProfile } from "@/lib/commercial/ensure-profile";
import { friendlyAuthError } from "@/lib/commercial/auth-errors";
import { authCardStyles as S } from "@/lib/commercial/auth-styles";
import { C, font, focusRing } from "@/lib/commercial/theme";

const RESEND_SECONDS = 30;
function track(event: string, meta: Record<string, string> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, ...meta }), keepalive: true }); } catch { /* never block */ }
}

// CANONICAL: numeric 6-digit OTP entry — the user stays inside LeadLens. verifyOtp establishes the
// session and resumes checkout with the exact selection. (A magic-link fallback is mentioned once,
// muted, so nobody is stranded while custom SMTP + {{ .Token }} are pending — never the primary UI.)
export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [flow, setFlow] = useState<CommercialFlowState | null>(null);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    setFlow(parseCommercialFlowState(params));
    inputs.current[0]?.focus();
    track("otp_verification_started");
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const submit = useCallback(async (code: string) => {
    if (code.length !== 6 || verifying) return;
    const supabase = getSupabaseClient();
    if (!supabase || !email) { setError("Something went wrong. Please start again."); return; }
    setVerifying(true); setError("");
    // Confirm the session is actually established before routing (no race).
    const { data, error: err } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (err || !data.session || !data.user) {
      setVerifying(false);
      setError(friendlyAuthError(err?.message ?? "invalid code"));
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      track("otp_failed");
      return;
    }
    await ensureProfile(supabase, data.user.id, data.user.email ?? email);
    await persistCommercialIntent(data.session.access_token, flow);
    track("otp_verified");
    router.replace(flow ? `/checkout/continue${commercialFlowQuery(flow)}` : "/dashboard");
  }, [email, flow, router, verifying]);

  function setDigit(i: number, val: string) {
    const clean = val.replace(/\D/g, "");
    const next = [...digits];
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      for (let k = 0; k < 6; k++) next[k] = chars[k] ?? "";
      setDigits(next); setError("");
      inputs.current[Math.min(next.filter(Boolean).length, 5)]?.focus();
      if (next.every(Boolean)) void submit(next.join(""));
      return;
    }
    next[i] = clean; setDigits(next); setError("");
    if (clean && i < 5) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) void submit(next.join(""));
  }
  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  }

  async function resend() {
    const supabase = getSupabaseClient();
    if (!supabase || !email || resendIn > 0 || resending) return;
    setResending(true); setError("");
    const origin = window.location.origin;
    const { error: err } = await supabase.auth.signInWithOtp({
      email, options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/continue${commercialFlowQuery(flow)}` },
    });
    setResending(false);
    if (err) { setError(friendlyAuthError(err.message)); return; }
    setResendIn(RESEND_SECONDS);
    track("otp_resent");
  }

  const complete = digits.every(Boolean);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ textAlign: "center", marginBottom: "1.7rem" }}>
          <div style={S.logoBox}>✉</div>
          <h1 style={S.h1}>Check your inbox</h1>
          <p style={S.sub}>
            We sent a 6-digit verification code to <strong style={{ color: C.ink }}>{email || "your email"}</strong>. Enter it below to continue.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void submit(digits.join("")); }}>
          <div role="group" aria-label="6-digit verification code" style={{ display: "flex", gap: ".45rem", justifyContent: "center", marginBottom: "1.2rem" }}>
            {digits.map((d, i) => (
              <input
                key={i} ref={(el) => { inputs.current[i] = el; }}
                inputMode="numeric" autoComplete="one-time-code" maxLength={i === 0 ? 6 : 1}
                aria-label={`Digit ${i + 1}`} value={d} disabled={verifying}
                onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKeyDown(i, e)}
                className="ll-otp"
                style={{ flex: "1 1 0", minWidth: 0, maxWidth: "3rem", height: "3.5rem", textAlign: "center", fontSize: "1.4rem", fontWeight: 700, fontFamily: font, color: C.ink, border: `1px solid ${error ? "#fca5a5" : C.line}`, borderRadius: ".6rem", background: verifying ? C.bg : C.card, outline: "none", padding: 0, boxSizing: "border-box" }}
              />
            ))}
          </div>

          {error && <div style={{ ...S.errorBox }} role="alert" aria-live="polite">{error}</div>}

          <button type="submit" disabled={!complete || verifying} style={complete && !verifying ? S.btn : S.btnDisabled}>
            {verifying ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.2rem", fontSize: ".85rem", color: C.sub }}>
          {resendIn > 0 ? (
            <span style={{ color: C.muted }}>Resend code in {resendIn}s</span>
          ) : (
            <button onClick={resend} disabled={resending} style={{ background: "none", border: "none", color: C.skyInk, fontWeight: 700, cursor: "pointer", fontSize: ".85rem", padding: 0 }}>
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
          <span style={{ color: C.faint }}> · </span>
          <Link href={`/signup${commercialFlowQuery(flow)}`} style={{ color: C.skyInk, fontWeight: 700, textDecoration: "none" }}>Change email</Link>
        </div>

        {/* Muted compatibility note (kept until branded OTP email ships); never the primary instruction. */}
        <p style={{ textAlign: "center", color: C.faint, fontSize: ".74rem", marginTop: "1.3rem", lineHeight: 1.5 }}>
          The same email also contains a sign-in link you can open if you prefer.
        </p>
      </div>
      <style>{`.ll-otp:focus-visible{outline:none;border-color:${C.sky};box-shadow:${focusRing}}`}</style>
    </div>
  );
}
