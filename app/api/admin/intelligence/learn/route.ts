import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { runPreferenceLearner } from "@/lib/intelligence/preference-learner";

// POST /api/admin/intelligence/learn — run the observation-only preference
// learner (all tenants, or one via { tenant_user_id }). Simple in-process
// guard against concurrent runs (the learner is idempotent anyway, so a race
// would waste work, not corrupt state).
const g = globalThis as typeof globalThis & { __leadlens_learner_running?: boolean };

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  if (g.__leadlens_learner_running) {
    return NextResponse.json({ error: "Learner is already running — try again in a moment." }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  const tenantUserId = typeof body?.tenant_user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.tenant_user_id)
    ? body.tenant_user_id
    : undefined;

  g.__leadlens_learner_running = true;
  try {
    const result = await runPreferenceLearner(tenantUserId);
    return NextResponse.json({ result }, { status: result.ok ? 200 : 503 });
  } finally {
    g.__leadlens_learner_running = false;
  }
}
