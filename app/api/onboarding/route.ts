import { NextResponse } from "next/server";

/** Legacy checkout onboarding. Current pilot intake is managed explicitly. */
export async function POST() {
  return NextResponse.json(
    { error: "Legacy onboarding is no longer available.", code: "LEGACY_ONBOARDING_RETIRED" },
    { status: 410 },
  );
}
