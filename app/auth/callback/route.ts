import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /auth/callback
 *
 * Supabase email verification links redirect here with ?code=<pkce_code>.
 * We exchange the code for a session, then redirect to the login page
 * with a ?verified=1 flag so it can show a success banner.
 *
 * Also handles password reset links (?type=recovery).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "signup" | "recovery" | "magiclink"

  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset — send to dashboard or a reset-password page if we have one
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/dashboard`);
      }
      // Email verification success — tell login page to show success banner
      return NextResponse.redirect(`${origin}/login?verified=1`);
    }
  }

  // Verification failed or missing code
  return NextResponse.redirect(`${origin}/login?error=verification-failed`);
}
