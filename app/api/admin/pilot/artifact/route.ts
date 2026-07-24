import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifyBuyerSegment, computeStructuralScores, selectAccounts, buildMarketLandscape, type RankedAccount } from "@/lib/discovery/market-to-account";

export const dynamic = "force-dynamic";

// Admin-only viewer for harness pilot artifacts (Amor de Gea runs have no
// Supabase jobId — the data lives on disk under ml/data/pilot-amor-de-gea/).
// Reads manifest.json + discovery.json, parses candidate raw_context into
// structured fields, and returns a customer-safe premium report payload.
// Never fabricates a jobId; origin is labeled explicitly.

const ROOT = join(process.cwd(), "ml", "data", "pilot-amor-de-gea");

function pick(rc: string, label: string): string | null {
  const line = rc.split("\n").find((l) => l.trim().startsWith(label));
  return line ? line.slice(line.indexOf(label) + label.length).replace(/^[:\s·]+/, "").trim() : null;
}

function parseCandidate(c: Record<string, unknown>) {
  const rc = String(c.raw_context ?? "");
  const qualityLine = rc.split("\n").find((l) => l.includes("Calidad:")) ?? "";
  const scoreMatch = qualityLine.match(/(\d+)\/100/);
  const verdictMatch = qualityLine.match(/→\s*([a-záéíóúñ_]+)/i);
  const objections = qualityLine.includes("Objeciones:") ? qualityLine.split("Objeciones:")[1].trim() : null;
  const orgLine = pick(rc, "Empresa (") ?? "";
  const orgType = (rc.match(/Empresa \(([^)]+)\)/) ?? [])[1] ?? null;
  const mat = pick(rc, "Materialidad") ?? "";
  return {
    company: String(c.company ?? "—"),
    domain: (c.domain as string) ?? null,
    date: (c.signal_date as string) ?? null,
    confidence: typeof c.confidence_score === "number" ? c.confidence_score : null,
    org_type: orgType,
    signal_kind: pick(rc, "Tipo de señal"),
    materiality: mat.split("·")[0]?.trim() || null,
    corroboration: (mat.match(/Corroboración:\s*([a-z]+)/i) ?? [])[1] ?? null,
    identity: pick(rc, "Identidad corporativa"),
    fact: pick(rc, "Hecho observado"),
    score: scoreMatch ? Number(scoreMatch[1]) : null,
    verdict: verdictMatch ? verdictMatch[1] : null,
    objections,
    opportunity_kind: (c.opportunity_kind as string) ?? null,
    channel_evidence_grade: (c.channel_evidence_grade as string) ?? null,
    title: rc.split("\n")[0]?.trim() ?? null,
    headline_used_org: orgLine,
  };
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  if (!existsSync(ROOT)) return NextResponse.json({ error: "no_artifacts", runs: [] });

  const dirs = readdirSync(ROOT)
    .map((d) => join(ROOT, d))
    .filter((p) => { try { return statSync(p).isDirectory() && existsSync(join(p, "manifest.json")); } catch { return false; } })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (dirs.length === 0) return NextResponse.json({ error: "no_artifacts", runs: [] });

  const wanted = req.nextUrl.searchParams.get("run");
  const dir = (wanted && dirs.find((d) => d.endsWith(wanted))) || dirs[0];
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const discovery = existsSync(join(dir, "discovery.json")) ? JSON.parse(readFileSync(join(dir, "discovery.json"), "utf8")) : { candidates: [], metrics: {} };
  const candidates = (discovery.candidates ?? []).map(parseCandidate);
  const metrics = discovery.metrics ?? {};

  // Market-to-Account: classify the full verified universe into buyer segments
  // and compute SEPARATE structural scores (fit/attractiveness/timing/evidence).
  // No live cost — derived from the run's universe_accounts. Timing is a
  // separate axis; channel-only accounts never reach act_now.
  const candByCompany = new Map<string, ReturnType<typeof parseCandidate>>();
  for (const c of candidates) candByCompany.set(c.company.toLowerCase(), c);
  const daysBetween = (iso: string | null) => { if (!iso) return null; const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000); return Number.isFinite(d) && d >= 0 ? d : null; };
  const ranked: RankedAccount[] = (metrics.universe_accounts ?? []).map((u: Record<string, unknown>) => {
    const seg = classifyBuyerSegment(String(u.company ?? ""), (u.sector as string) ?? null);
    const cand = candByCompany.get(String(u.company ?? "").toLowerCase());
    const scores = computeStructuralScores({
      segment: seg, visibility: (u.visibility as string) ?? "unknown", hasDomain: !!u.domain,
      baseScore: typeof u.score === "number" ? u.score : null,
      daysOld: daysBetween(cand?.date ?? null),
      corroboration: (cand?.corroboration as never) ?? null,
      isChannelOnly: cand ? (cand.opportunity_kind === "channel_fit" || true) : true,
    });
    return { company: String(u.company ?? "—"), domain: (u.domain as string) ?? null, sector: (u.sector as string) ?? null, visibility: (u.visibility as string) ?? "unknown", segment: seg, scores };
  });
  const shortlist = selectAccounts(ranked, 6, 3);
  const marketLandscape = buildMarketLandscape(ranked, {
    shortlisted: shortlist.length,
    validation_candidates: candidates.filter((c: { verdict?: string }) => (c.verdict ?? "").startsWith("invest")).length,
    dynamic_opportunities: manifest.dynamic_opportunity_count ?? 0,
  });

  return NextResponse.json({
    origin: "harness_artifact",
    origin_note: "Corrida por harness (pilot:amor-de-gea) — sin jobId de Supabase. Datos leídos de ml/data/pilot-amor-de-gea/.",
    run_id: dir.split("/").pop(),
    available_runs: dirs.map((d) => d.split("/").pop()),
    client: "Amor de Gea",
    market: "Bienestar / infusiones y botánicos — Cali · Valle del Cauca · Colombia",
    manifest, metrics, candidates,
    marketLandscape, ranked, shortlist,
  });
}
