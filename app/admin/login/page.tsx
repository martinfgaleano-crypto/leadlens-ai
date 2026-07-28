"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { establishAdminSession } from "@/lib/admin/admin-bootstrap";

// Compatibility route. There is ONE login experience: the normal /login. The
// admin form here is ALWAYS rendered (never blocked by a "Verifying session"
// screen). A background check auto-authorizes an existing session and otherwise
// defers to /login — but it can never hide or disable the form.
const LOGIN_BUILD = "form-always-visible-v3";
const GETSESSION_TIMEOUT_MS = 4000;

function AdminLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const reason = params.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(reason === "unauthorized" ? "This account is not authorized for Admin access." : "");
  const [loading, setLoading] = useState(false);
  const [sessionNote, setSessionNote] = useState<"checking" | "redirecting" | null>("checking");

  const dest = () => (next && /^\/admin(\/|$)/.test(next) && !/^\/admin\/login/.test(next) ? next : "/admin/intelligence");

  // Background only — never gates the form. 1) valid admin cookie → in.
  // 2) existing Supabase session → bridge → redirect. 3) no session → defer to
  // /login. Every await is bounded/caught; any failure leaves the form usable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const tm = ctrl ? setTimeout(() => ctrl.abort(), GETSESSION_TIMEOUT_MS) : null;
        const r = await fetch("/api/admin/session", { signal: ctrl?.signal }).finally(() => { if (tm) clearTimeout(tm); });
        if (!cancelled && r.ok) { setSessionNote("redirecting"); router.replace(dest()); return; }
      } catch { /* fall through */ }
      const supabase = getSupabaseClient();
      if (!supabase) { if (!cancelled) setSessionNote(null); return; }
      let session: { access_token: string } | null = null;
      try {
        const gs = supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        const timeout = new Promise<{ data: { session: null } }>((res) => setTimeout(() => res({ data: { session: null } }), GETSESSION_TIMEOUT_MS));
        session = (await Promise.race([gs, timeout])).data.session;
      } catch { session = null; }
      if (cancelled) return;
      if (session) {
        const bridge = await establishAdminSession(session.access_token);
        if (cancelled) return;
        setSessionNote("redirecting");
        router.replace(bridge.isAdmin && bridge.redirectTo ? bridge.redirectTo : "/dashboard");
      } else {
        setSessionNote("redirecting");
        router.replace(`/login?next=${encodeURIComponent(dest())}`);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supabase = getSupabaseClient();
    if (!supabase) { setError("Authentication is not configured. Contact the system owner."); return; }
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authErr || !data.session) { setError("Invalid email or password."); setLoading(false); return; }
      // Exchange the session for a server-verified admin cookie.
      const res = await fetch("/api/admin/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: data.session.access_token }),
      });
      if (res.ok) { router.replace(dest()); return; }
      // Not an admin (or config error): sign the Supabase session back out so a
      // non-admin isn't left holding a customer session on the admin origin.
      await supabase.auth.signOut();
      if (res.status === 403) setError("This account is not authorized for Admin access.");
      else if (res.status === 503) setError("Admin authorization is temporarily unavailable. Try again shortly.");
      else setError("Sign-in failed. Please try again.");
    } catch { setError("Network error. Please try again."); }
    setLoading(false);
  }

  const input: React.CSSProperties = { display: "block", width: "100%", padding: "0.75rem 0.875rem", border: "1px solid #e2e8f0", borderRadius: "0.625rem", fontSize: "0.9rem", color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: "1rem" };
  return (
    <div data-login-build={LOGIN_BUILD} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "1rem", padding: "2.5rem", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "linear-gradient(135deg,#0ea5e9,#0284c7)", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: "1.25rem", marginBottom: "0.875rem" }}>L</div>
          <h1 style={{ color: "#0f172a", fontSize: "1.25rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>LeadLens Admin</h1>
          <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>Authorized administrators only</p>
        </div>
        {sessionNote === "checking" && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.72rem", margin: "0 0 1rem" }}>Checking existing session…</p>}
        {sessionNote === "redirecting" && <p style={{ textAlign: "center", color: "#0ea5e9", fontSize: "0.72rem", margin: "0 0 1rem" }}>Signing you in…</p>}
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.4rem", letterSpacing: "0.03em", textTransform: "uppercase" }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="username" style={input} />
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.4rem", letterSpacing: "0.03em", textTransform: "uppercase" }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={input} />
          {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", color: "#dc2626", fontSize: "0.8rem", marginBottom: "1rem" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ display: "block", width: "100%", padding: "0.8rem", background: loading ? "#7dd3fc" : "#0ea5e9", color: "#fff", border: "none", borderRadius: "0.625rem", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.72rem", marginTop: "1.5rem", marginBottom: 0 }}>Authenticated by Supabase. Authorized server-side.</p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return <Suspense fallback={null}><AdminLoginInner /></Suspense>;
}
