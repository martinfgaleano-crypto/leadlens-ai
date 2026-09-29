#!/usr/bin/env node
/**
 * Pilot 2 — compose all FOUR canonical tiers from ONE real intelligence foundation (§47-48).
 * Reads a KEEP-mode run (runId + owner token) produced by accept-one-time-deliverable-v2_4.mts, resolves
 * the delivered document through the EXACT production viewer path (deliverableForViewer), and renders
 * Preview/Brief/Portfolio/Premium with the canonical V2.4 renderer (renderPdfBuffer). No new design, no
 * manual PDF assembly (§8/§66). Consumes NO credit (delivery is free). Writes a redacted validity summary.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!has(env, key)) { console.error(`BLOCKED: ${key} missing`); process.exit(3); }

const OUT = process.env.LEADLENS_RENDER_OUT || "/private/tmp/pilot2";
mkdirSync(OUT, { recursive: true });

const { deliverableForViewer } = await import("@/lib/delivery-system/server/deliverable-for-viewer");
const { toPresentationModel } = await import("@/lib/delivery-system/presentation-model");
const { renderPdfBuffer } = await import("@/lib/delivery-system/renderers/pdf");

// Locate the newest keep-*.json (runId + owner token) in OUT, or take runId+token from env.
let runId = process.env.PILOT2_RUN_ID ?? "";
let token = process.env.PILOT2_TOKEN ?? "";
if (!runId || !token) {
  const keep = readdirSync(OUT).filter((f) => f.startsWith("keep-") && f.endsWith(".json")).sort();
  if (!keep.length) { console.error("BLOCKED: no keep-*.json found in OUT and no PILOT2_RUN_ID/TOKEN set"); process.exit(3); }
  const k = JSON.parse(readFileSync(`${OUT}/${keep[keep.length - 1]}`, "utf8"));
  runId = k.runId; token = k.tokenA;
  console.log(`using keep file :: ${keep[keep.length - 1]} runId=${runId}`);
}

const viewer = await deliverableForViewer(runId, token);
if (!viewer.ok) { console.error(`BLOCKED: deliverable did not resolve (status=${(viewer as any).status}) — token may have expired; re-run KEEP`); process.exit(2); }

// Compose the four canonical tiers from the SAME document (server-authoritative tier is ignored here on
// purpose — we deliberately render every tier the ONE foundation supports, per §47-48 nesting).
const TIERS: Array<["preview" | "brief" | "intelligence" | "premium", string]> = [
  ["preview", "Preview"], ["brief", "Brief"], ["intelligence", "Portfolio"], ["premium", "Premium"],
];
const summary: any = { runId, tier_pdfs: [], nesting: {} };
const idsByTier: Record<string, string[]> = {};
for (const [tier, label] of TIERS) {
  const pm = toPresentationModel(viewer.document, tier, "pdf");
  const buf = renderPdfBuffer(pm);
  const path = `${OUT}/LeadLens_AmorDeGea_Pilot2_${label}.pdf`;
  writeFileSync(path, buf);
  const accounts = pm.document.accounts;
  idsByTier[label] = accounts.map((a: any) => a.id);
  const ok = buf.subarray(0, 5).toString("latin1") === "%PDF-" && buf.length > 5000;
  console.log(`${ok ? "ok" : "FAIL"} ${label.padEnd(10)} accounts=${accounts.length} bytes=${buf.length} decisions=${JSON.stringify(accounts.reduce((m: any, a: any) => { m[a.decision] = (m[a.decision] ?? 0) + 1; return m; }, {}))} -> ${path}`);
  summary.tier_pdfs.push({ tier: label, accounts: accounts.length, bytes: buf.length, ok,
    companies: accounts.map((a: any) => ({ company: a.company, geography: a.geography ?? null, decision: a.decision, opportunityType: a.opportunityType ?? null,
      fit: a.dimensions?.find((d: any) => /fit/i.test(d.label))?.value ?? null, timing: a.dimensions?.find((d: any) => /timing/i.test(d.label))?.value ?? null,
      evidence: a.evidence?.strength ?? null, sources: a.sources?.length ?? 0, dated: a.evidence?.datedCount ?? 0, hasCounter: (a.counterSignals?.length ?? 0) > 0, hasNextStep: Boolean(a.nextStep) })) });
}
// Tier nesting check (§48): Preview ⊆ Brief ⊆ Portfolio ⊆ Premium.
const nest = (a: string, b: string) => idsByTier[a].every((id) => idsByTier[b].includes(id));
summary.nesting = { preview_in_brief: nest("Preview", "Brief"), brief_in_portfolio: nest("Brief", "Portfolio"), portfolio_in_premium: nest("Portfolio", "Premium") };
console.log(`nesting :: ${JSON.stringify(summary.nesting)}`);
// US-geo honesty check: how many delivered accounts are US (vs off-target).
const prem = summary.tier_pdfs.find((t: any) => t.tier === "Premium");
const offUS = (prem?.companies ?? []).filter((c: any) => c.geography && !/united states|usa|u\.s\.|\bus\b/i.test(String(c.geography)));
console.log(`geo :: premium delivered=${prem?.accounts} off_US=${offUS.length}`);
writeFileSync(`${OUT}/pilot2-tier-validity.json`, JSON.stringify(summary, null, 2));
console.log(`validity :: ${OUT}/pilot2-tier-validity.json`);
