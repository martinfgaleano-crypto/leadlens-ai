import type { getSupabaseClient } from "@/lib/supabase/client";

/** Create the profile row for a newly authenticated user (idempotent). The DB trigger on signup
 *  normally creates it; this is the defensive fallback for the OTP path. Duplicate → no-op. */
export async function ensureProfile(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase.from("profiles").insert({ id: userId, email }).select().single();
  if (error && !error.message.toLowerCase().includes("duplicate") && error.code !== "23505") {
    console.warn("[auth] profile creation error:", error.message);
  }
}
