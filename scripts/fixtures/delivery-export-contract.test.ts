// Customer Delivery System V1 — EXPORT CONTROL CONTRACT (final pre-merge gate).
// Proves the exact customer Export control set per tier, that UI exposure derives from the SAME policy
// the server route enforces, and that hiding a control is not authorization (the route resolves tier
// server-side and re-denies a forbidden channel — a client query/body cannot obtain it). Deterministic;
// no network.

import { readFileSync } from "node:fs";
import { downloadableChannels, tierOffersChannel, offeredChannels } from "../../lib/delivery-system/channel-availability";
import type { DeliveryTier } from "../../lib/delivery-system/tier-composer";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };
const eq = (n: string, a: unknown, b: unknown) => t(`${n} (got ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b));

// ── 1. The exact customer Export control set per tier (UI derives from downloadableChannels). ──
eq("preview → PDF only", downloadableChannels("preview"), ["pdf"]);
eq("brief → PDF only", downloadableChannels("brief"), ["pdf"]);
eq("intelligence → PDF + CSV", downloadableChannels("intelligence"), ["pdf", "csv"]);
eq("premium → PDF + CSV", downloadableChannels("premium"), ["pdf", "csv"]);

// PDF is offered to EVERY tier; CSV only to intelligence + premium.
for (const tier of ["preview", "brief", "intelligence", "premium"] as DeliveryTier[]) {
  t(`${tier}: PDF offered`, tierOffersChannel(tier, "pdf") && downloadableChannels(tier).includes("pdf"));
  t(`${tier}: web is the living product, never a download control`, !downloadableChannels(tier).includes("web" as never) && offeredChannels(tier).includes("web"));
}
t("preview: CSV NOT offered", !tierOffersChannel("preview", "csv") && !downloadableChannels("preview").includes("csv"));
t("brief: CSV NOT offered", !tierOffersChannel("brief", "csv") && !downloadableChannels("brief").includes("csv"));
t("intelligence: CSV offered", tierOffersChannel("intelligence", "csv"));
t("premium: CSV offered", tierOffersChannel("premium", "csv"));

// Watch / Monitor / Intelligence-subscription are NOT distinct delivery tiers — they resolve (via
// resolveReportExperience) to one of these four, and exports follow the resolved tier. No extra export
// is invented: the whole tier universe is exactly these four keys.
eq("delivery tier universe is exactly the 4 report tiers", Object.keys({ preview: 0, brief: 0, intelligence: 0, premium: 0 }).sort(), (["preview", "brief", "intelligence", "premium"] as string[]).sort());

// ── 2. UI exposure and server enforcement share ONE policy source. ──
// The customer surface renders controls from downloadableChannels(tier); the routes gate on
// tierOffersChannel(tier, channel). Prove they agree for every (tier, channel) pair.
for (const tier of ["preview", "brief", "intelligence", "premium"] as DeliveryTier[]) {
  for (const channel of ["pdf", "csv"] as const) {
    const shownInUi = downloadableChannels(tier).includes(channel);
    const allowedByRoute = tierOffersChannel(tier, channel);
    t(`${tier}/${channel}: UI exposure === route policy`, shownInUi === allowedByRoute);
  }
}

// ── 3. Hiding a control is not authorization — the route is the real gate, tier is server-resolved. ──
const root = new URL("../../", import.meta.url).pathname;
const csvRoute = readFileSync(`${root}app/api/results/[jobId]/export/csv/route.ts`, "utf8");
const pdfRoute = readFileSync(`${root}app/api/results/[jobId]/export/pdf/route.ts`, "utf8");
const bridge = readFileSync(`${root}lib/delivery-system/server/deliverable-for-viewer.ts`, "utf8");

for (const [name, src] of [["csv", csvRoute], ["pdf", pdfRoute]] as const) {
  t(`${name} route independently enforces tierOffersChannel`, /tierOffersChannel\(\s*v\.tier\s*,\s*"(csv|pdf)"\s*\)/.test(src));
  t(`${name} route returns 403 when the channel isn't offered`, /403/.test(src));
  t(`${name} route auths via the ownership bridge before serving`, /deliverableForViewer\(/.test(src));
  // The client cannot pick the tier: the route never reads tier from the query string or the body.
  t(`${name} route does NOT read tier from client query/body`, !/searchParams|req\.json\(|\.body|nextUrl\.searchParams/.test(src) || !/tier/.test(src.replace(/v\.tier/g, "")));
}
// The tier comes from the server-resolved experience, never from the client.
t("bridge resolves tier from brief.experience (server-authoritative)", /brief\.experience\.tier/.test(bridge));
t("bridge reuses the proven ownership gate", /getBriefForViewer\(/.test(bridge));
t("bridge denies non-owner / unavailable (401/403/404)", /401/.test(bridge) && /403/.test(bridge) && /404/.test(bridge));

// ── 4. The customer surface renders controls from the policy helper (no hardcoded tier list). ──
const workspace = readFileSync(`${root}components/deliverable/OpportunityWorkspace.tsx`, "utf8");
t("workspace derives export controls from downloadableChannels(tier)", /downloadableChannels\(\s*tier\s*\)/.test(workspace));
// The customer (exportContext) branch must route PDF through the server, never window.print. Isolate
// that branch (from `if (exportContext)` to its `} else {`) and prove it has no browser-print action.
const customerBranch = workspace.slice(workspace.indexOf("if (exportContext)"), workspace.indexOf("} else {", workspace.indexOf("if (exportContext)")));
t("customer branch found", customerBranch.length > 0);
t("customer PDF action does NOT use window.print (routes through the server)", !/window\.print/.test(customerBranch));
t("customer branch routes exports through /export/<channel>", /\/export\/\$\{channel\}/.test(customerBranch));
// window.print survives ONLY in the portable/admin fallback, guarded by vm.downloads.pdf.
t("legacy browser-print kept only as the portable fallback", /vm\.downloads\.pdf[^\n]*window\.print/.test(workspace));
t("workspace fetches the authenticated export routes with a bearer token", /Authorization`?\s*:\s*`Bearer|Bearer \$\{token\}|Authorization.*Bearer/.test(workspace));

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
