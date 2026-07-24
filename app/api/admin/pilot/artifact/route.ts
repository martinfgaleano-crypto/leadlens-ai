import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

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

  return NextResponse.json({
    origin: "harness_artifact",
    origin_note: "Corrida por harness (pilot:amor-de-gea) — sin jobId de Supabase. Datos leídos de ml/data/pilot-amor-de-gea/.",
    run_id: dir.split("/").pop(),
    available_runs: dirs.map((d) => d.split("/").pop()),
    client: "Amor de Gea",
    market: "Bienestar / infusiones y botánicos — Cali · Valle del Cauca · Colombia",
    manifest, metrics, candidates,
  });
}
