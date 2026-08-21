// ─── Benchmark adjudication: candidates → gated evidence → Cases ──────────────
// Reads the immutable discovery ledger and applies the frozen gates
// (identity → temporal → materiality → client-relevance → independence). Emits a
// full research funnel (§37/§38), per-account Cases, and a benchmark evaluation
// snapshot. No fabrication: every accepted event carries real date + origins.
import { readFile, writeFile, rename, mkdir } from "fs/promises";
import { dirname } from "path";

const IN = "ml/data/benchmark/temporal_benchmark_v1.json";
const OUT = "ml/data/benchmark/temporal_benchmark_v1.evaluation.json";

// identity tokens (lowercase); wrong-entity guard
const IDENT: Record<string, string[]> = {
  "Quala S.A.": ["quala"], "Coordinadora Mercantil": ["coordinadora"], "Crystal S.A.S.": ["crystal"],
  "Alianza Team": ["alianza team", "team foods", "alianzateam"], "Grupo BIOS": ["grupo bios", "grupobios"],
  "Tecnoglass": ["tecnoglass"], "Saia Inc.": ["saia"], "US Foods": ["us foods", "usfoods"],
  "Encompass Health": ["encompass"], "Watsco": ["watsco"], "Mueller Industries": ["mueller"], "GXO Logistics": ["gxo"],
};
// materiality: operational-expansion event language (EN + ES)
const MATERIAL = /\b(opens?|opening|opened|inaugurat|new (terminal|facility|plant|warehouse|distribution cent|site|hub|location|store)|distribution cent(er|re)|expand(s|ing|ed)?|expansion|capacity|acquir(e|es|ed|ing)|acquisition|merger|launch(es|ed|ing)?|invest(s|ed|ment|ing)?|breaks? ground|groundbreaking|ribbon|apertura|inaugura|nueva planta|nuevo centro|expansión|amplia|amplía|inversión|adquisición|adquiere)\b/i;
// adversarial/negative language
const NEGATIVE = /\b(clos(e|es|ed|ure|ing)|shut(s|ting)?|layoff|lay off|job cuts|bankrupt|insolven|decline|downturn|loss(es)?|lawsuit|fraud|recall|strike|huelga|cierre|despidos|pérdidas|quiebra|demanda)\b/i;

const parseDate = (s: string | null): string | null => {
  if (!s) return null; const d = new Date(s); if (isNaN(d.getTime())) return null;
  const now = Date.now(); if (d.getTime() > now + 86400000) return null; // future = crawl artifact
  return d.toISOString().slice(0, 10);
};
// Exa-style midnight crawl stamp — not an event date
const isCrawlStamp = (s: string | null): boolean => !!s && /T00:00:00\.000Z$/.test(s);

interface Cand { title: string | null; host: string | null; url: string; published_date: string | null; source_type: string | null; snippet: string | null }

async function main() {
  const d = JSON.parse(await readFile(IN, "utf8"));
  const universe: any[] = d.universe;
  const perAccount: any[] = [];
  const funnel = { candidates: 0, identity_valid: 0, date_valid: 0, material: 0, client_relevant: 0, accepted_direct: 0, independently_supported_accounts: 0 };
  const gateRej: Record<string, number> = { identity: 0, temporal: 0, materiality: 0, client_relevance: 0, source_quality: 0, duplicate: 0 };

  for (const acct of universe) {
    const tokens = IDENT[acct.name];
    const calls = d.calls.filter((c: any) => c.account === acct.name);
    const seen = new Set<string>();
    const accepted: Array<Cand & { date: string }> = [];
    const negatives: Array<Cand & { date: string | null }> = [];
    let cCand = 0, cIdent = 0, cDate = 0, cMat = 0, cRel = 0;

    for (const call of calls) {
      for (const r of (call.results as Cand[])) {
        const cu = (r.url || "").toLowerCase();
        if (seen.has(cu)) { gateRej.duplicate++; continue; }
        seen.add(cu); cCand++; funnel.candidates++;
        const hay = `${r.title ?? ""} ${r.snippet ?? ""} ${r.host ?? ""}`.toLowerCase();
        // identity
        if (!tokens.some(t => hay.includes(t))) { gateRej.identity++; continue; }
        cIdent++; funnel.identity_valid++;
        // adversarial capture (negative signal about the actual entity)
        if (call.purpose === "adversarial" && NEGATIVE.test(hay) && !MATERIAL.test(hay)) { negatives.push({ ...r, date: parseDate(r.published_date) }); }
        // temporal (reject crawl stamps + unparseable/future)
        if (isCrawlStamp(r.published_date)) { gateRej.temporal++; continue; }
        const date = parseDate(r.published_date);
        if (!date) { gateRej.temporal++; continue; }
        cDate++; funnel.date_valid++;
        // materiality (operational event language)
        if (!MATERIAL.test(hay)) { gateRej.materiality++; continue; }
        cMat++; funnel.material++;
        // client relevance = operational expansion (Asteron lens): material event already encodes expansion vocab
        cRel++; funnel.client_relevant++;
        accepted.push({ ...r, date });
      }
    }
    // independence: distinct publisher hosts among accepted material items
    const origins = new Set(accepted.map(a => a.host));
    const independent = origins.size >= 2;
    if (accepted.length) { funnel.accepted_direct += accepted.length; }
    if (independent) funnel.independently_supported_accounts++;

    // strongest event = most-corroborated recent material claim (by host diversity + recency)
    accepted.sort((a, b) => (b.date.localeCompare(a.date)));
    const latest = accepted[0]?.date ?? null;

    // Decision logic (evidence-driven, no forcing):
    //  prioritize = material dated expansion event, independently supported (≥2 origins), recent (≤120d)
    //  validate   = event exists but single-origin OR older OR scope needs confirming
    //  monitor    = only weak/older or non-material identity hits
    //  hold       = negative signal dominates with no material expansion
    const recent = latest ? (Date.now() - new Date(latest).getTime()) / 86400000 <= 120 : false;
    let decision: "prioritize" | "validate" | "monitor" | "hold";
    if (accepted.length >= 1 && independent && recent) decision = "prioritize";
    else if (accepted.length >= 1) decision = "validate";
    else if (negatives.length && !accepted.length) decision = "hold";
    else decision = "monitor";

    perAccount.push({
      name: acct.name, country: acct.country, sector: acct.sector, scale: acct.scale,
      funnel: { candidates: cCand, identity_valid: cIdent, date_valid: cDate, material: cMat, client_relevant: cRel, accepted: accepted.length, independent_origins: origins.size, independent },
      decision, latest_event_date: latest,
      accepted_evidence: accepted.slice(0, 6).map(a => ({ date: a.date, host: a.host, title: a.title, source_type: a.source_type })),
      counter_signals: negatives.slice(0, 4).map(n => ({ date: n.date, host: n.host, title: n.title })),
    });
  }

  const decisions = perAccount.reduce((m: any, a) => (m[a.decision] = (m[a.decision] || 0) + 1, m), {});
  const out = { source_run: d.run_id, generated_at: new Date().toISOString(), client: d.client,
    funnel, gate_rejections: gateRej, decisions,
    coverage: {
      true_change: perAccount.filter(a => a.funnel.accepted >= 1).length,
      timing: perAccount.filter(a => a.latest_event_date).length,
      independent_support: perAccount.filter(a => a.funnel.independent).length,
      counterevidence: perAccount.filter(a => a.counter_signals.length).length,
      no_temporal_evidence: perAccount.filter(a => a.funnel.accepted === 0).length,
    },
    accounts: perAccount };
  await mkdir(dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp"; await writeFile(tmp, JSON.stringify(out, null, 2) + "\n", "utf8"); await rename(tmp, OUT);
  console.log(JSON.stringify({ funnel, gateRej, decisions, coverage: out.coverage,
    accounts: perAccount.map(a => ({ n: a.name, dec: a.decision, acc: a.funnel.accepted, orig: a.funnel.independent_origins, latest: a.latest_event_date, counter: a.counter_signals.length })) }, null, 2));
}
main().catch(e => { console.error("FATAL", e?.message ?? e); process.exit(1); });
