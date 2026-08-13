"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, persistCommercialIntent, type CommercialFlowState } from "@/lib/commercial/customer-flow";

type SignupState = "form" | "check-email";
const LOGIN_BUILD = "auth-nonblocking-v4";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [view, setView]           = useState<SignupState>("form");
  const [flow, setFlow]           = useState<CommercialFlowState | null>(null);

  useEffect(() => setFlow(parseCommercialFlowState(new URLSearchParams(window.location.search))), []);

  // PURE STATIC FORM — no session discovery on mount. Nothing async runs before
  // the form renders, so it can never be blocked by a session/loading state.

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Auth service is not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.");
      return;
    }

    setError("");
    setIsDuplicate(false);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?type=signup${commercialFlowQuery(flow).replace("?", "&")}`,
      },
    });

    if (authError) {
      setLoading(false);
      // "User already registered" can come back as an error in some Supabase configs
      if (authError.message.toLowerCase().includes("already registered") ||
          authError.message.toLowerCase().includes("already exists")) {
        setIsDuplicate(true);
      } else {
        setError(authError.message);
      }
      return;
    }

    // Supabase returns identities: [] when email confirmation is ON and email already exists.
    // They don't surface an error to avoid leaking which emails are registered.
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setLoading(false);
      setIsDuplicate(true);
      return;
    }

    const user = data.user;
    const session = data.session;

    // Case 1: session returned immediately (email confirmation disabled in Supabase)
    // Create profile now and go to dashboard.
    if (session && user) {
      await ensureProfile(supabase, user.id, user.email ?? email.trim());
      const intentSaved = await persistCommercialIntent(session.access_token, flow);
      if (!intentSaved) {
        setLoading(false);
        setError("Your account was created, but we could not save your selected plan. Please sign in and try again.");
        return;
      }
      void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "auth_completed", product_code: flow?.product_code, meta: { locale: flow?.locale ?? "en", method: "signup" } }) });
      setLoading(false);
      router.replace(flow?.return_to ?? "/dashboard");
      return;
    }

    // Case 2: session is null — email confirmation is required.
    // Show the "check your email" screen. Profile will be created lazily on
    // first dashboard visit after the user clicks the confirmation link.
    setLoading(false);
    setView("check-email");
  }

  if (view === "check-email") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={S.logoBox}>✉</div>
            <h1 style={S.h1}>Check your email</h1>
            <p style={{ ...S.sub, lineHeight: 1.6 }}>
              We sent a confirmation link to <strong style={{ color: "#0f172a" }}>{email}</strong>.
              Click it to activate your account, then{" "}
              <Link href={`/login${commercialFlowQuery(flow)}`} style={S.link}>sign in</Link>.
            </p>
          </div>
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.75rem" }}>
            Didn&apos;t receive it? Check your spam folder or{" "}
            <button
              onClick={() => { setView("form"); setError(""); }}
              style={{ background: "none", border: "none", color: "#0ea5e9", fontWeight: 600, cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
            >
              try again
            </button>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page} data-login-build={LOGIN_BUILD}>
      <div style={S.card}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={S.logoBox}>L</div>
          <div style={S.eyebrow}>Account Opportunity Intelligence</div>
          <h1 style={S.h1}>Create your LeadLens account</h1>
          <p style={S.sub}>Find the B2B accounts worth working now — and the evidence behind each one.</p>
        </div>

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
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              style={S.input}
              onFocus={e => { e.target.style.borderColor = "#0ea5e9"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.12)"; }}
              onBlur={e  => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
            />
          </label>

          {isDuplicate && (
            <div style={S.errorBox}>
              <strong>This email is already registered.</strong>
              {" "}
              <Link href={`/login${commercialFlowQuery(flow)}`} style={{ color: "#dc2626", fontWeight: 700 }}>
                Log in instead →
              </Link>
            </div>
          )}

          {error && !isDuplicate && <div style={S.errorBox}>{error}</div>}

          <button type="submit" disabled={loading} style={loading ? S.btnDisabled : S.btn}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.75rem", marginTop: "1.25rem", lineHeight: 1.5 }}>
          By creating an account you agree to our{" "}
          <Link href="/terms" style={S.link}>Terms</Link> and{" "}
          <Link href="/privacy" style={S.link}>Privacy Policy</Link>.
        </p>

        <p style={S.footer}>
          Already have an account?{" "}
          <Link href={`/login${commercialFlowQuery(flow)}`} style={S.link}>Sign in →</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureProfile(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, email })
    .select()
    .single();

  // Ignore duplicate-key errors — profile already exists, that's fine
  if (error && !error.message.toLowerCase().includes("duplicate") && error.code !== "23505") {
    console.warn("[signup] profile creation error:", error.message);
  }
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
    lineHeight: 1.5,
  } as React.CSSProperties,
  eyebrow: {
    display: "inline-block",
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#0284c7",
    marginBottom: "0.6rem",
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
    marginTop: "1rem",
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
