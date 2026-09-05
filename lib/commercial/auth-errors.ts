// Map raw Supabase auth errors to calm, customer-safe copy. Never surface provider internals.

export function friendlyAuthError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("only request")) {
    return "Too many attempts. Please wait a moment before requesting another code.";
  }
  if (m.includes("expired")) return "That code has expired. Request a new one and try again.";
  if (m.includes("invalid") && (m.includes("token") || m.includes("otp") || m.includes("code"))) {
    return "That code isn’t right. Check the latest email and try again.";
  }
  if (m.includes("email") && m.includes("invalid")) return "That email address doesn’t look right. Please check it.";
  if (m.includes("signups not allowed") || m.includes("disabled")) {
    return "Account creation is temporarily unavailable. Please try again shortly.";
  }
  if (m.includes("network") || m.includes("fetch")) return "Network issue — please check your connection and try again.";
  return "Something went wrong. Please try again.";
}

/** Verification-code specific mapping (invalid vs expired vs rate limit). */
export function friendlyOtpError(raw: string): string {
  return friendlyAuthError(raw);
}
