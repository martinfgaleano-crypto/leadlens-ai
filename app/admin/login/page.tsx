"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { establishAdminSession, resolveLoginTarget } from "@/lib/admin/admin-bootstrap";

// Compatibility route. PURE STATIC FORM — no session discovery on mount, so
// nothing async can block, cover or disable the form. An admin signs in here
// exactly like /login; on success the server bridge issues the cookie and
// redirects. There is no "Checking existing session"/"Verifying session" state.
const LOGIN_BUILD = "auth-nonblocking-v4";

export default function AdminLoginPage() {
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next"));
    if (params.get("reason") === "unauthorized") setError("This account is not authorized for Admin access.");
  }, []);

  const dest = () => (next && /^\/admin(\/|$)/.test(next) && !/^\/admin\/login/.test(next) ? next : "/admin/intelligence");

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
      const bridge = await establishAdminSession(data.session.access_token);
      if (bridge.status === 401) {
        setError("Your session could not be verified. Please sign in again.");
        setLoading(false);
        return;
      }
      const target = resolveLoginTarget(true, bridge);
      router.replace(bridge.isAdmin ? dest() : target.action === "redirect" ? target.to : "/dashboard");
    } catch {
      // signInWithPassword itself failed before a session existed. Keep the
      // already-rendered form interactive and report the authentication error.
      setError("Network error. Please try again.");
      setLoading(false);
    }
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
