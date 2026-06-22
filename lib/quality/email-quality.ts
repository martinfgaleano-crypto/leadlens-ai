export type EmailType    = "corporate" | "generic" | "missing";
export type EmailQuality = "high" | "medium" | "low" | "missing";

const GENERIC_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "yahoo.com", "icloud.com", "outlook.com",
  "live.com", "aol.com", "mail.com", "protonmail.com", "ymail.com",
  "msn.com", "comcast.net", "sbcglobal.net", "verizon.net",
]);

export function classifyEmail(email: string | null | undefined): {
  email_type: EmailType;
  email_quality: EmailQuality;
} {
  if (!email || !email.includes("@")) {
    return { email_type: "missing", email_quality: "missing" };
  }

  const parts  = email.split("@");
  const domain = parts[parts.length - 1].toLowerCase();

  if (GENERIC_DOMAINS.has(domain)) {
    return { email_type: "generic", email_quality: "medium" };
  }

  return { email_type: "corporate", email_quality: "high" };
}
