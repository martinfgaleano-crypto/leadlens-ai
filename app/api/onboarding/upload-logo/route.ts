import { NextResponse } from "next/server";

/** Public unauthenticated logo storage was part of the retired intake flow. */
export async function POST() {
  return NextResponse.json(
    { error: "Public logo upload is no longer available.", code: "PUBLIC_LOGO_UPLOAD_RETIRED" },
    { status: 410 },
  );
}
