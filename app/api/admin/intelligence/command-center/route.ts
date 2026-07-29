import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAdminIntelligenceViewModel } from "@/lib/intelligence/admin-view-model";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const model = await loadAdminIntelligenceViewModel();
    return NextResponse.json(model, {
      headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    console.error("[admin-intelligence] view model failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: "Intelligence Command Center could not be assembled.",
      detail: "No intelligence was fabricated. Retry or inspect server availability.",
    }, { status: 503 });
  }
}
