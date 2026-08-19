// ─── Deliverable store — internal filesystem index for the Admin hub ──────────
// Lists and serves generated portable artifacts from output/deliverables/<slug>/
// <date>/. Read-only, admin-only (the API layer enforces auth). Every path
// segment is strictly validated and re-checked to stay inside the base dir, so
// no `../` / encoded traversal can escape. Only known artifact files are served.
//
// NOTE: on Vercel the build filesystem is ephemeral — this V1 index is for the
// LOCAL / self-hosted admin workflow. Production distribution should move these
// artifacts to object storage (e.g. Supabase Storage); see the V1.1 report.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = path.join(process.cwd(), "output", "deliverables");
const SEG = /^[a-z0-9][a-z0-9-]{0,60}$/i;             // slug / date directory names
const FILE = /^[A-Za-z0-9._-]{1,120}\.(html|csv)$/;   // allowed artifact filenames

export type DeliverableKind = "customer" | "fixture";

export interface DeliverableFileInfo { name: string; kind: "html" | "portfolioCsv" | "evidenceCsv"; sizeKb: number }
export interface DeliverableSummary {
  id: string;              // "<slug>/<date>"
  slug: string;
  date: string;
  client: string | null;
  tier: string | null;
  accounts: number | null;
  generatedAt: string | null;
  kind: DeliverableKind;
  html: string | null;
  portfolioCsv: string | null;
  evidenceCsv: string | null;
  files: DeliverableFileInfo[];
}

function kb(p: string): number { try { return Math.round((statSync(p).size / 1024) * 10) / 10; } catch { return 0; } }

function readManifest(dir: string): Record<string, unknown> | null {
  try {
    const p = path.join(dir, "manifest.json");
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>) : null;
  } catch { return null; }
}

function fileKind(name: string): DeliverableFileInfo["kind"] | null {
  if (name.endsWith(".html")) return "html";
  if (/Evidence.*\.csv$/i.test(name)) return "evidenceCsv";
  if (/\.csv$/i.test(name)) return "portfolioCsv";
  return null;
}

/** Enumerate every generated deliverable, newest first. */
export function listDeliverables(): DeliverableSummary[] {
  if (!existsSync(BASE)) return [];
  const out: DeliverableSummary[] = [];
  for (const slug of safeDirs(BASE)) {
    for (const date of safeDirs(path.join(BASE, slug))) {
      const dir = path.join(BASE, slug, date);
      const m = readManifest(dir);
      const files: DeliverableFileInfo[] = [];
      let html: string | null = null, portfolioCsv: string | null = null, evidenceCsv: string | null = null;
      for (const name of readdirSync(dir)) {
        if (!FILE.test(name)) continue;
        const k = fileKind(name);
        if (!k) continue;
        files.push({ name, kind: k, sizeKb: kb(path.join(dir, name)) });
        if (k === "html") html = name;
        else if (k === "portfolioCsv") portfolioCsv = name;
        else if (k === "evidenceCsv") evidenceCsv = name;
      }
      if (!html) continue; // a deliverable without its HTML is not listable
      out.push({
        id: `${slug}/${date}`, slug, date,
        client: (m?.client as string) ?? null,
        tier: (m?.tier as string) ?? null,
        accounts: (m?.accounts as number) ?? null,
        generatedAt: (m?.generatedAt as string) ?? null,
        kind: (m?.fixture as string) === "amor" ? "customer" : "fixture",
        html, portfolioCsv, evidenceCsv, files,
      });
    }
  }
  return out.sort((a, b) => (b.generatedAt ?? b.date).localeCompare(a.generatedAt ?? a.date));
}

function safeDirs(base: string): string[] {
  try { return readdirSync(base).filter((d) => SEG.test(d) && safeIsDir(path.join(base, d))); } catch { return []; }
}
function safeIsDir(p: string): boolean { try { return statSync(p).isDirectory(); } catch { return false; } }

export interface ResolvedFile { absPath: string; name: string; mime: string }

/** Resolve one artifact file for serving. Returns null on any invalid segment,
 *  traversal attempt, unknown file, or path escaping the base directory. */
export function resolveDeliverableFile(slug: string, date: string, file: string): ResolvedFile | null {
  if (!SEG.test(slug) || !SEG.test(date) || !FILE.test(file)) return null;
  const abs = path.resolve(BASE, slug, date, file);
  const baseResolved = path.resolve(BASE) + path.sep;
  if (!abs.startsWith(baseResolved)) return null;     // escaped the base dir
  if (!existsSync(abs) || !statSync(abs).isFile()) return null;
  const mime = file.endsWith(".html") ? "text/html; charset=utf-8" : "text/csv; charset=utf-8";
  return { absPath: abs, name: file, mime };
}
