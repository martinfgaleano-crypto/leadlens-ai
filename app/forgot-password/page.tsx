"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, type CommercialFlowState } from "@/lib/commercial/customer-flow";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<CommercialFlowState | null>(null);

  useEffect(() => setFlow(parseCommercialFlowState(new URLSearchParams(window.location.search))), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) { setError("Password recovery is temporarily unavailable."); return; }
    setLoading(true); setError("");
    const redirect = `${window.location.origin}/auth/callback?type=recovery${commercialFlowQuery(flow).replace("?", "&")}`;
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
    setLoading(false);
    if (authError) { setError("We could not send the recovery email. Please wait a moment and try again."); return; }
    setSent(true);
  }

  return <main style={styles.page}><section style={styles.card} aria-labelledby="recovery-title">
    <div style={styles.logo}>L</div>
    <h1 id="recovery-title" style={styles.title}>Reset your password</h1>
    <p style={styles.copy}>Enter your account email. If it is registered, we’ll send a secure recovery link.</p>
    {sent ? <div role="status" style={styles.success}>Check your inbox and spam folder for the recovery link.</div> :
      <form onSubmit={submit}>
        <label style={styles.label}>Email
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} />
        </label>
        {error && <div role="alert" style={styles.error}>{error}</div>}
        <button disabled={loading} style={styles.button}>{loading ? "Sending…" : "Send recovery link"}</button>
      </form>}
    <p style={styles.footer}><Link href={`/login${commercialFlowQuery(flow)}`} style={styles.link}>Back to sign in</Link></p>
  </section></main>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  card: { width: "100%", maxWidth: 420, padding: "2.5rem", border: "1px solid #e2e8f0", borderRadius: "1rem", background: "white", boxShadow: "0 4px 24px rgba(0,0,0,.06)" },
  logo: { width: 44, height: 44, display: "grid", placeItems: "center", margin: "0 auto 1rem", borderRadius: 10, color: "white", fontWeight: 800, background: "linear-gradient(135deg,#0ea5e9,#0284c7)" },
  title: { margin: "0 0 .5rem", textAlign: "center", fontSize: "1.35rem", color: "#0f172a" },
  copy: { margin: "0 0 1.5rem", color: "#64748b", fontSize: ".88rem", lineHeight: 1.6, textAlign: "center" },
  label: { display: "block", color: "#374151", fontSize: ".75rem", fontWeight: 700, textTransform: "uppercase" },
  input: { width: "100%", boxSizing: "border-box", padding: ".8rem", marginTop: ".4rem", border: "1px solid #cbd5e1", borderRadius: ".625rem", fontSize: "1rem" },
  button: { width: "100%", marginTop: "1rem", padding: ".8rem", border: 0, borderRadius: ".625rem", background: "#0284c7", color: "white", fontWeight: 700, cursor: "pointer" },
  success: { padding: "1rem", border: "1px solid #bbf7d0", borderRadius: ".625rem", background: "#f0fdf4", color: "#166534", fontSize: ".88rem" },
  error: { marginTop: "1rem", color: "#b91c1c", fontSize: ".82rem" },
  footer: { textAlign: "center", margin: "1.5rem 0 0", fontSize: ".82rem" }, link: { color: "#0284c7", fontWeight: 700 },
};
