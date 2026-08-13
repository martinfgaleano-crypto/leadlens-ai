import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { commercialFlowQuery, parseCommercialFlowState } from "@/lib/commercial/customer-flow";

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
  const flowQuery = commercialFlowQuery(parseCommercialFlowState(searchParams));

  // Recovery needs the browser client to retain the exchanged session so it
  // can call updateUser. A server-only exchange would discard that session on
  // redirect because this app does not use the Supabase SSR cookie adapter.
  if (code && type === "recovery") {
    const recovery = new URLSearchParams({ code });
    if (flowQuery) new URLSearchParams(flowQuery.slice(1)).forEach((value, key) => recovery.set(key, value));
    return NextResponse.redirect(`${origin}/reset-password?${recovery.toString()}`);
  }

  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Email verification success — tell login page to show success banner
      const suffix = flowQuery ? `&${flowQuery.slice(1)}` : "";
      return NextResponse.redirect(`${origin}/login?verified=1${suffix}`);
    }
  }

  // Verification failed or missing code
  return NextResponse.redirect(`${origin}/login?error=verification-failed`);
}
