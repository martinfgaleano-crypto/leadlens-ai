import type { Metadata } from "next";
import Link from "next/link";

// Public, synthetic, frontend-only Account Brief sample. No auth, no database, no
// providers — every company/event/source is illustrative. It exists so the
// homepage stays concise while a full-depth reasoning example is one click away.
// Distinct from the owner-bound /results/[jobId]/brief (never touched here).

export const metadata: Metadata = {
  title: "Account Brief — Sample | LeadLens",
  description: "A complete illustrative Account Brief: what changed, the evidence and counterevidence, what to validate, and the commercial decision.",
};

const NAVY = "#0f172a";
const ACCENT = "#0284c7";

const EVENTS = [
  { date: "9 days ago", title: "Signed a regional distribution agreement", note: "Announced in a company press release." },
  { date: "12 days ago", title: "Opened two new distribution sites", note: "Covered by an industry publication." },
  { date: "15 days ago", title: "Posted four operations roles", note: "Regional operations hiring on the careers page." },
];
const SOURCES = [
  { type: "Company announcement", note: "distribution agreement", age: "9d", rel: "Direct", color: "#0284c7" },
  { type: "Industry publication", note: "new distribution sites", age: "12d", rel: "Corroborating", color: "#15803d" },
  { type: "Careers page", note: "operations roles", age: "15d", rel: "Context", color: "#94a3b8" },
];
const LIMITERS = [
  { limit: "Procurement ownership not confirmed", validate: "Confirm whether regional purchasing is centralized at group level." },
  { limit: "Decision scope (corporate vs regional) unresolved", validate: "Check whether the new sites share the group supplier network." },
];
const VALIDATE = [
  "Confirm whether procurement is centralized at group level.",
  "Check whether the new sites use the same supplier network.",
  "Verify the expansion affects your target category.",
];
const LADDER = ["Observed", "Confirmed", "Corroborated"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: ".68rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#64748b", marginBottom: ".9rem" }}>{children}</div>;
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: "1rem", padding: "1.5rem 1.6rem", ...style }}>{children}</div>;
}
function Strength({ label, val }: { label: string; val: string }) {
  const c = val === "Strong" ? "#0f172a" : val === "Moderate" || val === "Emerging" ? "#475569" : "#94a3b8";
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: ".62rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#94a3b8", marginBottom: ".2rem" }}>{label}</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: c }}>{val}</div>
    </div>
  );
}

export default function SamplePage() {
  const wrap: React.CSSProperties = { maxWidth: "52rem", margin: "0 auto", padding: "0 1.25rem" };
  return (
    <div style={{ background: "#f6f8fb", minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: NAVY }}>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #e8f4fd", background: "rgba(255,255,255,.9)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".8rem 1.25rem" }}>
          <Link href="/" style={{ textDecoration: "none", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-.03em", color: NAVY }}>Lead<span style={{ color: ACCENT }}>Lens</span></Link>
          <Link href="/" style={{ textDecoration: "none", color: "#64748b", fontSize: ".85rem", fontWeight: 600 }}>← Back to LeadLens</Link>
        </div>
      </div>

      <div style={{ ...wrap, padding: "2.25rem 1.25rem 4rem" }}>
        {/* Brief header (navy) */}
        <div style={{ background: "linear-gradient(160deg,#0b1220,#12314f 60%,#0c4a6e)", color: "#fff", borderRadius: "1.15rem", padding: "1.75rem 1.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap", marginBottom: ".7rem" }}>
            <span style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#7dd3fc" }}>Account Brief</span>
            <span style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#7dd3fc", background: "rgba(125,211,252,.14)", border: "1px solid rgba(125,211,252,.3)", borderRadius: 999, padding: ".15rem .55rem" }}>Illustrative sample</span>
          </div>
          <h1 style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 .4rem" }}>Northstar Logistics</h1>
          <div style={{ color: "#cbd8e8", fontSize: ".9rem", marginBottom: "1rem" }}>Mid-market logistics · regional freight · United States (Midwest)</div>
          <div style={{ display: "flex", alignItems: "center", gap: ".7rem", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", background: "rgba(56,189,248,.16)", border: "1px solid rgba(56,189,248,.35)", color: "#7dd3fc", borderRadius: 999, padding: ".3rem .8rem", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8" }} />Prioritize
            </span>
            <span style={{ color: "#94a3b8", fontSize: ".8rem" }}>Evidence refreshed 9d ago · decision scope: Regional</span>
          </div>
        </div>

        {/* Opportunity thesis */}
        <Card style={{ marginTop: "1.1rem", borderLeft: `3px solid ${ACCENT}` }}>
          <SectionLabel>Opportunity thesis</SectionLabel>
          <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "#1e293b", margin: 0 }}>
            Northstar is expanding regional distribution while adding operations capacity — a combination that plausibly increases supplier and tooling needs. The change is recent and corroborated, but <strong>no procurement event is confirmed</strong>, so this is a fit-and-timing thesis to validate, not a confirmed buying signal.
          </p>
        </Card>

        {/* What changed — timeline */}
        <Card style={{ marginTop: "1.1rem" }}>
          <SectionLabel>What changed</SectionLabel>
          {EVENTS.map((e, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", columnGap: ".8rem" }}>
              <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: i === 0 ? ACCENT : "#cbd5e1", marginTop: "3px", zIndex: 1, boxShadow: "0 0 0 3px #fff" }} />
                {i < EVENTS.length - 1 && <span style={{ position: "absolute", top: 15, bottom: "-.9rem", width: 2, background: "#e4ebf3" }} />}
              </div>
              <div style={{ paddingBottom: i < EVENTS.length - 1 ? "1rem" : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: ".5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".95rem", fontWeight: 700, color: NAVY }}>{e.title}</span>
                  <span style={{ fontSize: ".78rem", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>{e.date}</span>
                </div>
                <div style={{ fontSize: ".85rem", color: "#64748b", marginTop: ".15rem" }}>{e.note}</div>
              </div>
            </div>
          ))}
        </Card>

        {/* Evidence + counterevidence */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1.1rem", marginTop: "1.1rem" }}>
          <Card>
            <SectionLabel>Supported by</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: ".35rem", marginBottom: ".9rem" }}>
              {LADDER.map((step, i) => (
                <span key={step} style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}>
                  <span style={{ fontSize: ".72rem", fontWeight: 700, color: NAVY }}>{step}</span>
                  {i < 2 && <span style={{ color: ACCENT }}>→</span>}
                </span>
              ))}
            </div>
            {SOURCES.map((src, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", padding: ".4rem 0", borderTop: i === 0 ? "none" : "1px solid #f4f7fa" }}>
                <span style={{ fontSize: ".82rem", minWidth: 0 }}>
                  <span style={{ fontSize: ".6rem", fontStyle: "italic", color: "#94a3b8", marginRight: ".3rem" }}>illustrative</span>
                  <span style={{ fontWeight: 600, color: NAVY }}>{src.type}</span> <span style={{ color: "#64748b" }}>— {src.note}</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", flexShrink: 0 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: ".3rem", fontSize: ".64rem", fontWeight: 700, color: src.color }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: src.color }} />{src.rel}</span>
                  <span style={{ color: "#94a3b8", fontSize: ".72rem" }}>{src.age}</span>
                </span>
              </div>
            ))}
          </Card>
          <Card>
            <SectionLabel>Limited by</SectionLabel>
            {LIMITERS.map((l, i) => (
              <div key={i} style={{ padding: i === 0 ? "0 0 .7rem" : ".7rem 0", borderTop: i === 0 ? "none" : "1px solid #f4f7fa" }}>
                <div style={{ fontSize: ".9rem", fontWeight: 600, color: "#334155", lineHeight: 1.4 }}>{l.limit}</div>
                <div style={{ display: "flex", gap: ".4rem", marginTop: ".3rem", fontSize: ".82rem", color: "#0369a1", lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>Validate →</span><span>{l.validate}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Fit / Timing / Evidence */}
        <Card style={{ marginTop: "1.1rem" }}>
          <SectionLabel>Fit · Timing · Evidence</SectionLabel>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Strength label="Fit" val="Strong" />
            <Strength label="Timing" val="Strong" />
            <Strength label="Evidence" val="Strong" />
          </div>
          <p style={{ fontSize: ".85rem", color: "#64748b", margin: ".9rem 0 0", lineHeight: 1.55 }}>
            Operations-led regional growth aligns with the commercial context, and the change is recent — but structural fit is not the same as a confirmed procurement cycle.
          </p>
        </Card>

        {/* What to validate */}
        <Card style={{ marginTop: "1.1rem" }}>
          <SectionLabel>What to validate</SectionLabel>
          {VALIDATE.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: ".55rem", fontSize: ".92rem", color: "#334155", padding: ".3rem 0", lineHeight: 1.5 }}>
              <span style={{ color: ACCENT, fontWeight: 700, flexShrink: 0 }}>→</span>{v}
            </div>
          ))}
        </Card>

        {/* Decision endpoint */}
        <div style={{ marginTop: "1.1rem", background: "linear-gradient(160deg,#0b1220,#12314f 70%,#0c4a6e)", color: "#fff", borderRadius: "1.15rem", padding: "1.6rem 1.9rem" }}>
          <div style={{ fontSize: ".68rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#7dd3fc", marginBottom: ".7rem" }}>Commercial decision</div>
          <div style={{ display: "flex", alignItems: "center", gap: ".7rem", flexWrap: "wrap", marginBottom: ".6rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", background: "rgba(56,189,248,.16)", border: "1px solid rgba(56,189,248,.35)", color: "#7dd3fc", borderRadius: 999, padding: ".3rem .85rem", fontSize: ".8rem", fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8" }} />Prioritize
            </span>
            <span style={{ color: "#cbd8e8", fontSize: ".9rem" }}>Recent, corroborated expansion with strong fit and timing.</span>
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.45 }}>Next: validate regional procurement ownership before outreach.</div>
        </div>

        {/* Closing CTA */}
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-.02em", marginBottom: ".5rem" }}>See what deserves your attention.</div>
          <p style={{ color: "#64748b", fontSize: ".92rem", margin: "0 auto 1.25rem", maxWidth: "32rem" }}>This is one synthetic account. LeadLens builds the same reasoning across your market.</p>
          <div style={{ display: "flex", gap: ".75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" style={{ display: "inline-block", background: "#0ea5e9", color: "#fff", borderRadius: ".75rem", padding: ".85rem 1.7rem", fontWeight: 700, fontSize: ".95rem", textDecoration: "none" }}>Get started →</Link>
            <Link href="/#pricing" style={{ display: "inline-block", background: "#fff", color: "#0284c7", border: "1.5px solid #bae6fd", borderRadius: ".75rem", padding: ".85rem 1.6rem", fontWeight: 700, fontSize: ".95rem", textDecoration: "none" }}>See pricing</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
