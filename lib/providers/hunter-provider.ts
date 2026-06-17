import type { EmailFindResult } from "@/types";
import type { LeadCandidate } from "@/types";

/**
 * Hunter.io Email Provider
 * Hunter specializes in finding and verifying business email addresses.
 * Best for: email finding by domain + name, email verification.
 * NOT a full lead database — use alongside Apollo or PDL.
 *
 * Requires: HUNTER_API_KEY
 * Docs: https://hunter.io/api-documentation
 * Free tier: 25 searches/month
 * Paid: from $49/month
 */

const HUNTER_API_URL = "https://api.hunter.io/v2";

interface HunterFindResponse {
  data?: {
    email?: string;
    score?: number;
    sources?: { domain?: string; uri?: string }[];
  };
  meta?: { params: object };
  errors?: { details: string }[];
}

interface HunterVerifyResponse {
  data?: {
    result: "deliverable" | "risky" | "undeliverable" | "unknown";
    score?: number;
    email?: string;
  };
}

/**
 * Find email for a candidate using Hunter's Email Finder API.
 * Uses company domain + first/last name.
 */
export async function hunterFindEmail(candidate: LeadCandidate): Promise<EmailFindResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { email_status: "not_found", confidence_score: 0 };

  const nameParts = (candidate.name ?? "").split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  const domain = candidate.domain ?? extractDomain(candidate.company);

  if (!domain || !firstName) {
    return { email_status: "not_found", confidence_score: 0 };
  }

  try {
    const params = new URLSearchParams({
      domain,
      first_name: firstName,
      last_name: lastName,
      api_key: apiKey,
    });

    const res = await fetch(`${HUNTER_API_URL}/email-finder?${params.toString()}`);
    if (!res.ok) return { email_status: "not_found", confidence_score: 0 };

    const data: HunterFindResponse = await res.json();
    if (!data.data?.email) return { email_status: "not_found", confidence_score: 0 };

    const score = (data.data.score ?? 0) / 100;

    return {
      email: data.data.email,
      email_status: score >= 0.8 ? "verified" : "unknown",
      confidence_score: score,
      source: "hunter",
    };
  } catch {
    return { email_status: "not_found", confidence_score: 0 };
  }
}

/**
 * Verify an existing email address using Hunter's Email Verifier API.
 */
export async function hunterVerifyEmail(email: string): Promise<EmailFindResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { email: email, email_status: "unknown", confidence_score: 0 };

  try {
    const params = new URLSearchParams({ email, api_key: apiKey });
    const res = await fetch(`${HUNTER_API_URL}/email-verifier?${params.toString()}`);
    if (!res.ok) return { email, email_status: "unknown", confidence_score: 0 };

    const data: HunterVerifyResponse = await res.json();
    const result = data.data?.result;

    return {
      email,
      email_status:
        result === "deliverable" ? "verified" :
        result === "undeliverable" ? "invalid" :
        "unknown",
      confidence_score: (data.data?.score ?? 0) / 100,
      source: "hunter",
    };
  } catch {
    return { email, email_status: "unknown", confidence_score: 0 };
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractDomain(companyName: string): string {
  // Fallback: generate a likely domain from company name
  // This is a best-effort heuristic — Hunter's own domain search is more reliable
  return companyName
    .toLowerCase()
    .replace(/\s+(inc|llc|ltd|corp|co|company|group|partners|consulting)\.?$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .concat(".com");
}
