import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { reviewCandidate, approveCandidate, rejectCandidate } from "@/lib/vault-candidates/reviewer";
import { promoteCandidate } from "@/lib/vault-candidates/promote";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ─── PATCH /api/admin/vault-candidates/[id] ───────────────────────────────────
// Perform a review action on a single candidate.
// Body: { action: "review" | "approve" | "reject" | "promote", notes?: string }

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const id = params.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const action = String(body.action ?? "");
  const notes  = typeof body.notes === "string" ? body.notes : undefined;

  switch (action) {
    case "review": {
      const result = await reviewCandidate(client, id, notes);
      return NextResponse.json(result);
    }
    case "approve": {
      await approveCandidate(client, id, notes);
      return NextResponse.json({ status: "approved" });
    }
    case "reject": {
      await rejectCandidate(client, id, notes);
      return NextResponse.json({ status: "rejected" });
    }
    case "promote": {
      const result = await promoteCandidate(client, id);
      if (result.status === "error") {
        return NextResponse.json({ error: result.reason }, { status: 422 });
      }
      return NextResponse.json(result);
    }
    default:
      return NextResponse.json(
        { error: `Unknown action "${action}". Valid: review | approve | reject | promote` },
        { status: 400 },
      );
  }
}

// ─── GET /api/admin/vault-candidates/[id] ────────────────────────────────────
// Returns a single candidate record.

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data, error } = await client
    .from("vault_candidates")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(data);
}
