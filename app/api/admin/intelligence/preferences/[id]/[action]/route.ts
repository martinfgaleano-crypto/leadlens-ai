import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

// POST /api/admin/intelligence/preferences/[id]/[action]
// action ∈ freeze | revoke. Freeze = hold current state, no automatic updates,
// ranking stays off. Revoke = no effect + excluded from interpretation, history
// preserved (never silently deleted). Both audited with actor + versions.

const ACTIONS = ["freeze", "revoke"] as const;

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function POST(req: NextRequest, { params }: { params: { id: string; action: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { id, action } = params;
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return NextResponse.json({ error: `Unknown action "${action}" — use freeze or revoke.` }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid preference id." }, { status: 400 });
  }
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: pref } = await db.from("learned_preferences")
    .select("id, status, version, audit_trail")
    .eq("id", id)
    .maybeSingle();
  if (!pref) return NextResponse.json({ error: "Preference not found." }, { status: 404 });
  if (pref.status === "explicit") {
    return NextResponse.json({ error: "Explicit preferences are managed through customer settings, not intelligence actions." }, { status: 422 });
  }
  if (pref.status === "revoked") {
    return NextResponse.json({ error: "Preference is already revoked." }, { status: 409 });
  }

  const newStatus = action === "freeze" ? "frozen" : "revoked";
  const trail = Array.isArray(pref.audit_trail) ? pref.audit_trail : [];
  const { error } = await db.from("learned_preferences").update({
    status: newStatus,
    can_affect_ranking: false, // both actions guarantee ranking stays off
    version: (pref.version ?? 1) + 1,
    audit_trail: [...trail.slice(-19), {
      at: new Date().toISOString(), actor: "admin", change: action,
      previous_status: pref.status, previous_version: pref.version ?? 1,
    }],
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ ok: true, id, status: newStatus });
}
