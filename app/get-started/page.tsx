"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { C, font, focusRing } from "@/lib/commercial/theme";

function track(event: string, meta: Record<string, string> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, ...meta }), keepalive: true }); } catch { /* never block */ }
}

export default function GetStartedPage() {
  const router = useRouter();
  useEffect(() => track("get_started_viewed"), []);

  function choose(path: "one_time" | "ongoing") {
    track("commercial_path_selected", { commercial_path: path });
    router.push(`/pricing?commercial_path=${path}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.5rem 1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "72rem", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-.02em", color: C.ink, textDecoration: "none" }}>LeadLens</Link>
        <Link href="/login" style={{ fontSize: ".85rem", fontWeight: 600, color: C.skyInk, textDecoration: "none" }}>Sign in</Link>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ maxWidth: "56rem", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "2.75rem" }}>
            <p style={{ fontSize: ".78rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.skyInk, margin: "0 0 .9rem" }}>Account Opportunity Intelligence</p>
            <h1 style={{ fontSize: "clamp(1.7rem,4.4vw,2.5rem)", fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.12, margin: 0 }}>How would you like to use LeadLens?</h1>
            <p style={{ color: C.sub, fontSize: "1.02rem", lineHeight: 1.6, margin: ".9rem auto 0", maxWidth: "34rem" }}>
              LeadLens helps you decide which accounts deserve attention now — with the evidence behind every decision. Choose where to start.
            </p>
          </div>

          <div className="ll-gs-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <PathCard
              eyebrow="One-time"
              title="Analyze an opportunity now"
              body="Evaluate a defined set of accounts, understand the market around them, and see where commercial attention is justified — as a bounded, point-in-time study."
              cta="Explore one-time intelligence"
              onClick={() => choose("one_time")}
            />
            <PathCard
              eyebrow="Ongoing"
              title="Keep opportunities under observation"
              body="Continuously reassess your accounts, detect what changed, and keep commercial priorities current — with Account Memory that builds over time."
              cta="Explore ongoing intelligence"
              featured
              onClick={() => choose("ongoing")}
            />
          </div>

          <p style={{ textAlign: "center", color: C.muted, fontSize: ".82rem", marginTop: "1.75rem" }}>
            You can see full pricing before creating an account.
          </p>
        </div>
      </main>

      <style>{`
        @media (max-width: 720px) { .ll-gs-grid { grid-template-columns: 1fr !important; } }
        .ll-path-card { transition: border-color .15s, box-shadow .15s, transform .15s; }
        .ll-path-card:hover { border-color: ${C.sky} !important; box-shadow: 0 10px 30px rgba(2,132,199,.10); transform: translateY(-2px); }
        .ll-path-card:focus-visible { outline: none; box-shadow: ${focusRing}; }
      `}</style>
    </div>
  );
}

function PathCard({ eyebrow, title, body, cta, onClick, featured }: { eyebrow: string; title: string; body: string; cta: string; onClick: () => void; featured?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="ll-path-card"
      style={{
        textAlign: "left", cursor: "pointer", fontFamily: font,
        background: C.card, border: `1px solid ${featured ? C.skyLine : C.line}`, borderRadius: "1.1rem",
        padding: "1.9rem 1.75rem", display: "flex", flexDirection: "column", gap: ".85rem", minHeight: "16rem",
      }}
    >
      <span style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: featured ? C.skyInk : C.muted }}>{eyebrow}</span>
      <span style={{ fontSize: "1.28rem", fontWeight: 800, letterSpacing: "-.02em", color: C.ink, lineHeight: 1.2 }}>{title}</span>
      <span style={{ fontSize: ".95rem", color: C.sub, lineHeight: 1.6, flex: 1 }}>{body}</span>
      <span style={{ marginTop: ".4rem", display: "inline-flex", alignItems: "center", gap: ".4rem", fontWeight: 700, fontSize: ".92rem", color: C.skyInk }}>
        {cta} <span aria-hidden>→</span>
      </span>
    </button>
  );
}
