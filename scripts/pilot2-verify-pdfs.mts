#!/usr/bin/env node
/**
 * §4 + §5 verification on the FINAL delivered PDFs (read-only).
 * Decompresses each PDF's FlateDecode content streams and extracts text, then:
 *  §4 — asserts the advanced Visual-Intelligence surfaces reached Portfolio/Premium.
 *  §5 — searches for banned semantic-defect strings and enforces the hard rules.
 * No re-render; this inspects exactly the bytes that will be delivered.
 */
import { readFileSync } from "node:fs";
import { inflateSync, inflateRawSync } from "node:zlib";

const DIR = process.env.PILOT2_MRU_OUT || "output/pilot2/FINAL-CLOSED";
const SFX = process.env.PILOT2_FILE_SUFFIX ?? "_FINAL";
const FILES: Array<[string, string]> = [
  ["Preview", `${DIR}/LeadLens_AmorDeGea_Pilot2_Preview${SFX}.pdf`],
  ["Brief", `${DIR}/LeadLens_AmorDeGea_Pilot2_Brief${SFX}.pdf`],
  ["Portfolio", `${DIR}/LeadLens_AmorDeGea_Pilot2_Portfolio${SFX}.pdf`],
  ["Premium", `${DIR}/LeadLens_AmorDeGea_Pilot2_Premium${SFX}.pdf`],
];

function extractText(path: string): string {
  const buf = readFileSync(path);
  const bytes = new Uint8Array(buf);
  const out: string[] = [];
  // Walk raw stream...endstream blocks.
  const s = buf.toString("latin1");
  let idx = 0;
  while (true) {
    const st = s.indexOf("stream", idx);
    if (st === -1) break;
    // content starts after "stream" + CRLF/LF
    let cs = st + 6;
    if (s[cs] === "\r") cs++;
    if (s[cs] === "\n") cs++;
    const en = s.indexOf("endstream", cs);
    if (en === -1) break;
    idx = en + 9;
    const raw = Buffer.from(bytes.slice(cs, en));
    let decoded: string | null = null;
    try { decoded = inflateSync(raw).toString("latin1"); } catch {
      try { decoded = inflateRawSync(raw).toString("latin1"); } catch { decoded = null; }
    }
    if (decoded == null) decoded = raw.toString("latin1"); // uncompressed fallback
    out.push(decoded);
  }
  // Pull text from (…)Tj, (…)', and [ (…) ]TJ operators.
  const content = out.join("\n");
  const texts: string[] = [];
  const reTj = /\(((?:\\.|[^\\()])*)\)\s*(?:Tj|')/g;
  let m: RegExpExecArray | null;
  while ((m = reTj.exec(content))) texts.push(m[1]);
  const reTJ = /\[((?:[^\]]|\\\])*)\]\s*TJ/g;
  while ((m = reTJ.exec(content))) {
    const inner = m[1];
    const reStr = /\(((?:\\.|[^\\()])*)\)/g;
    let mm: RegExpExecArray | null;
    while ((mm = reStr.exec(inner))) texts.push(mm[1]);
  }
  return texts.join(" ")
    .replace(/\\(\d{3})/g, (_x, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\([()\\])/g, "$1");
}

// §28 customer-delivery forbidden set, as precise regexes. Legacy decision-SYSTEM
// tokens are matched with word boundaries / case so legitimate prose ("preserve",
// "hotel", "snapshot", "cold outreach", "warm introduction") does not false-fail;
// the uppercase tier labels (WARM/HOT/COLD) are the real legacy artifacts (§6).
const BANNED: Array<[string, RegExp]> = [
  ["act now", /\bact now\b/i], ["1 act now", /\b1 act now\b/i],
  ["WARM", /\bWARM\b/], ["HOT", /\bHOT\b/], ["COLD", /\bCOLD\b/],
  ["average score", /\baverage score\b/i], ["highest-scoring", /\bhighest[-\s]scoring\b/i],
  ["/10 score", /\b\d{1,2}(?:\.\d+)?\s*\/\s*10\b/],
  ["encaje", /\bencaje\b/i], ["sin señal temporal", /sin señal temporal/i],
  ["sin independencia", /sin independencia/i], ["señal temporal verificada", /señal temporal verificada/i],
  ["validate_source_first", /validate_source_first/i], ["monitor_for_new_signal", /monitor_for_new_signal/i],
  ["send_outreach_now", /send_outreach_now/i], ["act_now", /\bact_now\b/i], ["validate_first", /\bvalidate_first\b/i],
  ["Next step: exclude", /Next step:\s*exclude/i], ["Source URL unavailable", /Source URL unavailable/i],
  ["5 accounts worth monitoring", /\d+ accounts worth monitoring/i],
];
// §4 required surfaces (case-insensitive substrings).
const PORTFOLIO_REQUIRED = ["Decision distribution", "Evidence coverage", "Commercial routes", "Market map", "Account benchmark"];
const PREMIUM_ADDS = ["Market research universe", "Route research coverage", "Verified mechanisms", "Verified access", "Commercial depth"];

const extracted: Record<string, string> = {};
for (const [label, path] of FILES) extracted[label] = extractText(path);

let fail = 0;
console.log("=== §5/§28 BANNED STRING SCAN (all four) ===");
for (const [label] of FILES) {
  const txt = extracted[label];
  const hits = BANNED.filter(([, re]) => re.test(txt)).map(([name]) => name);
  if (hits.length) { console.log(`  ✗ ${label}: FOUND ${JSON.stringify(hits)}`); fail++; }
  else console.log(`  ✓ ${label}: clean`);
}

console.log("\n=== §5 HARD RULE: Prioritize=0 → no 'Act Now' ===");
for (const [label] of FILES) {
  const low = extracted[label].toLowerCase();
  const actNow = low.includes("act now") || /\bprioritize\b/.test(low) && low.includes("1 account worth acting");
  if (actNow) { console.log(`  ✗ ${label}: contains 'act now' language`); fail++; }
  else console.log(`  ✓ ${label}: no 'Act Now' language`);
}

console.log("\n=== §4 PORTFOLIO advanced VI surfaces ===");
{
  const low = extracted.Portfolio.toLowerCase();
  for (const need of PORTFOLIO_REQUIRED) {
    const ok = low.includes(need.toLowerCase());
    console.log(`  ${ok ? "✓" : "✗"} ${need}`); if (!ok) fail++;
  }
}
console.log("\n=== §4 PREMIUM adds (market research layer) ===");
{
  const low = extracted.Premium.toLowerCase();
  for (const need of PREMIUM_ADDS) {
    const ok = low.includes(need.toLowerCase());
    console.log(`  ${ok ? "✓" : "✗"} ${need}`); if (!ok) fail++;
  }
  // Prove the 3 market-verified mechanism accounts are named in Premium.
  for (const acct of ["Natural Grocers", "Sprouts", "Whole Foods"]) {
    const ok = low.includes(acct.toLowerCase());
    console.log(`  ${ok ? "✓" : "✗"} market-verified mechanism account present: ${acct}`); if (!ok) fail++;
  }
}

console.log("\n=== §3 SELECTED (6) vs MRU separation markers ===");
{
  const low = extracted.Premium.toLowerCase();
  // MRU market-sources population (72) must appear as market layer; selected portfolio is 6.
  const hasMarketSources = low.includes("market sources");
  console.log(`  ${hasMarketSources ? "✓" : "✗"} Premium labels a distinct market-research layer ('Market sources')`);
  if (!hasMarketSources) fail++;
}

console.log(`\nextracted char counts: ${FILES.map(([l]) => `${l}=${extracted[l].length}`).join(", ")}`);
console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
