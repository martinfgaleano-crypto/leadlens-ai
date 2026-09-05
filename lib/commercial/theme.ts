// Shared visual tokens for the commercial activation journey. Tokens only (no JSX) so every
// surface — /get-started, /pricing, /signup, /verify, /checkout/continue, /success — inherits one
// restrained, premium palette and type scale consistent with the LeadLens landing.

export const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

export const C = {
  ink: "#0f172a",
  body: "#334155",
  sub: "#475569",
  muted: "#94a3b8",
  faint: "#cbd5e1",
  line: "#e2e8f0",
  lineSoft: "#f1f5f9",
  bg: "#f8fafc",
  card: "#ffffff",
  sky: "#0ea5e9",
  skyInk: "#0284c7",
  skySoft: "#e0f2fe",
  skyLine: "#bae6fd",
} as const;

/** Focus ring used on every interactive control (accessibility). */
export const focusRing = "0 0 0 3px rgba(14,165,233,.35)";
