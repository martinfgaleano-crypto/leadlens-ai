"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { commercialFlowQuery, parseCommercialFlowState, type CommercialFlowState } from "@/lib/commercial/customer-flow";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [flow, setFlow] = useState<CommercialFlowState | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFlow(parseCommercialFlowState(params));
    const supabase = getSupabaseClient();
    const code = params.get("code");
    if (!supabase) { setError("Password recovery is temporarily unavailable."); return; }
    (async () => {
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) { setError("This recovery link is invalid or has expired. Request a new one."); return; }
        window.history.replaceState({}, "", `/reset-password${commercialFlowQuery(parseCommercialFlowState(params))}`);
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setError("This recovery link is invalid or has expired. Request a new one."); return; }
      setSessionReady(true);
    })();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    const supabase = getSupabaseClient();
    if (!supabase) { setError("Password recovery is temporarily unavailable."); return; }
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setLoading(false); setError("This recovery link is invalid or has expired. Request a new one."); return; }
    const { error: authError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (authError) { setError("Your password could not be updated. Request a new recovery link."); return; }
    await supabase.auth.signOut();
    setDone(true);
  }

  return <main style={styles.page}><section style={styles.card} aria-labelledby="reset-title">
    <div style={styles.logo}>L</div><h1 id="reset-title" style={styles.title}>Choose a new password</h1>
    <p style={styles.copy}>Create a password with at least 8 characters.</p>
    {done ? <div role="status" style={styles.success}>Password updated. <Link href={`/login${commercialFlowQuery(flow)}`} style={styles.link}>Sign in securely →</Link></div> :
      <form onSubmit={submit}>
        <label style={styles.label}>New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={styles.input} /></label>
        <label style={{...styles.label, marginTop: "1rem"}}>Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} style={styles.input} /></label>
        {error && <div role="alert" style={styles.error}>{error}</div>}
        <button disabled={loading || !sessionReady} style={styles.button}>{loading ? "Updating…" : sessionReady ? "Update password" : "Verifying recovery link…"}</button>
      </form>}
  </section></main>;
}
const styles: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",display:"grid",placeItems:"center",padding:"2rem",background:"#f8fafc",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},card:{width:"100%",maxWidth:420,padding:"2.5rem",border:"1px solid #e2e8f0",borderRadius:"1rem",background:"white",boxShadow:"0 4px 24px rgba(0,0,0,.06)"},logo:{width:44,height:44,display:"grid",placeItems:"center",margin:"0 auto 1rem",borderRadius:10,color:"white",fontWeight:800,background:"linear-gradient(135deg,#0ea5e9,#0284c7)"},title:{margin:"0 0 .5rem",textAlign:"center",fontSize:"1.35rem",color:"#0f172a"},copy:{margin:"0 0 1.5rem",color:"#64748b",fontSize:".88rem",textAlign:"center"},label:{display:"block",color:"#374151",fontSize:".75rem",fontWeight:700,textTransform:"uppercase"},input:{width:"100%",boxSizing:"border-box",padding:".8rem",marginTop:".4rem",border:"1px solid #cbd5e1",borderRadius:".625rem",fontSize:"1rem"},button:{width:"100%",marginTop:"1rem",padding:".8rem",border:0,borderRadius:".625rem",background:"#0284c7",color:"white",fontWeight:700,cursor:"pointer"},success:{padding:"1rem",border:"1px solid #bbf7d0",borderRadius:".625rem",background:"#f0fdf4",color:"#166534",fontSize:".88rem"},error:{marginTop:"1rem",color:"#b91c1c",fontSize:".82rem"},link:{color:"#0284c7",fontWeight:700}
};
