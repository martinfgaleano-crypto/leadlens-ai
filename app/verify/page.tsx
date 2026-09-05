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
      track("verification_failed");
      return;
    }
    await ensureProfile(supabase, data.user.id, data.user.email ?? email);
    await persistCommercialIntent(data.session.access_token, flow);
    track("verification_completed", flow?.selection.kind ? { kind: flow.selection.kind } : {});
    const dest = flow ? `/checkout/continue${commercialFlowQuery(flow)}` : "/dashboard";
    router.replace(dest);
  }, [email, flow, router]);

  function setDigit(i: number, val: string) {
    const clean = val.replace(/\D/g, "");
    if (!clean) { const next = [...digits]; next[i] = ""; setDigits(next); return; }
    const next = [...digits];
    // paste of full code
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      for (let k = 0; k < 6; k++) next[k] = chars[k] ?? "";
      setDigits(next);
      const filled = next.filter(Boolean).length;
      inputs.current[Math.min(filled, 5)]?.focus();
      if (next.every(Boolean)) void submit(next.join(""));
      return;
    }
    next[i] = clean;
    setDigits(next);
    setError("");
    if (i < 5) inputs.current[i + 1]?.focus();
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
      email, options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback?type=signup${commercialFlowQuery(flow).replace("?", "&")}` },
    });
    setResending(false);
    if (err) { setError(friendlyAuthError(err.message)); return; }
    setResendIn(RESEND_SECONDS);
    track("verification_sent", { resend: "1" });
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ textAlign: "center", marginBottom: "1.8rem" }}>
          <div style={S.logoBox}>✓</div>
          <h1 style={S.h1}>Check your inbox</h1>
          <p style={S.sub}>
            We sent a 6-digit code to <strong style={{ color: C.ink }}>{email || "your email"}</strong>. Enter it below to continue.
          </p>
        </div>

        <div role="group" aria-label="Verification code" style={{ display: "flex", gap: ".55rem", justifyContent: "center", marginBottom: "1.1rem" }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              inputMode="numeric" autoComplete="one-time-code" maxLength={i === 0 ? 6 : 1}
              aria-label={`Digit ${i + 1}`} value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              disabled={verifying}
              className="ll-otp"
              style={{
                width: "3rem", height: "3.4rem", textAlign: "center", fontSize: "1.4rem", fontWeight: 700,
                fontFamily: font, color: C.ink, border: `1px solid ${error ? "#fca5a5" : C.line}`, borderRadius: ".65rem",
                background: verifying ? C.bg : C.card, outline: "none",
              }}
            />
          ))}
        </div>

        {error && <div style={S.errorBox} role="alert">{error}</div>}
        {verifying && <p style={{ textAlign: "center", color: C.muted, fontSize: ".85rem", margin: ".2rem 0 0" }}>Verifying…</p>}

        <div style={{ textAlign: "center", marginTop: "1.2rem", fontSize: ".85rem", color: C.sub }}>
          {resendIn > 0 ? (
            <span style={{ color: C.muted }}>Resend code in {resendIn}s</span>
          ) : (
            <button onClick={resend} disabled={resending} style={{ background: "none", border: "none", color: C.skyInk, fontWeight: 700, cursor: "pointer", fontSize: ".85rem", padding: 0 }}>
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>

        <p style={S.footer}>
          Wrong email? <Link href={`/signup${commercialFlowQuery(flow)}`} style={S.link}>Change email</Link>
        </p>
      </div>
      <style>{`.ll-otp:focus-visible{outline:none;border-color:${C.sky};box-shadow:${focusRing}}`}</style>
    </div>
  );
}
