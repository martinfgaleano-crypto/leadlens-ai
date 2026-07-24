import { NextResponse } from "next/server";

/**
 * Legacy contact-list upload is permanently retired from the current product.
 * LeadLens is account opportunity intelligence and does not accept personal
 * names, emails, titles, phone numbers, or LinkedIn profile lists.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Contact-list upload is no longer supported.",
      code: "LEGACY_CONTACT_UPLOAD_RETIRED",
    },
    { status: 410 },
  );
}
