import type { CSSProperties } from "react";
import { C, font } from "@/lib/commercial/theme";

// Shared premium auth-card styling for /signup and /verify (one consistent surface).
export const authCardStyles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: font, padding: "2rem", color: C.ink },
  card: { width: "100%", maxWidth: 430, background: C.card, border: `1px solid ${C.line}`, borderRadius: "1.1rem", padding: "2.5rem", boxShadow: "0 4px 28px rgba(15,23,42,.06)" },
  logoBox: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "#fff", fontWeight: 800, fontSize: "1.2rem", borderRadius: "0.7rem", marginBottom: "1rem" },
  eyebrow: { fontSize: ".7rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.skyInk, marginBottom: ".55rem" },
  h1: { fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 .55rem" },
  sub: { color: C.sub, fontSize: ".92rem", lineHeight: 1.6, margin: 0 },
  label: { display: "block", marginBottom: "1rem" },
  labelText: { display: "block", fontSize: ".8rem", fontWeight: 700, color: C.body, marginBottom: ".4rem" },
  input: { width: "100%", boxSizing: "border-box", padding: ".8rem .9rem", fontSize: ".95rem", fontFamily: font, color: C.ink, background: C.card, border: `1px solid ${C.line}`, borderRadius: ".65rem", outline: "none", transition: "border-color .15s, box-shadow .15s" },
  errorBox: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: ".85rem", borderRadius: ".6rem", padding: ".7rem .85rem", marginBottom: "1rem", lineHeight: 1.5 },
  btn: { width: "100%", padding: ".85rem 1rem", fontSize: ".95rem", fontWeight: 700, fontFamily: font, color: "#fff", background: C.sky, border: "none", borderRadius: ".7rem", cursor: "pointer", transition: "background .15s, box-shadow .15s" },
  btnDisabled: { width: "100%", padding: ".85rem 1rem", fontSize: ".95rem", fontWeight: 700, fontFamily: font, color: "#fff", background: C.faint, border: "none", borderRadius: ".7rem", cursor: "not-allowed" },
  link: { color: C.skyInk, fontWeight: 600, textDecoration: "none" },
  footer: { textAlign: "center", color: C.muted, fontSize: ".82rem", marginTop: "1.3rem" },
};
