// ─── Portable deliverable — safe serialization primitives + whitelist ─────────
// The portable HTML artifact is a STATIC customer export: anything embedded can
// be read by the recipient. So the only data that ever crosses into it is the
// already-curated DeliverableViewModel, further reduced here to an explicit
// customer-safe whitelist and passed through hardened sanitizers. There is no
// raw snapshot, no provider/admin metadata, no secrets, no runtime call.

import type { DeliverableViewModel } from "../deliverable-view-model";

export const PORTABLE_FORMAT_VERSION = 1;

/** HTML-escape any text embedded into the document body. */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Allow only http/https links; everything else (javascript:, data:, etc.) → null. */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u || typeof u !== "string") return null;
  try {
    const p = new URL(u.trim());
    return p.protocol === "http:" || p.protocol === "https:" ? p.href : null;
  } catch { return null; }
}

/** JSON for an inline <script> block: neutralize </script>, HTML-significant
 *  characters, and the line/para separators that break JS string parsing. */
export function jsonForScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** A filesystem-safe, premium filename stem for the client (no path separators). */
export function safeFilename(name: string): string {
  return (name || "Portfolio").normalize("NFKD").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "Portfolio";
}

/** The embedded runtime payload — deliberately tiny: only what the in-file JS
 *  needs (the two CSV exports + their filenames). All display content is already
 *  pre-rendered as escaped HTML, so the model itself is NOT shipped as JSON. */
export interface PortableRuntimePayload {
  formatVersion: number;
  portfolioCsv: string;
  evidenceCsv: string;
  portfolioCsvName: string;
  evidenceCsvName: string;
  hasEvidenceCsv: boolean;
}

/** Defensive scan: keys/markers that must NEVER appear in a portable artifact. */
export const FORBIDDEN_MARKERS: string[] = [
  "report_json", "processed_leads", "service_role", "SERVICE_ROLE",
  "supabase", "SUPABASE", "anon_key", "apikey", "api_key", "secret",
  "_vault", "llm_judge", "judge_", "calibration", "provider_", "access_token",
  "eyJ", // JWT prefix
];

/** True when `html` is free of every forbidden marker (case-sensitive list). */
export function scanForSecrets(html: string): { clean: boolean; hits: string[] } {
  const hits = FORBIDDEN_MARKERS.filter((m) => html.includes(m));
  return { clean: hits.length === 0, hits };
}

/** Whitelisted meta echoed at the top of the document (all optional, escaped
 *  at render time). No customer_ref/email, no internal ids. */
export function portableMeta(vm: DeliverableViewModel) {
  return {
    client: vm.meta.client,
    market: vm.meta.market,
    tierLabel: vm.meta.tierLabel,
    generatedLabel: vm.meta.generatedLabel,
    language: vm.meta.language,
  };
}
