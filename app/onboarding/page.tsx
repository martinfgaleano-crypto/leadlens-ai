"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

type FormState = {
  company_name: string; offering: string; target_customer: string;
  target_countries: string; commercial_objective: string; delivery_email: string;
};
const EMPTY: FormState = { company_name: "", offering: "", target_customer: "", target_countries: "", commercial_objective: "", delivery_email: "" };

async function lifecycle(event: string, meta: Record<string, string> = {}) {
  await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, meta }) }).catch(() => null);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [intentId, setIntentId] = useState<string | undefined>();
  const [locale, setLocale] = useState<"en"|"es"|"pt"|"ja">("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) { setError("Onboarding is temporarily unavailable."); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login?return_to=%2Fonboarding"); return; }
      const headers = { authorization: `Bearer ${session.access_token}` };
      const [intentRes, onboardingRes] = await Promise.all([
        fetch("/api/commercial-intents", { headers }), fetch("/api/customer/onboarding", { headers }),
      ]);
      if (cancelled) return;
      let selectedLocale: "en"|"es"|"pt"|"ja" = "en";
      if (intentRes.ok) {
        const payload = await intentRes.json(); const intent = payload.intents?.[0];
        if (intent) { selectedLocale = intent.locale ?? "en"; setIntentId(intent.id); setLocale(selectedLocale); }
      }
      if (onboardingRes.ok) {
        const payload = await onboardingRes.json(); const row = payload.onboarding;
        if (row) setForm({ company_name: row.company_name ?? "", offering: row.what_you_sell ?? "", target_customer: row.ideal_customer ?? "", target_countries: (row.target_countries ?? []).join(", "), commercial_objective: row.commercial_objective ?? "", delivery_email: row.delivery_email ?? session.user.email ?? "" });
        else setForm(current => ({ ...current, delivery_email: session.user.email ?? "" }));
      }
      setLoading(false); void lifecycle("onboarding_started", { locale: selectedLocale });
    })();
    return () => { cancelled = true; };
  }, [router]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) { setForm(current => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) { router.replace("/login?return_to=%2Fonboarding"); return; }
    const countries = form.target_countries.split(",").map(value => value.trim()).filter(Boolean);
    const response = await fetch("/api/customer/onboarding", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ ...form, target_countries: countries, commercial_intent_id: intentId, locale }) });
    setSaving(false);
    if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error ?? "Your business context could not be saved."); return; }
    void lifecycle("onboarding_completed", { locale });
    router.replace("/dashboard?onboarding=complete");
  }

  if (loading) return <main style={S.page}><div style={S.card}>Loading your business context…</div></main>;
  return <main style={S.page}><section style={S.card} aria-labelledby="onboarding-title">
    <div style={S.eyebrow}>Business context</div><h1 id="onboarding-title" style={S.title}>Tell LeadLens where to focus</h1>
    <p style={S.copy}>Six fields give LeadLens the commercial context needed to research relevant accounts. Nothing is purchased or run from this page.</p>
    <form onSubmit={submit}>
      <Field label="Company or business" value={form.company_name} onChange={v => set("company_name", v)} />
      <Field label="What do you offer?" value={form.offering} onChange={v => set("offering", v)} multiline />
      <Field label="Who should buy it?" value={form.target_customer} onChange={v => set("target_customer", v)} multiline />
      <Field label="Target countries" hint="Separate countries with commas. These countries override broader region assumptions." value={form.target_countries} onChange={v => set("target_countries", v)} />
      <Field label="Commercial objective" value={form.commercial_objective} onChange={v => set("commercial_objective", v)} multiline />
      <Field label="Delivery email" value={form.delivery_email} onChange={v => set("delivery_email", v)} type="email" />
      {error && <div role="alert" aria-live="assertive" style={S.error}>{error}</div>}
      <button disabled={saving} style={S.button}>{saving ? "Saving…" : "Save business context"}</button>
    </form>
    <p style={S.footer}><Link href="/dashboard" style={S.link}>Return to dashboard</Link></p>
  </section></main>;
}

function Field({ label, hint, value, onChange, multiline, type = "text" }: { label: string; hint?: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return <label htmlFor={id} style={S.label}><span style={S.labelText}>{label}</span>{hint && <span id={`${id}-hint`} style={S.hint}>{hint}</span>}{multiline ? <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} required minLength={5} maxLength={1500} value={value} onChange={e => onChange(e.target.value)} style={{...S.input, minHeight: 82, resize: "vertical"}} /> : <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} type={type} required value={value} onChange={e => onChange(e.target.value)} style={S.input} />}</label>;
}

const S: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",padding:"2rem 1rem",background:"#f8fafc",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},card:{maxWidth:620,margin:"0 auto",padding:"2rem",background:"#fff",border:"1px solid #e2e8f0",borderRadius:"1rem",boxShadow:"0 4px 24px rgba(0,0,0,.05)"},eyebrow:{color:"#0284c7",fontSize:".68rem",fontWeight:800,letterSpacing:".1em",textTransform:"uppercase"},title:{margin:".35rem 0 .5rem",fontSize:"1.6rem",color:"#0f172a"},copy:{margin:"0 0 1.5rem",color:"#64748b",fontSize:".88rem",lineHeight:1.6},label:{display:"block",marginBottom:"1rem"},labelText:{display:"block",color:"#334155",fontSize:".76rem",fontWeight:700,marginBottom:".35rem"},hint:{display:"block",color:"#64748b",fontSize:".72rem",margin:"-.15rem 0 .4rem"},input:{boxSizing:"border-box",width:"100%",padding:".75rem",border:"1px solid #cbd5e1",borderRadius:".55rem",font:"inherit",color:"#0f172a"},error:{padding:".75rem",marginBottom:"1rem",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:".5rem",color:"#b91c1c",fontSize:".82rem"},button:{width:"100%",padding:".8rem",border:0,borderRadius:".55rem",background:"#0284c7",color:"white",fontWeight:700,cursor:"pointer"},footer:{textAlign:"center",margin:"1.25rem 0 0",fontSize:".8rem"},link:{color:"#0284c7",fontWeight:700}
};
