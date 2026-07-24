import { NextResponse } from "next/server";

/**
 * Retired public self-serve intake. It previously used the service role to
 * create confirmed users, ICPs and searches from browser-controlled plan and
 * quantity fields. Guided pilots use the authenticated/admin pilot workflow.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Self-serve onboarding is not open.", code: "SELF_SERVE_INTAKE_CLOSED" },
    { status: 410 },
  );
}
