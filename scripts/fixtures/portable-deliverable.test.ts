// Portable premium deliverable — security + portability invariants (0 network).
// Locks the guarantees a self-contained customer HTML must never break:
//   1. Self-contained: no external scripts/styles/fonts/CDN (source <a> links OK).
//   2. Safe: HTML/script injection escaped; only http/https source links.
//   3. Sanitized: no secrets / raw report fields / internal metadata embedded.
//   4. Complete: all panels, embedded CSVs match the exports, real Amor renders.
// Run: npm run test:portable
import { readFileSync } from "node:fs";
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
t("9 all five panels present", ["panel-portfolio","panel-accounts","panel-compare","panel-evidence","panel-method"].every((p)=>html.includes(`id="${p}"`)));
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

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
