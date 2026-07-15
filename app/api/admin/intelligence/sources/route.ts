import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { ALL_PROVIDERS, REAL_PROVIDERS, getProvider } from "@/lib/sources/access/providers";
import { runSourceBenchmark } from "@/lib/sources/access/benchmark";

// GET  /api/admin/intelligence/sources            → provider health (no secrets)
// POST /api/admin/intelligence/sources            → run a benchmark query
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const health = await Promise.all(ALL_PROVIDERS.map((p) => p.health()));

  // Latest validation-benchmark summary (local artifact; honest absence note).
  let validation: unknown = null;
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    if (existsSync("ml/data/source-benchmark/latest.json")) {
      validation = JSON.parse(readFileSync("ml/data/source-benchmark/latest.json", "utf8")).summary;
    }
  } catch { /* honest null */ }

  return NextResponse.json({
    providers: health.map((h) => ({ ...h, capabilities: getProvider(h.provider)?.capabilities() })),
    validation_benchmark: validation ?? { status: "not_run_in_this_environment", note: "Run npm run sources:benchmark locally." },
    note: "Credentials are reported by presence only — values never leave the server.",
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  const query = typeof body?.query === "string" && body.query.trim().length >= 3 ? body.query.trim().slice(0, 200) : null;
  if (!query) return NextResponse.json({ error: "query (min 3 chars) required" }, { status: 400 });
  const includeFixture = body?.include_fixture === true;
  const providers = includeFixture ? ALL_PROVIDERS : REAL_PROVIDERS;
  const result = await runSourceBenchmark(providers, {
    query,
    region: typeof body?.region === "string" ? body.region : null,
    language: typeof body?.language === "string" ? body.language : null,
    max_results: 8,
    query_type: "generic",
  });
  return NextResponse.json({ result });
}
