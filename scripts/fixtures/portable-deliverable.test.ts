// Portable premium deliverable — security + portability invariants (0 network).
// Locks the guarantees a self-contained customer HTML must never break:
//   1. Self-contained: no external scripts/styles/fonts/CDN (source <a> links OK).
//   2. Safe: HTML/script injection escaped; only http/https source links.
//   3. Sanitized: no secrets / raw report fields / internal metadata embedded.
//   4. Complete: all panels, embedded CSVs match the exports, real Amor renders.
// Run: npm run test:portable
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fromAmorPilot } from "@/lib/deliverable/adapters";
import { renderPortableHtml } from "@/lib/deliverable/portable/render-portable";
import { safeUrl, esc, jsonForScript, scanForSecrets } from "@/lib/deliverable/portable/portable-payload";
import { portfolioCsv } from "@/lib/deliverable/exports";
import type { DeliverableViewModel, AccountBriefVM } from "@/lib/deliverable/deliverable-view-model";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// ─── Real Amor de Gea ─────────────────────────────────────────────────────────
const amor = fromAmorPilot(JSON.parse(readFileSync(path.join(process.cwd(), "output", "amor-pilot1-deliverable.data.json"), "utf8")));
const html = renderPortableHtml(amor);

t("1 produces a full self-contained HTML document", /^<!doctype html>/i.test(html) && html.includes("</html>"));
t("2 sets a LeadLens document title with the client", /<title>LeadLens — .*Amor de Gea<\/title>/.test(html));
t("3 NO external script src (no CDN/React runtime)", !/<script[^>]+\bsrc=/.test(html));
t("4 NO external stylesheet <link> / webfont", !/<link\b/i.test(html) && !/@import/.test(html) && !/fonts\.(googleapis|gstatic)/.test(html));
t("5 NO external asset URLs in CSS (url(http…))", !/url\(\s*['"]?https?:/i.test(html));
t("6 CSS + JS are inline", /<style>/.test(html) && /<script>\(function/.test(html));
t("7 embeds a JSON runtime payload (application/json)", /<script type="application\/json" id="pt-data">/.test(html));
t("8 uses no eval / new Function", !/\beval\(/.test(html) && !/new Function/.test(html));
t("9 all five primary intelligence panels present", ["panel-portfolio","panel-accounts","panel-evidence","panel-compare","panel-intelligence"].every((p)=>html.includes(`id="${p}"`)));
t("10 portfolio panel is NOT hidden by default (JS-disabled fallback)", /id="panel-portfolio"/.test(html) && /class="pt-panel"\s+id="panel-portfolio"/.test(html));
t("11 renders all 10 Amor accounts as briefs", (html.match(/data-brief="/g) || []).length === 10);
t("12 static point-in-time note present (not 'live')", /reflects the evidence available at the time of generation|refleja la evidencia disponible/.test(html) && !/live dashboard/i.test(html));
t("13 no marketing chrome (pricing/signup/get started)", !/get started/i.test(html) && !/sign ?up/i.test(html) && !/\/pricing/.test(html));

// ─── Secret / internal-data scan ──────────────────────────────────────────────
const scan = scanForSecrets(html);
t("14 no forbidden markers (secrets / raw fields / internal metadata)", scan.clean, scan.hits.join(","));
t("15 no raw snapshot / processed_leads / vault markers", !/report_json|processed_leads|_vault|feature_snapshot/.test(html));
t("16 embedded portfolio CSV present (header + a real account row)", html.includes("Rank,Account,Decision") && portfolioCsv(amor).includes("Éteka") && html.includes("Éteka"));
t("17 embedded CSV filenames present for client download", html.includes("LeadLens_Portfolio_Amor_de_Gea") && html.includes("LeadLens_Evidence_Amor_de_Gea"));

// ─── Injection / URL sanitization (hand-built hostile view model) ─────────────
const XSS = `</script><script>alert(1)</script>`;
const hostile: DeliverableViewModel = {
  meta: { client: XSS, market: "X", generatedAt: "2026-01-01", generatedLabel: "2026-01-01", tierLabel: null, language: "en", schemaVersion: 1 },
  headline: XSS, summary: XSS,
  portfolio: { total: 1, counts: { prioritize: 1, validate: 0, monitor: 0, hold: 0 }, allocation: null, funnel: null, note: null },
  accounts: [{
    id: "x-0", rank: 1, company: XSS, segment: XSS, geography: null, domain: null,
    decision: "prioritize", decisionNote: XSS, thesis: XSS, whyItMatters: null,
    dimensions: [{ label: "Fit", value: "Strong", note: null }],
    whatChanged: [{ event: XSS, date: "2026-01-01", age: "9d", source: "x.com" }],
    evidence: { sourceCount: 2, datedCount: 1, corroborated: null, latestAge: "9d", strength: "Moderate" },
    sources: [
      { label: XSS, url: "javascript:alert(1)", date: null, age: null, relation: "direct", claim: XSS },
      { label: "ok", url: "https://example.com/a", date: "2026-01-01", age: "9d", relation: "context", claim: null },
    ],
    counterSignals: [XSS], limitations: [XSS], validations: [XSS], nextStep: XSS,
    freshness: { label: "9d ago", age: "9d" }, confidence: "Moderate",
  } as AccountBriefVM],
  commercialContext: { summary: XSS, regions: [], industries: [XSS], criteria: [XSS] },
  validationQueue: [{ accountId: "x-0", company: XSS, decision: "prioritize", items: [XSS] }],
  coverage: { withDatedEvidence: 1, withSources: 1, corroborated: 0, grade: "Moderate", note: null },
  methodology: [], limitations: [XSS],
  downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
  capabilities: { showPortfolioTab: true, showCompareTab: false, showEvidenceTab: true, showDownloadsTab: true, showMethodology: false },
};
const hostileHtml = renderPortableHtml(hostile);
t("18 script injection is escaped (no executable <script>alert in body)", !hostileHtml.includes("<script>alert(1)</script>") || hostileHtml.split("<script>alert(1)</script>").length === 1);
t("19 malicious text is HTML-escaped", hostileHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
t("20 javascript: URL is dropped (never an href)", !/href="javascript:/.test(hostileHtml));
t("21 safe https source link is preserved", hostileHtml.includes('href="https://example.com/a"'));
t("22 safeUrl rejects javascript:/data:, allows http/https", safeUrl("javascript:alert(1)") === null && safeUrl("data:text/html,x") === null && safeUrl("https://x.com") === "https://x.com/" && safeUrl("http://x.com/y") === "http://x.com/y");
t("23 payload </script> is neutralized (no early script close)", !jsonForScript({ a: "</script>" }).includes("</script>"));

// ─── Unicode (Spanish + Japanese) ─────────────────────────────────────────────
t("24 Spanish/Unicode preserved (Éteka)", html.includes("Éteka"));
const jp = fromAmorPilot({ meta: { client: "日本テスト", geography: "東京" }, accounts: [{ name: "オポチュニティ株式会社", why: "テスト理由", test: "検証", unknown: "不明", next: "次の一歩", evidence: { source: "example.jp", fact: "事実", retrieved: "2026-01-01", freshness: "fresh" } }] });
const jpHtml = renderPortableHtml(jp);
t("25 Japanese company name renders intact", jpHtml.includes("オポチュニティ株式会社") && jpHtml.includes("日本テスト"));

// ─── V1.1 visual friendliness (structure, not pixels) ─────────────────────────
t("26 editorial cover with AOI kicker (not a marketing hero)", html.includes('class="pt-cover"') && html.includes('class="pt-cover-kick"') && !/get started/i.test(html));
t("27 deterministic executive read is present, count-grounded and timing-honest", html.includes('class="pt-exec"') && /3 de 10 cuentas quedan priorizadas para validación por encaje estructural, no por timing actual\. 4 requieren validación/.test(html));
t("28 executive read has no fabricated prose beyond real counts", !/probablemente|likely to close|estimamos|we estimate/i.test(html));
t("29 Opportunity Case is ONE object with a reasoning spine (not box-box-box)", html.includes('class="pt-brief pt-case"') && html.includes('class="pt-flow"') && html.includes('class="pt-node"') && !/pt-brief"[^>]*>\s*<div class="pt-card"/.test(html));
t("30 Case uses truthful locked grammar labels (Amor = Spanish)", (() => { const b = html.indexOf('pt-brief pt-case'); const seg = html.slice(b, b + 6000); return ["Evidencia", "Qué podría cambiar el caso", "Decisión"].every((l) => seg.includes(l)) && !seg.includes("Qué cambió"); })());
t("30b no signature signal band appears without a true temporal change", !/pt-band\s+pt-signal/.test(html));
t("30c commercial context stays a disclosure (secondary to opening)", html.includes('class="pt-card pt-context"') && /<details/.test(html));
t("30d Opportunity Thesis renders as a lead paragraph (label-less)", html.includes('class="pt-thesis"'));
t("30e real Role/Type are structured and localized for Amor", html.includes("Cliente potencial · Nuevo negocio") && !html.includes("Potential Customer · New Business"));

// ─── Path-traversal / resolver safety (deliverable store) ─────────────────────
import { resolveDeliverableFile, listDeliverables } from "@/lib/deliverable/portable/deliverable-store";
t("31 resolver rejects ../ traversal in slug", resolveDeliverableFile("../../etc", "2026-08-03", "x.html") === null);
t("32 resolver rejects traversal in filename", resolveDeliverableFile("amor-de-gea", "2026-08-03", "../../../etc/passwd") === null);
t("33 resolver rejects non-artifact extensions", resolveDeliverableFile("amor-de-gea", "2026-08-03", "manifest.json") === null && resolveDeliverableFile("amor-de-gea", "2026-08-03", "x.exe") === null);
t("34 resolver rejects encoded traversal", resolveDeliverableFile("%2e%2e", "2026-08-03", "x.html") === null && resolveDeliverableFile("amor-de-gea", "2026-08-03", "..%2fx.html") === null);
const listed = listDeliverables();
t("35 store lists the generated Amor deliverable as a customer artifact", listed.some((d) => d.slug === "amor-de-gea" && d.kind === "customer" && d.html !== null && d.accounts === 10));
t("36 a real listed HTML resolves and stays inside the base dir", (() => { const d = listed.find((x) => x.html); return d ? resolveDeliverableFile(d.slug, d.date, d.html!) !== null : false; })());

// ─── Admin surface guards (static) ────────────────────────────────────────────
const listRoute = readFileSync("app/api/admin/deliverables/route.ts", "utf8");
const fileRoute = readFileSync("app/api/admin/deliverables/file/route.ts", "utf8");
const adminPage = readFileSync("app/admin/deliverables/page.tsx", "utf8");
const adminNav = readFileSync("app/admin/_components/AdminLayout.tsx", "utf8");
t("37 list route requires admin auth", /requireAdmin\(req\)/.test(listRoute) && /if \(deny\) return deny/.test(listRoute));
t("38 file route requires admin auth + validates via resolver", /requireAdmin\(req\)/.test(fileRoute) && /resolveDeliverableFile/.test(fileRoute) && /nosniff/.test(fileRoute));
t("39 admin page exposes Preview + Download HTML + CSV actions", /Preview/.test(adminPage) && /Download HTML/.test(adminPage) && /Portfolio CSV/.test(adminPage) && /Evidence CSV/.test(adminPage));
t("40 admin nav links Deliverables", /href: "\/admin\/deliverables"/.test(adminNav));
t("41 no public (non-admin) deliverables index route exists",
  !existsSync("app/deliverables") && !existsSync("app/api/deliverables") && !existsSync("app/api/deliverable"));

// ─── R. Client Opportunity Canvas opening (client is the subject) ─────────────
import { toClientCanvasVM } from "@/lib/deliverable/client-canvas-vm";
const amorCc = toClientCanvasVM(amor);
t("R1 portable opens with a light client header (no dark navy gradient)",
  html.includes('class="pt-top"') && !/\.pt-top\{background:linear-gradient\(120deg,#0b1220/.test(html) && /\.pt-top\{background:#fff/.test(html));
t("R2 the CLIENT is the header subject (Amor de Gea), not a target account",
  html.includes('class="pt-client">Amor de Gea<') && !/class="pt-client">Éteka</.test(html));
t("R3 client canvas VM makes Amor the subject with hasClient=true", amorCc.client === "Amor de Gea" && amorCc.hasClient === true && amorCc.subject === "Amor de Gea");
t("R4 opportunities remain subordinate to the client (10 in the landscape)", amorCc.landscape.length === 10 && amorCc.landscape.every((o) => o.company !== amorCc.client));
t("R5 client read is deterministic from counts (no invented client intelligence)", typeof amorCc.read === "string" && /\d+ (of|de) \d+/.test(amorCc.read!));
t("R6 patterns are honestly empty (no market-pattern synthesis in the report path)", Array.isArray(amorCc.patterns) && amorCc.patterns.length === 0);
t("R7 objective derives from real commercial context (may be null; Amor has one)", amorCc.objective === null || typeof amorCc.objective === "string");
t("R8 graceful when there is NO client — subject falls back, never a fake name", (() => {
  const noClient = toClientCanvasVM({ ...amor, meta: { ...amor.meta, client: null } });
  return noClient.client === null && noClient.hasClient === false && noClient.subject.length > 0 && !amorCc.landscape.some((o) => o.company === noClient.subject);
})());
t("R9 no aggregate score / HOT-WARM-COLD in the client-header region", (() => { const h = html.slice(html.indexOf('class="pt-top"'), html.indexOf("</header>")); return !/\bHOT\b|\bWARM\b|\bCOLD\b/.test(h) && !/\d\/10\b|\d{1,3}\/100\b/.test(h); })());
t("R10 CaseSpine reasoning + evidence still intact (opportunity drill-down preserved)", (html.match(/data-brief="/g) || []).length === 10 && html.includes("Establece:") && html.includes("Decisión"));

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
