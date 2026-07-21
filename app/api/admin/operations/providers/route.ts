import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { probeAll, deriveAlerts, PROVIDER_DEFS } from "@/lib/ops/provider-health";

export const dynamic = "force-dynamic";

// Internal rate-limit for forced probes (per process): max 1 forced sweep/min.
let lastForced = 0;

/** GET /api/admin/operations/providers — provider health, credits, usage, alerts.
 *  ?probe=1 forces a live probe sweep (rate-limited). Never exposes secrets. */
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const force = req.nextUrl.searchParams.get("probe") === "1";
  if (force && Date.now() - lastForced < 60_000) {
    return NextResponse.json({ error: "rate_limited", detail: "Probe forzado: máximo 1/min." }, { status: 429 });
  }
  if (force) lastForced = Date.now();
  const statuses = await probeAll(force);
  return NextResponse.json({ version: "provider-health-v1", probed: force, statuses, alerts: deriveAlerts(statuses) });
}

/** POST /api/admin/operations/providers { provider } — test ONE provider live.
 *  Minimal request, audit-logged, rate-limited by the shared sweep limiter. */
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await req.json().catch(() => ({}));
  const id = String(body.provider ?? "");
  if (!PROVIDER_DEFS.some((d) => d.id === id)) return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
  console.log(`[audit] admin provider test: ${id} at ${new Date().toISOString()}`);
  const statuses = await probeAll(true);
  const st = statuses.find((s) => s.id === id);
  return NextResponse.json({ status: st });
}
