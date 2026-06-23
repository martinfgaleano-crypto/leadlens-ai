"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const TOTAL_STEPS = 6;

const PLANS = [
  {
    id: "starter", label: "Starter", price: "$29", leads: 25,
    tagline: "For testing LeadLens",
    includes: [
      "25 fully verified leads",
      "Name, title, company, and email",
      "Matched to your target buyer profile",
      "Delivered within 48 hours",
    ],
  },
  {
    id: "standard", label: "Standard", price: "$97", leads: 50,
    tagline: "For growing outbound teams",
    includes: [
      "50 fully verified leads",
      "Full contact info + buyer intent signals",
      "Priority targeting match",
      "Delivered within 48 hours",
    ],
    recommended: true,
  },
  {
    id: "pro", label: "Pro", price: "$197", leads: 100,
    tagline: "For serious outbound",
    includes: [
      "100 premium verified leads",
      "Full contact info + decision-maker signals",
      "Deep targeting and exclusions applied",
      "Delivered within 48 hours",
    ],
  },
];

const INDUSTRIES = [
  "Technology / Software", "Financial Services", "Healthcare", "Manufacturing",
  "Real Estate", "Professional Services", "Marketing & Advertising",
  "E-commerce / Retail", "Construction", "Education", "Legal", "SaaS", "Other",
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "Spain", "Mexico", "Colombia", "Brazil", "Argentina", "France",
  "Netherlands", "Chile", "Peru", "UAE", "India",
];

const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,000+"];

const STEP_LABELS = [
  "Choose your plan",
  "Contact details",
  "Your business",
  "Your target buyer",
  "Brand & delivery",
  "Review & submit",
];

interface FormState {
  plan: string; lead_count: number;
  full_name: string; email: string; company_name: string;
  website: string; country: string; linkedin_url: string;
  what_you_sell: string; value_proposition: string; ideal_customer: string;
  target_countries: string[]; target_industries: string[];
  target_company_sizes: string[]; target_job_titles: string[];
  buyer_persona: string; exclusions: string;
  logo_url: string; brand_color: string; sender_name: string;
  sender_title: string; sender_email: string;
  credibility_statement: string; proof_point: string;
  delivery_email: string; notes: string; acknowledged: boolean;
}

const INITIAL: FormState = {
  plan: "standard", lead_count: 50,
  full_name: "", email: "", company_name: "", website: "", country: "", linkedin_url: "",
  what_you_sell: "", value_proposition: "", ideal_customer: "",
  target_countries: [], target_industries: [], target_company_sizes: [], target_job_titles: [],
  buyer_persona: "", exclusions: "",
  logo_url: "", brand_color: "", sender_name: "", sender_title: "", sender_email: "",
  credibility_statement: "", proof_point: "",
  delivery_email: "", notes: "", acknowledged: false,
};

// ─── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder, suggestions = [] }: {
  tags: string[]; onChange: (v: string[]) => void;
  placeholder: string; suggestions?: string[];
}) {
  const [input, setInput] = useState("");
  function add(val: string) {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  }
  function remove(t: string) { onChange(tags.filter(x => x !== t)); }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    else if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
  }
  const unused = suggestions.filter(s => !tags.includes(s));
  return (
    <div>
      <div style={TS.box}>
        {tags.map(t => (
          <span key={t} style={TS.chip}>
            {t}
            <button type="button" onClick={() => remove(t)} style={TS.x}>×</button>
          </span>
        ))}
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
          onBlur={() => { if (input.trim()) add(input); }}
          placeholder={tags.length ? "" : placeholder} style={TS.tinput} />
      </div>
      {unused.length > 0 && (
        <div style={TS.sugg}>
          {unused.slice(0, 6).map(s => (
            <button key={s} type="button" onClick={() => add(s)} style={TS.suggBtn}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const TS = {
  box: { display: "flex", flexWrap: "wrap" as const, gap: "0.35rem", border: "1px solid #e2e8f0", borderRadius: "0.625rem", padding: "0.5rem 0.625rem", background: "#fff", minHeight: 46, alignItems: "center" },
  chip: { display: "inline-flex", alignItems: "center", gap: "0.2rem", background: "#e0f2fe", color: "#0369a1", borderRadius: "999px", padding: "0.25rem 0.6rem", fontSize: "0.8rem", fontWeight: 600 },
  x: { background: "none", border: "none", cursor: "pointer", color: "#0369a1", fontSize: "1rem", lineHeight: 1, padding: 0, fontFamily: "inherit" },
  tinput: { border: "none", outline: "none", fontSize: "0.9rem", color: "#0f172a", fontFamily: "inherit", flex: 1, minWidth: 100, background: "transparent", padding: "0.1rem 0" },
  sugg: { display: "flex", flexWrap: "wrap" as const, gap: "0.35rem", marginTop: "0.45rem" },
  suggBtn: { background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "999px", padding: "0.25rem 0.65rem", fontSize: "0.75rem", color: "#475569", cursor: "pointer", fontFamily: "inherit" },
};

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, hint, error, children, optional }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; optional?: boolean;
}) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: hint ? "0.2rem" : "0.35rem" }}>
        <label style={S.label}>{label}</label>
        {optional && <span style={S.optional}>optional</span>}
      </div>
      {hint && <p style={S.hint}>{hint}</p>}
      {children}
      {error && <p style={S.errText}>{error}</p>}
    </div>
  );
}

// ─── ReviewRow ────────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  const empty = !value || value === "—";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", padding: "0.375rem 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ fontSize: "0.74rem", color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "0.78rem", color: empty ? "#cbd5e1" : "#0f172a", fontWeight: empty ? 400 : 600, textAlign: "right" as const, wordBreak: "break-all" as const }}>
        {empty ? "Not provided" : value}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StartPage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState(1);
  const [form, setForm]           = useState<FormState>(INITIAL);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [submitting, setSub]      = useState(false);
  const [submitErr, setSubErr]    = useState("");
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.plan) e.plan = "Please select a plan.";
    }
    if (s === 2) {
      if (!form.full_name.trim())    e.full_name    = "Full name is required.";
      if (!form.email.trim())        e.email        = "Business email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address.";
      if (!form.company_name.trim()) e.company_name = "Company name is required.";
    }
    if (s === 3) {
      if (!form.what_you_sell.trim()) e.what_you_sell = "Please describe what your company sells.";
    }
    if (s === 5) {
      if (!form.delivery_email.trim()) e.delivery_email = "Delivery email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.delivery_email)) e.delivery_email = "Enter a valid email.";
    }
    if (s === 6) {
      if (!form.acknowledged) e.acknowledged = "Please confirm you understand the delivery terms.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    const nextStep = Math.min(step + 1, TOTAL_STEPS);
    if (nextStep === 5) {
      setForm(f => ({
        ...f,
        delivery_email: f.delivery_email || f.email,
        sender_name:    f.sender_name    || f.full_name,
        sender_email:   f.sender_email   || f.email,
      }));
    }
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep(s => Math.max(s - 1, 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/onboarding/upload-logo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) set("logo_url", json.url);
      else setErrors(prev => ({ ...prev, logo: "Upload failed. Paste a URL instead." }));
    } catch {
      setErrors(prev => ({ ...prev, logo: "Upload failed. Paste a URL instead." }));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep(6)) return;
    setSub(true);
    setSubErr("");
    try {
      const res  = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.detail
          ? `${json.error ?? "Submission failed."} (${json.step}: ${json.detail})`
          : (json.error ?? "Submission failed. Please try again.");
        setSubErr(msg);
        setSub(false);
        return;
      }
      const q = new URLSearchParams({
        id:    json.request_id,
        plan:  json.plan,
        leads: String(json.lead_count),
        email: json.delivery_email,
      });
      router.push(`/start/success?${q}`);
    } catch {
      setSubErr("Network error. Please try again.");
      setSub(false);
    }
  }

  const selectedPlan = PLANS.find(p => p.id === form.plan);

  return (
    <div style={S.root}>

      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <header style={S.topNav}>
        <div style={S.navBrand}>
          <div style={S.logoMark}>L</div>
          <span style={S.brandName}>LeadLens</span>
          <span style={S.aiBadge}>AI</span>
        </div>
        <a href="/login" style={S.signInLink}>
          Already a customer? <strong>Sign in →</strong>
        </a>
      </header>

      {/* ── Hero — step 1 only ───────────────────────────────────────────── */}
      {step === 1 && (
        <div style={S.hero}>
          <div style={S.heroInner}>
            <h1 style={S.heroH1}>Get qualified leads delivered in 48 hours.</h1>
            <p style={S.heroSub}>
              Tell us who your ideal buyer is — our team sources, verifies,
              and delivers your lead list while you focus on selling.
            </p>
            <div style={S.trustPills}>
              <span style={S.trustPill}>✓ No subscription required</span>
              <span style={S.trustPill}>✓ Verified contact info</span>
              <span style={S.trustPill}>✓ 48-hour delivery</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Form area ────────────────────────────────────────────────────── */}
      <div style={{ ...S.formArea, paddingTop: step === 1 ? "1.25rem" : "2rem" }}>
        <div style={S.card}>

          {/* Progress */}
          <div style={S.progressWrapper}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={S.stepMeta}>Step {step} of {TOTAL_STEPS}</span>
              <span style={S.stepMetaRight}>{STEP_LABELS[step - 1]}</span>
            </div>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${(step / TOTAL_STEPS) * 100}%` }} />
            </div>
          </div>

          {step > 1 && <h2 style={S.h2}>{STEP_LABELS[step - 1]}</h2>}

          <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>

            {/* ── STEP 1: Plan ──────────────────────────────────────────── */}
            {step === 1 && (
              <div>
                <p style={S.stepIntro}>
                  Choose your first lead batch. This is a <strong>one-time purchase</strong> — no
                  subscription, no commitment. Start small, scale when you&apos;re ready.
                </p>
                <div style={S.planList}>
                  {PLANS.map(p => {
                    const active = form.plan === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { set("plan", p.id); set("lead_count", p.leads); }}
                        style={{ ...S.planCard, ...(active ? S.planCardActive : {}) }}
                      >
                        {p.recommended && <div style={S.recBadge}>Recommended</div>}
                        <div style={S.planCardHeader}>
                          <div style={S.planLeft}>
                            <div style={{ ...S.planRadio, ...(active ? S.planRadioActive : {}) }}>
                              {active && <div style={S.planRadioDot} />}
                            </div>
                            <div>
                              <div style={S.planLabel}>{p.label}</div>
                              <div style={S.planTagline}>{p.tagline}</div>
                            </div>
                          </div>
                          <div style={S.planRight}>
                            <div style={S.planPrice}>{p.price}</div>
                            <div style={S.planLeads}>{p.leads} leads</div>
                          </div>
                        </div>
                        <div style={S.planIncludes}>
                          {p.includes.map(item => (
                            <div key={item} style={S.planIncludeItem}>
                              <span style={S.planCheckmark}>✓</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.plan && <p style={S.errText}>{errors.plan}</p>}
                <p style={S.paymentDisclaimer}>
                  Payment will be confirmed separately while Lemon Squeezy approval is pending.
                </p>
              </div>
            )}

            {/* ── STEP 2: Contact ───────────────────────────────────────── */}
            {step === 2 && (
              <div>
                <p style={S.stepIntro}>We use this to set up your account and deliver your leads.</p>
                <Field label="Full Name" error={errors.full_name}>
                  <input value={form.full_name} onChange={e => set("full_name", e.target.value)}
                    placeholder="Jane Smith" autoComplete="name"
                    style={{ ...S.input, ...(errors.full_name ? S.inputErr : {}) }} />
                </Field>
                <Field label="Business Email" error={errors.email}>
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                    placeholder="jane@company.com" autoComplete="email"
                    style={{ ...S.input, ...(errors.email ? S.inputErr : {}) }} />
                </Field>
                <Field label="Company Name" error={errors.company_name}>
                  <input value={form.company_name} onChange={e => set("company_name", e.target.value)}
                    placeholder="Acme Corp"
                    style={{ ...S.input, ...(errors.company_name ? S.inputErr : {}) }} />
                </Field>
                <Field label="Company Website" optional
                  hint="Helps us verify your company and tailor your lead list.">
                  <input value={form.website} onChange={e => set("website", e.target.value)}
                    placeholder="https://yourcompany.com" style={S.input} />
                </Field>
                <Field label="Your Country" optional>
                  <input value={form.country} onChange={e => set("country", e.target.value)}
                    placeholder="e.g. Colombia, United States" style={S.input} />
                </Field>
                <Field label="Your LinkedIn Profile" optional>
                  <input value={form.linkedin_url} onChange={e => set("linkedin_url", e.target.value)}
                    placeholder="https://linkedin.com/in/yourname" style={S.input} />
                </Field>
              </div>
            )}

            {/* ── STEP 3: Business ──────────────────────────────────────── */}
            {step === 3 && (
              <div>
                <p style={S.stepIntro}>
                  Help us understand what you sell and who your best customers are.
                  The more specific you are, the better quality leads you&apos;ll receive.
                </p>
                <Field label="What does your company sell?" error={errors.what_you_sell}
                  hint="The more specific you are, the better we can match leads to your exact product.">
                  <textarea value={form.what_you_sell} onChange={e => set("what_you_sell", e.target.value)}
                    rows={3} placeholder="We sell a B2B SaaS platform that helps logistics companies automate their invoicing process. Our tool connects to existing ERPs and eliminates manual data entry for the AR team."
                    style={{ ...S.textarea, ...(errors.what_you_sell ? S.inputErr : {}) }} />
                </Field>
                <Field label="What is your value proposition?" optional
                  hint="What specific outcome do you deliver? E.g. 'We help ops teams cut invoice processing time by 80%.'">
                  <textarea value={form.value_proposition} onChange={e => set("value_proposition", e.target.value)}
                    rows={2} placeholder="We help operations teams eliminate manual invoicing and recover 10+ hours per week — without changing their ERP."
                    style={S.textarea} />
                </Field>
                <Field label="Describe your target customer" optional
                  hint="What kind of company or person is your ideal buyer? Include industry, size, and role.">
                  <textarea value={form.ideal_customer} onChange={e => set("ideal_customer", e.target.value)}
                    rows={2} placeholder="Mid-market logistics companies (50–500 employees) with a finance or ops team that handles 100+ invoices per month and is still using spreadsheets."
                    style={S.textarea} />
                </Field>
              </div>
            )}

            {/* ── STEP 4: Targeting ─────────────────────────────────────── */}
            {step === 4 && (
              <div>
                <p style={S.stepIntro}>
                  Define exactly who we should find leads for. Targeting criteria directly
                  impact lead relevance — the more you give us, the better your list.
                </p>
                <Field label="Target Countries" optional
                  hint="We only find leads from these locations. Leave blank for global.">
                  <TagInput tags={form.target_countries} onChange={v => set("target_countries", v)}
                    placeholder="Type a country and press Enter" suggestions={COUNTRIES} />
                </Field>
                <Field label="Target Industries" optional
                  hint="Which industries are the best fit for your product?">
                  <TagInput tags={form.target_industries} onChange={v => set("target_industries", v)}
                    placeholder="Type an industry and press Enter" suggestions={INDUSTRIES} />
                </Field>
                <Field label="Target Company Size" optional
                  hint="How many employees should the target company have?">
                  <TagInput tags={form.target_company_sizes} onChange={v => set("target_company_sizes", v)}
                    placeholder="Select a range or type your own" suggestions={COMPANY_SIZES} />
                </Field>
                <Field label="Target Job Titles" optional
                  hint="What roles does your buyer typically hold? E.g. VP Sales, Head of Marketing.">
                  <TagInput tags={form.target_job_titles} onChange={v => set("target_job_titles", v)}
                    placeholder="e.g. Head of Sales, VP Marketing, COO" />
                </Field>
                <Field label="Buyer persona description" optional
                  hint="Describe their typical pain points, triggers, or what makes them a perfect buyer.">
                  <textarea value={form.buyer_persona} onChange={e => set("buyer_persona", e.target.value)}
                    rows={3} placeholder="They're usually overwhelmed with manual processes and have tried spreadsheets. They respond well to ROI-based messaging and want to see a specific use case before they commit to a demo."
                    style={S.textarea} />
                </Field>
                <Field label="Who should we exclude?" optional
                  hint="Company types, sizes, or competitor accounts to skip.">
                  <textarea value={form.exclusions} onChange={e => set("exclusions", e.target.value)}
                    rows={2} placeholder="Exclude startups with fewer than 10 employees, companies outside LATAM, and any company already using SAP or Oracle."
                    style={S.textarea} />
                </Field>
              </div>
            )}

            {/* ── STEP 5: Brand & delivery ──────────────────────────────── */}
            {step === 5 && (
              <div>
                <p style={S.stepIntro}>
                  Tell us where to send your lead list. Brand details are optional — used later
                  for branded reports, outreach previews, and credibility sections.
                </p>

                <div style={S.sectionDivider}>Delivery</div>
                <Field label="Delivery email address" error={errors.delivery_email}
                  hint="Your completed lead list will be sent to this address.">
                  <input type="email" value={form.delivery_email} onChange={e => set("delivery_email", e.target.value)}
                    placeholder="jane@company.com"
                    style={{ ...S.input, ...(errors.delivery_email ? S.inputErr : {}) }} />
                </Field>
                <Field label="Notes for the LeadLens team" optional
                  hint="Any other instructions — timeline, priority accounts, or context we should know.">
                  <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                    rows={2} placeholder="Prioritize warm referral accounts if possible. Avoid anyone we've already contacted. Focus on active job posters."
                    style={S.textarea} />
                </Field>

                <div style={S.sectionDivider}>
                  Outreach branding
                  <span style={{ fontWeight: 400, fontSize: "0.73rem", color: "#94a3b8", marginLeft: "0.4rem" }}>— optional</span>
                </div>
                <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "-0.75rem 0 1.25rem", lineHeight: 1.5 }}>
                  Add your logo, brand color, and sender info to personalize your reports and outreach previews.
                  You can always provide this later.
                </p>

                <Field label="Company logo" optional>
                  {form.logo_url ? (
                    <div style={S.logoPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.logo_url} alt="Logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain" }} />
                      <button type="button" onClick={() => set("logo_url", "")} style={S.removeBtn}>Remove</button>
                    </div>
                  ) : (
                    <>
                      <div style={S.dropZone} onClick={() => fileRef.current?.click()}>
                        {uploading
                          ? <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Uploading…</span>
                          : <>
                              <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>🖼</div>
                              <div style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.875rem" }}>Click to upload logo</div>
                              <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.2rem" }}>PNG, JPG, SVG · Max 5 MB</div>
                            </>
                        }
                      </div>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoFile} />
                      {errors.logo && <p style={S.errText}>{errors.logo}</p>}
                      <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0.5rem 0 0.3rem" }}>Or paste a URL:</p>
                      <input value={form.logo_url} onChange={e => set("logo_url", e.target.value)}
                        placeholder="https://yourcompany.com/logo.png" style={S.input} />
                    </>
                  )}
                </Field>

                <Field label="Brand color" optional hint="Primary brand color used in reports (hex code).">
                  <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
                    <input type="color" value={form.brand_color || "#0ea5e9"}
                      onChange={e => set("brand_color", e.target.value)}
                      style={{ width: 44, height: 44, border: "1px solid #e2e8f0", borderRadius: "0.5rem", cursor: "pointer", padding: "0.2rem" }} />
                    <input value={form.brand_color} onChange={e => set("brand_color", e.target.value)}
                      placeholder="#0ea5e9" maxLength={7} style={{ ...S.input, flex: 1 }} />
                  </div>
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                  <Field label="Sender name" optional>
                    <input value={form.sender_name} onChange={e => set("sender_name", e.target.value)}
                      placeholder="Jane Smith" style={S.input} />
                  </Field>
                  <Field label="Sender title" optional>
                    <input value={form.sender_title} onChange={e => set("sender_title", e.target.value)}
                      placeholder="Head of Sales" style={S.input} />
                  </Field>
                </div>
                <Field label="Sender email" optional>
                  <input type="email" value={form.sender_email} onChange={e => set("sender_email", e.target.value)}
                    placeholder="jane@company.com" style={S.input} />
                </Field>
                <Field label="One-sentence credibility statement" optional
                  hint={'Example: "Trusted by 50+ ecommerce brands in the US." — shown in outreach previews.'}>
                  <input value={form.credibility_statement} onChange={e => set("credibility_statement", e.target.value)}
                    placeholder="Trusted by 50+ logistics companies to automate their invoicing process."
                    style={S.input} />
                </Field>
                <Field label="Proof point or result" optional
                  hint={'Example: "Helped clients reduce prospecting time by 60%."'}>
                  <textarea value={form.proof_point} onChange={e => set("proof_point", e.target.value)}
                    rows={2} placeholder='"AcmeCo eliminated 12 hours of manual work per week and saved $40,000 in their first year."'
                    style={S.textarea} />
                </Field>
              </div>
            )}

            {/* ── STEP 6: Review & submit ───────────────────────────────── */}
            {step === 6 && (
              <div>
                <p style={S.stepIntro}>
                  Review your request below, then submit. Our team will begin preparing
                  your lead list within a few hours of receipt.
                </p>

                <div style={S.reviewCard}>
                  <div style={S.reviewSection}>
                    <div style={S.reviewSectionTitle}>Plan</div>
                    <ReviewRow label="Plan"  value={`${selectedPlan?.label} — ${selectedPlan?.leads} leads`} />
                    <ReviewRow label="Price" value={selectedPlan ? `${selectedPlan.price} · payment confirmed at delivery` : "—"} />
                  </div>
                  <div style={S.reviewSection}>
                    <div style={S.reviewSectionTitle}>Contact</div>
                    <ReviewRow label="Name"    value={form.full_name} />
                    <ReviewRow label="Email"   value={form.email} />
                    <ReviewRow label="Company" value={form.company_name} />
                    {form.website && <ReviewRow label="Website" value={form.website} />}
                  </div>
                  <div style={S.reviewSection}>
                    <div style={S.reviewSectionTitle}>Business</div>
                    <ReviewRow label="Product / service"
                      value={form.what_you_sell.length > 120
                        ? form.what_you_sell.slice(0, 120) + "…"
                        : form.what_you_sell} />
                  </div>
                  <div style={S.reviewSection}>
                    <div style={S.reviewSectionTitle}>Targeting</div>
                    <ReviewRow label="Countries"   value={form.target_countries.join(", ") || "—"} />
                    <ReviewRow label="Industries"  value={form.target_industries.join(", ") || "—"} />
                    <ReviewRow label="Job titles"  value={form.target_job_titles.join(", ") || "—"} />
                    {form.target_company_sizes.length > 0 && (
                      <ReviewRow label="Company size" value={form.target_company_sizes.join(", ")} />
                    )}
                  </div>
                  <div style={{ ...S.reviewSection, borderBottom: "none" }}>
                    <div style={S.reviewSectionTitle}>Delivery</div>
                    <ReviewRow label="Delivery email" value={form.delivery_email || form.email} />
                    <ReviewRow label="Logo"           value={form.logo_url ? "Uploaded ✓" : "—"} />
                    {form.sender_name && (
                      <ReviewRow label="Sender"
                        value={`${form.sender_name}${form.sender_title ? `, ${form.sender_title}` : ""}`} />
                    )}
                  </div>
                </div>

                <div style={S.editLinks}>
                  {([2, 3, 4, 5] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => { setStep(s); setErrors({}); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      style={S.editLink}>
                      Edit {STEP_LABELS[s - 1].toLowerCase()}
                    </button>
                  ))}
                </div>

                <div style={{ ...S.ackBox, ...(errors.acknowledged ? S.ackBoxErr : {}) }}>
                  <label style={S.ackLabel}>
                    <input type="checkbox" checked={form.acknowledged}
                      onChange={e => set("acknowledged", e.target.checked)} style={S.checkbox} />
                    <span>
                      I understand that LeadLens will prepare and deliver my lead list to{" "}
                      <strong>{form.delivery_email || form.email || "my email"}</strong>{" "}
                      within <strong>48 hours</strong>.
                    </span>
                  </label>
                  {errors.acknowledged && <p style={{ ...S.errText, margin: "0.4rem 0 0" }}>{errors.acknowledged}</p>}
                </div>

                {submitErr && <div style={S.errBox}>{submitErr}</div>}
              </div>
            )}

            {/* ── Navigation ────────────────────────────────────────────── */}
            {step < TOTAL_STEPS ? (
              <div style={S.navRow}>
                {step > 1
                  ? <button type="button" onClick={back} style={S.backBtn}>← Back</button>
                  : <div />
                }
                <button type="button" onClick={next} style={S.nextBtn}>
                  {step === 1
                    ? `Continue with ${selectedPlan?.label ?? "plan"} →`
                    : step === 5 ? "Review my request →"
                    : "Continue →"}
                </button>
              </div>
            ) : (
              <div style={S.submitArea}>
                <button type="submit" disabled={submitting}
                  style={submitting ? S.submitBtnOff : S.submitBtnFull}>
                  {submitting ? "Submitting…" : "Submit lead request →"}
                </button>
                <button type="button" onClick={back} style={S.backBtnFull}>
                  ← Go back and edit
                </button>
                <p style={S.paymentNote}>
                  Payment will be confirmed separately while Lemon Squeezy approval is pending.
                </p>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    minHeight: "100vh",
    background: "#f1f5f9",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  } as React.CSSProperties,

  // ── Nav ──
  topNav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.875rem 1.5rem", background: "#fff", borderBottom: "1px solid #e2e8f0",
    position: "sticky" as const, top: 0, zIndex: 10,
  } as React.CSSProperties,
  navBrand: { display: "flex", alignItems: "center", gap: "0.5rem" } as React.CSSProperties,
  logoMark: {
    width: 32, height: 32, background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
    borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: "1rem",
    display: "flex", alignItems: "center", justifyContent: "center",
  } as React.CSSProperties,
  brandName: { fontWeight: 800, fontSize: "1rem", color: "#0f172a", letterSpacing: "-0.02em" } as React.CSSProperties,
  aiBadge: {
    fontSize: "0.6rem", fontWeight: 800, background: "#e0f2fe", color: "#0369a1",
    borderRadius: "999px", padding: "0.15rem 0.45rem", letterSpacing: "0.06em",
  } as React.CSSProperties,
  signInLink: { fontSize: "0.8rem", color: "#64748b", textDecoration: "none", fontFamily: "inherit" } as React.CSSProperties,

  // ── Hero ──
  hero: { background: "#0f172a", padding: "2.75rem 1.5rem 2.25rem", textAlign: "center" as const } as React.CSSProperties,
  heroInner: { maxWidth: 560, margin: "0 auto" } as React.CSSProperties,
  heroH1: {
    color: "#f8fafc", fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800,
    letterSpacing: "-0.03em", lineHeight: 1.15, margin: "0 0 0.875rem",
  } as React.CSSProperties,
  heroSub: { color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.65, margin: "0 0 1.5rem" } as React.CSSProperties,
  trustPills: { display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" as const } as React.CSSProperties,
  trustPill: {
    fontSize: "0.72rem", color: "#94a3b8", background: "#1e293b", border: "1px solid #334155",
    borderRadius: "999px", padding: "0.3rem 0.7rem", fontWeight: 500,
  } as React.CSSProperties,

  // ── Card ──
  formArea: { display: "flex", justifyContent: "center", padding: "0 1rem 5rem" } as React.CSSProperties,
  card: {
    width: "100%", maxWidth: 600, background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: "1.25rem", padding: "1.75rem 2rem", boxShadow: "0 8px 48px rgba(0,0,0,0.07)",
  } as React.CSSProperties,

  // ── Progress ──
  progressWrapper: { marginBottom: "0.25rem" } as React.CSSProperties,
  stepMeta: {
    fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8",
    letterSpacing: "0.06em", textTransform: "uppercase" as const,
  } as React.CSSProperties,
  stepMetaRight: { fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8" } as React.CSSProperties,
  progressTrack: { height: 4, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" } as React.CSSProperties,
  progressFill: {
    height: "100%", background: "linear-gradient(90deg,#0ea5e9,#0284c7)",
    borderRadius: 999, transition: "width 0.3s ease",
  } as React.CSSProperties,
  h2: {
    color: "#0f172a", fontSize: "1.25rem", fontWeight: 800,
    margin: "1.25rem 0 0", letterSpacing: "-0.025em", lineHeight: 1.2,
  } as React.CSSProperties,
  stepIntro: { color: "#64748b", fontSize: "0.875rem", lineHeight: 1.6, margin: "0 0 1.5rem" } as React.CSSProperties,

  // ── Fields ──
  label: { fontSize: "0.82rem", fontWeight: 700, color: "#374151", letterSpacing: "0.01em" } as React.CSSProperties,
  optional: { fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 } as React.CSSProperties,
  hint: { color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 0.4rem", lineHeight: 1.45 } as React.CSSProperties,
  input: {
    display: "block", width: "100%", padding: "0.75rem 0.875rem",
    border: "1px solid #e2e8f0", borderRadius: "0.625rem", fontSize: "0.9rem",
    color: "#0f172a", background: "#fff", outline: "none",
    boxSizing: "border-box" as const, fontFamily: "inherit", WebkitAppearance: "none" as const,
  } as React.CSSProperties,
  inputErr: { borderColor: "#fca5a5" } as React.CSSProperties,
  textarea: {
    display: "block", width: "100%", padding: "0.75rem 0.875rem",
    border: "1px solid #e2e8f0", borderRadius: "0.625rem", fontSize: "0.9rem",
    color: "#0f172a", background: "#fff", outline: "none",
    boxSizing: "border-box" as const, fontFamily: "inherit",
    resize: "vertical" as const, lineHeight: 1.55, WebkitAppearance: "none" as const,
  } as React.CSSProperties,
  errText: { color: "#dc2626", fontSize: "0.75rem", margin: "0.3rem 0 0" } as React.CSSProperties,
  errBox: {
    background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.625rem",
    padding: "0.875rem 1rem", color: "#dc2626", fontSize: "0.82rem",
    marginTop: "1rem", lineHeight: 1.5,
  } as React.CSSProperties,

  // ── Plan cards ──
  planList: { display: "flex", flexDirection: "column" as const, gap: "0.75rem", marginBottom: "1rem" } as React.CSSProperties,
  planCard: {
    width: "100%", border: "2px solid #e2e8f0", borderRadius: "0.875rem",
    padding: "1rem 1.125rem", background: "#fff", cursor: "pointer",
    textAlign: "left" as const, fontFamily: "inherit", position: "relative" as const,
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  } as React.CSSProperties,
  planCardActive: {
    borderColor: "#0ea5e9", boxShadow: "0 0 0 3px rgba(14,165,233,0.12)", background: "#f0f9ff",
  } as React.CSSProperties,
  recBadge: {
    position: "absolute" as const, top: -11, left: "1.125rem",
    background: "#0f172a", color: "#fff", fontSize: "0.62rem", fontWeight: 700,
    padding: "0.2rem 0.6rem", borderRadius: "999px", letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  planCardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem",
  } as React.CSSProperties,
  planLeft: { display: "flex", alignItems: "center", gap: "0.75rem" } as React.CSSProperties,
  planRight: { textAlign: "right" as const, flexShrink: 0 } as React.CSSProperties,
  planRadio: {
    width: 18, height: 18, borderRadius: "50%", border: "2px solid #cbd5e1",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  } as React.CSSProperties,
  planRadioActive: { borderColor: "#0ea5e9" } as React.CSSProperties,
  planRadioDot: { width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9" } as React.CSSProperties,
  planLabel: { fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", lineHeight: 1.2 } as React.CSSProperties,
  planTagline: { fontSize: "0.72rem", color: "#64748b", marginTop: "0.1rem" } as React.CSSProperties,
  planPrice: {
    fontWeight: 800, fontSize: "1.35rem", color: "#0f172a",
    letterSpacing: "-0.03em", lineHeight: 1,
  } as React.CSSProperties,
  planLeads: { fontSize: "0.75rem", color: "#0ea5e9", fontWeight: 700, marginTop: "0.15rem" } as React.CSSProperties,
  planIncludes: { marginTop: "0.625rem", paddingLeft: "2.25rem" } as React.CSSProperties,
  planIncludeItem: {
    display: "flex", alignItems: "flex-start", gap: "0.35rem",
    fontSize: "0.78rem", color: "#475569", lineHeight: 1.5, marginBottom: "0.15rem",
  } as React.CSSProperties,
  planCheckmark: {
    color: "#10b981", fontWeight: 700, flexShrink: 0, fontSize: "0.72rem", marginTop: "0.1rem",
  } as React.CSSProperties,
  paymentDisclaimer: {
    fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" as const, margin: "0.25rem 0 0",
  } as React.CSSProperties,

  // ── Divider ──
  sectionDivider: {
    fontSize: "0.8rem", fontWeight: 700, color: "#374151",
    borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem",
    marginBottom: "1.25rem", letterSpacing: "0.01em",
  } as React.CSSProperties,

  // ── Logo ──
  dropZone: {
    border: "2px dashed #bfdbfe", borderRadius: "0.875rem", padding: "1.5rem 1rem",
    textAlign: "center" as const, cursor: "pointer", background: "#f0f9ff",
  } as React.CSSProperties,
  logoPreview: {
    display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1rem",
    border: "1px solid #e2e8f0", borderRadius: "0.75rem", background: "#f8fafc",
  } as React.CSSProperties,
  removeBtn: {
    background: "none", border: "1px solid #fca5a5", color: "#dc2626",
    borderRadius: "0.4rem", padding: "0.3rem 0.65rem", fontSize: "0.75rem",
    cursor: "pointer", fontFamily: "inherit",
  } as React.CSSProperties,

  // ── Acknowledgment ──
  ackBox: {
    background: "#f0f9ff", border: "1px solid #bae6fd",
    borderRadius: "0.75rem", padding: "1rem", marginBottom: "0.5rem",
  } as React.CSSProperties,
  ackBoxErr: { borderColor: "#fca5a5", background: "#fff7f7" } as React.CSSProperties,
  ackLabel: {
    display: "flex", alignItems: "flex-start", gap: "0.75rem",
    fontSize: "0.82rem", color: "#0369a1", lineHeight: 1.55, cursor: "pointer",
  } as React.CSSProperties,
  checkbox: {
    width: 18, height: 18, marginTop: "0.1rem", flexShrink: 0,
    cursor: "pointer", accentColor: "#0ea5e9",
  } as React.CSSProperties,

  // ── Review step ──
  reviewCard: {
    border: "1px solid #e2e8f0", borderRadius: "0.875rem",
    overflow: "hidden", marginBottom: "1.125rem",
  } as React.CSSProperties,
  reviewSection: {
    padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9",
  } as React.CSSProperties,
  reviewSectionTitle: {
    fontSize: "0.67rem", fontWeight: 700, color: "#94a3b8",
    textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "0.5rem",
  } as React.CSSProperties,
  editLinks: { display: "flex", flexWrap: "wrap" as const, gap: "0.5rem", marginBottom: "1.25rem" } as React.CSSProperties,
  editLink: {
    background: "none", border: "1px solid #e2e8f0", borderRadius: "999px",
    padding: "0.3rem 0.75rem", fontSize: "0.73rem", color: "#0ea5e9",
    cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
  } as React.CSSProperties,

  // ── Nav buttons ──
  navRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginTop: "1.75rem", gap: "0.75rem",
  } as React.CSSProperties,
  backBtn: {
    background: "transparent", border: "1px solid #e2e8f0", color: "#64748b",
    borderRadius: "0.625rem", padding: "0.8rem 1.25rem", fontSize: "0.875rem",
    fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 44,
  } as React.CSSProperties,
  nextBtn: {
    background: "#0ea5e9", border: "none", color: "#fff",
    borderRadius: "0.625rem", padding: "0.8rem 1.5rem", fontSize: "0.875rem",
    fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto", minHeight: 44,
  } as React.CSSProperties,
  submitArea: {
    display: "flex", flexDirection: "column" as const, gap: "0.625rem", marginTop: "1.25rem",
  } as React.CSSProperties,
  submitBtnFull: {
    width: "100%", padding: "0.9rem 1.5rem", background: "#0f172a", border: "none",
    color: "#fff", borderRadius: "0.75rem", fontSize: "0.95rem", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", minHeight: 48,
  } as React.CSSProperties,
  submitBtnOff: {
    width: "100%", padding: "0.9rem 1.5rem", background: "#94a3b8", border: "none",
    color: "#fff", borderRadius: "0.75rem", fontSize: "0.95rem", fontWeight: 700,
    cursor: "not-allowed", fontFamily: "inherit", minHeight: 48,
  } as React.CSSProperties,
  backBtnFull: {
    width: "100%", padding: "0.75rem 1.5rem", background: "transparent",
    border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "0.75rem",
    fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", textAlign: "center" as const, minHeight: 44,
  } as React.CSSProperties,
  paymentNote: {
    fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" as const, margin: 0,
  } as React.CSSProperties,
};
