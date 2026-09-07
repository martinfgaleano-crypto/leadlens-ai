import { NextRequest, NextResponse } from "next/server";
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

  // Passwordless sign-in / magic-link (signup, magiclink, or bare code): the PKCE code_verifier
  // lives in the browser that started sign-in, so the exchange MUST run client-side. Forward the
  // code + commercial selection to /auth/continue, which establishes the session and continues to
  // checkout with the exact selected product/interval preserved.
  if (code) {
    const cont = new URLSearchParams({ code });
    if (flowQuery) new URLSearchParams(flowQuery.slice(1)).forEach((value, key) => cont.set(key, value));
    return NextResponse.redirect(`${origin}/auth/continue?${cont.toString()}`);
  }

  // Missing code
  return NextResponse.redirect(`${origin}/login?error=verification-failed`);
}
