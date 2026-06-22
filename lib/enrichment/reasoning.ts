import type { Seniority } from "@/lib/quality/title-normalizer";
import type { EmailType } from "@/lib/quality/email-quality";
import type { Temperature } from "./temperature";
import type { BuyerFit } from "./buyer-fit";

const US_CA = new Set([
  "united states", "us", "usa", "u.s.", "u.s.a.",
  "canada", "ca", "can",
]);

interface ReasoningInput {
  seniority: Seniority;
  email_type: EmailType;
  email_quality: string;
  website: string | null | undefined;
  linkedin_url: string | null | undefined;
  country: string | null | undefined;
  temperature: Temperature;
  buyer_fit: BuyerFit;
}

// ── Strengths ─────────────────────────────────────────────────────────────────

export function computeStrengths(input: ReasoningInput): string[] {
  const out: string[] = [];

  if (input.seniority === "C-Level")  out.push("C-Level contact");
  else if (input.seniority === "VP")  out.push("VP-level contact");
  else if (input.seniority === "Director") out.push("Director-level contact");

  if (input.email_type === "corporate") out.push("Corporate email");
  if (input.linkedin_url)               out.push("LinkedIn present");
  if (input.website)                    out.push("Website present");

  const country = (input.country ?? "").toLowerCase().trim();
  if (US_CA.has(country)) out.push("US / Canada market");

  return out;
}

// ── Weaknesses ────────────────────────────────────────────────────────────────

export function computeWeaknesses(input: ReasoningInput): string[] {
  const out: string[] = [];

  if (input.email_type === "missing")  out.push("Missing email");
  else if (input.email_type === "generic") out.push("Generic email");

  if (!input.linkedin_url) out.push("Missing LinkedIn");
  if (!input.website)      out.push("No website");

  if (input.seniority === "Individual Contributor") out.push("Low seniority");
  if (input.seniority === "Unknown")                out.push("Unknown seniority");

  return out;
}

// ── AI reasoning sentence ──────────────────────────────────────────────────────

export function generateReasoning(
  input: ReasoningInput,
  strengths: string[],
  weaknesses: string[],
): string {
  const { temperature, buyer_fit, seniority, email_type } = input;

  // Opening based on temperature + buyer fit
  let opening: string;
  if (temperature === "Hot") {
    opening = "Strong lead.";
  } else if (temperature === "Warm" && buyer_fit !== "Weak fit") {
    opening = "Solid lead.";
  } else if (buyer_fit === "Weak fit") {
    opening = "Weak lead.";
  } else {
    opening = "Moderate lead.";
  }

  // Seniority phrase
  const seniorityPhrase: Record<Seniority, string> = {
    "C-Level":              "Decision-maker level",
    "VP":                   "VP-level contact",
    "Director":             "Director-level contact",
    "Manager":              "Manager-level contact",
    "Individual Contributor": "Individual contributor",
    "Unknown":              "Seniority unknown",
  };

  // Email phrase
  const emailPhrase =
    email_type === "corporate" ? "corporate email"
    : email_type === "generic" ? "generic email"
    : "no email on file";

  // LinkedIn phrase
  const linkedInPhrase = input.linkedin_url ? "LinkedIn profile present" : "no LinkedIn profile";

  // Core sentence
  const core = `${seniorityPhrase[seniority]} with ${emailPhrase} and ${linkedInPhrase}.`;

  // Qualifiers from weaknesses
  if (weaknesses.length === 0) {
    return `${opening} ${core} All key signals are positive.`;
  }

  if (weaknesses.length >= 3) {
    return `${opening} ${core} Multiple data gaps: ${weaknesses.slice(0, 3).join(", ").toLowerCase()}.`;
  }

  return `${opening} ${core}`;
}
