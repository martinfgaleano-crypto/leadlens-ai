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

// The current Supabase default template sends a secure sign-in LINK (no numeric code). So the LINK is
// the primary path here: clicking it lands on /auth/continue, which establishes the session and
// resumes checkout. The 6-digit entry is kept as a secondary, future-capable path (it works once the
// email template includes {{ .Token }} with custom SMTP) — never promised as the current delivery.
export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [flow, setFlow] = useState<CommercialFlowState | null>(null);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    setFlow(parseCommercialFlowState(params));
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const submit = useCallback(async (code: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !email) { setError("Something went wrong. Please start again."); return; }
    setVerifying(true); setError("");
    const { data, error: err } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (err || !data.session || !data.user) {
      setVerifying(false);
      setError(friendlyAuthError(err?.message ?? "invalid code"));
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      track("verification_failed", { method: "code" });
      return;
    }
    await ensureProfile(supabase, data.user.id, data.user.email ?? email);
    await persistCommercialIntent(data.session.access_token, flow);
    track("verification_completed", { method: "code" });
    router.replace(flow ? `/checkout/continue${commercialFlowQuery(flow)}` : "/dashboard");
  }, [email, flow, router]);

  function setDigit(i: number, val: string) {
    const clean = val.replace(/\D/g, "");
    const next = [...digits];
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      for (let k = 0; k < 6; k++) next[k] = chars[k] ?? "";
      setDigits(next);
      inputs.current[Math.min(next.filter(Boolean).length, 5)]?.focus();
      if (next.every(Boolean)) void submit(next.join(""));
      return;
    }
    next[i] = clean;
    setDigits(next); setError("");
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
    track("verification_sent", { resend: "1" });
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ textAlign: "center", marginBottom: "1.6rem" }}>
          <div style={S.logoBox}>✉</div>
          <h1 style={S.h1}>Check your inbox</h1>
          <p style={S.sub}>
            We sent a secure sign-in email to <strong style={{ color: C.ink }}>{email || "your email"}</strong>. Open the sign-in link in that email and we&apos;ll bring you right back to your selection.
          </p>
        </div>

        <div style={{ background: C.skySoft, border: `1px solid ${C.skyLine}`, borderRadius: ".75rem", padding: ".9rem 1rem", fontSize: ".85rem", color: C.skyInk, lineHeight: 1.5 }}>
          Tip: open the link in <strong>this same browser</strong> so we can finish signing you in. Can&apos;t find it? Check spam.
        </div>

        {error && <div style={{ ...S.errorBox, marginTop: "1rem", marginBottom: 0 }} role="alert">{error}</div>}

        <div style={{ textAlign: "center", marginTop: "1.3rem", fontSize: ".85rem", color: C.sub }}>
          {resendIn > 0 ? (
            <span style={{ color: C.muted }}>Resend email in {resendIn}s</span>
          ) : (
            <button onClick={resend} disabled={resending} style={{ background: "none", border: "none", color: C.skyInk, fontWeight: 700, cursor: "pointer", fontSize: ".85rem", padding: 0 }}>
              {resending ? "Sending…" : "Resend email"}
            </button>
          )}
          <span style={{ color: C.faint }}> · </span>
          <Link href={`/signup${commercialFlowQuery(flow)}`} style={{ color: C.skyInk, fontWeight: 700, textDecoration: "none" }}>Change email</Link>
        </div>

        {/* Secondary, future-capable path — a numeric code (only when the email includes one). */}
        <div style={{ borderTop: `1px solid ${C.lineSoft}`, marginTop: "1.4rem", paddingTop: "1.1rem", textAlign: "center" }}>
          {!showCode ? (
            <button onClick={() => setShowCode(true)} style={{ background: "none", border: "none", color: C.muted, fontWeight: 600, cursor: "pointer", fontSize: ".82rem" }}>
              Your email included a 6-digit code? Enter it →
            </button>
          ) : (
            <>
              <p style={{ fontSize: ".82rem", color: C.sub, margin: "0 0 .7rem" }}>Enter the 6-digit code from your email</p>
              <div role="group" aria-label="Verification code" style={{ display: "flex", gap: ".5rem", justifyContent: "center" }}>
                {digits.map((d, i) => (
                  <input
                    key={i} ref={(el) => { inputs.current[i] = el; }}
                    inputMode="numeric" autoComplete="one-time-code" maxLength={i === 0 ? 6 : 1}
                    aria-label={`Digit ${i + 1}`} value={d} disabled={verifying}
                    onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKeyDown(i, e)}
                    className="ll-otp"
                    style={{ width: "2.7rem", height: "3.2rem", textAlign: "center", fontSize: "1.3rem", fontWeight: 700, fontFamily: font, color: C.ink, border: `1px solid ${error ? "#fca5a5" : C.line}`, borderRadius: ".6rem", background: verifying ? C.bg : C.card, outline: "none" }}
                  />
                ))}
              </div>
              {verifying && <p style={{ color: C.muted, fontSize: ".82rem", margin: ".6rem 0 0" }}>Verifying…</p>}
            </>
          )}
        </div>
      </div>
      <style>{`.ll-otp:focus-visible{outline:none;border-color:${C.sky};box-shadow:${focusRing}}`}</style>
    </div>
  );
}
