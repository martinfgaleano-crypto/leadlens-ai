"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { establishAdminSession, resolveLoginTarget } from "@/lib/admin/admin-bootstrap";

// Structural fail-safe: the login page is a PURE STATIC FORM. It performs NO
// session discovery on mount — nothing async runs before or around the render,
// so no getSession/refresh-token/bridge state can ever block, cover, disable or
// gate the form. Redirects happen ONLY after an explicit successful sign-in.
// A bumpable build marker proves which code production is serving.
const LOGIN_BUILD = "auth-nonblocking-v5";

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("wrong password"))
    return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please verify your email before signing in. Check your inbox.";
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("user not found"))
    return "No account found with that email. Would you like to create one?";
  return msg;
}

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);

  // Query banners and configuration checks run after the unconditional form
  // render. They never perform session discovery or gate the UI.
  useEffect(() => {
    if (!getSupabaseClient()) setAuthUnavailable(true);
    const params = new URLSearchParams(window.location.search);
    setVerified(params.get("verified") === "1");
    setVerifyFailed(params.get("error") === "verification-failed");
  }, []);

  // Redirect happens ONLY on an explicit successful sign-in.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) { setError("Authentication is temporarily unavailable. Please retry."); return; }
    setError("");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !data.session) { setLoading(false); setError(friendlyAuthError(authError?.message ?? "Sign-in failed.")); return; }
      const bridge = await establishAdminSession(data.session.access_token);
      if (bridge.status === 401) {
        setLoading(false);
        setError("Your session could not be verified. Please sign in again.");
        return;
      }
      const target = resolveLoginTarget(true, bridge);
      // Hard navigation deliberately bypasses stale App Router/RSC state from
      // older deployments. The destination is same-origin and server-checked.
      window.location.replace(target.action === "redirect" ? target.to : "/dashboard");
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <div style={S.page} data-login-build={LOGIN_BUILD}>
      <div style={S.card}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={S.logoBox}>L</div>
          <h1 style={S.h1}>Sign in to your LeadLens workspace</h1>
          <p style={S.sub}>Your B2B opportunity monitor</p>
        </div>

        {authUnavailable && (
          <div style={S.errorBox}>Authentication is temporarily unavailable. Please retry.</div>
        )}

        {/* Verification success banner */}
        {verified && (
          <div style={S.successBox}>
            <span style={{ fontSize: "1rem", marginRight: "0.5rem" }}>✓</span>
            <span>
              <strong>Account verified successfully.</strong>
              {" "}Sign in below to continue to your dashboard.
            </span>
          </div>
        )}

        {/* Verification error banner */}
        {verifyFailed && (
          <div style={S.errorBox}>
            Email verification failed or link has expired. Please try signing up again or contact support.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={S.label}>
            <span style={S.labelText}>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              style={S.input}
              onFocus={e => { e.target.style.borderColor = "#0ea5e9"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.12)"; }}
              onBlur={e  => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
            />
          </label>

          <label style={S.label}>
            <span style={S.labelText}>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
              style={S.input}
              onFocus={e => { e.target.style.borderColor = "#0ea5e9"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.12)"; }}
              onBlur={e  => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
            />
          </label>

          {error && <div style={S.errorBox}>{error}</div>}

          <button type="submit" disabled={loading} style={loading ? S.btnDisabled : S.btn}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={S.footer}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={S.link}>Create one →</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    padding: "2rem",
  } as React.CSSProperties,
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "1rem",
    padding: "2.5rem",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  } as React.CSSProperties,
  logoBox: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 800,
    fontSize: "1.25rem",
    marginBottom: "0.875rem",
  } as React.CSSProperties,
  h1: {
    color: "#0f172a",
    fontSize: "1.25rem",
    fontWeight: 800,
    margin: "0 0 0.25rem",
    letterSpacing: "-0.02em",
  } as React.CSSProperties,
  sub: {
    color: "#64748b",
    fontSize: "0.8rem",
    margin: 0,
  } as React.CSSProperties,
  label: {
    display: "block",
    marginBottom: "1rem",
  } as React.CSSProperties,
  labelText: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.4rem",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  } as React.CSSProperties,
  input: {
    display: "block",
    width: "100%",
    padding: "0.75rem 0.875rem",
    border: "1px solid #e2e8f0",
    borderRadius: "0.625rem",
    fontSize: "0.9rem",
    color: "#0f172a",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  } as React.CSSProperties,
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "0.5rem",
    padding: "0.75rem 0.875rem",
    color: "#15803d",
    fontSize: "0.82rem",
    marginBottom: "1.25rem",
    display: "flex",
    alignItems: "flex-start",
    gap: "0.25rem",
    lineHeight: 1.5,
  } as React.CSSProperties,
  errorBox: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    borderRadius: "0.5rem",
    padding: "0.625rem 0.875rem",
    color: "#dc2626",
    fontSize: "0.8rem",
    marginBottom: "1rem",
  } as React.CSSProperties,
  btn: {
    display: "block",
    width: "100%",
    padding: "0.8rem",
    background: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: "0.625rem",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  } as React.CSSProperties,
  btnDisabled: {
    display: "block",
    width: "100%",
    padding: "0.8rem",
    background: "#7dd3fc",
    color: "#fff",
    border: "none",
    borderRadius: "0.625rem",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "not-allowed",
    fontFamily: "inherit",
  } as React.CSSProperties,
  footer: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "0.8rem",
    marginTop: "1.5rem",
    marginBottom: 0,
  } as React.CSSProperties,
  link: {
    color: "#0ea5e9",
    fontWeight: 600,
    textDecoration: "none",
  } as React.CSSProperties,
  fullCenter: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontFamily: "-apple-system,sans-serif",
    fontSize: "0.9rem",
  } as React.CSSProperties,
};
