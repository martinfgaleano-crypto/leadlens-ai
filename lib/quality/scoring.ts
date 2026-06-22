import type { Seniority } from "./title-normalizer";
import type { EmailType } from "./email-quality";

interface LeadScoringInput {
  seniority: Seniority;
  email_type: EmailType;
  website: string | null | undefined;
  linkedin_url: string | null | undefined;
  country: string | null | undefined;
}

const US_CA = new Set([
  "united states", "us", "usa", "u.s.", "u.s.a.",
  "canada", "ca", "can",
]);

export function computeLeadScore(input: LeadScoringInput): number {
  let score = 0;

  // Seniority weights
  if      (input.seniority === "C-Level")  score += 35;
  else if (input.seniority === "VP")        score += 25;
  else if (input.seniority === "Director")  score += 18;
  else if (input.seniority === "Manager")   score += 10;

  // Email quality weights
  if      (input.email_type === "corporate") score += 20;
  else if (input.email_type === "generic")   score += 8;
  else if (input.email_type === "missing")   score -= 15;

  // Digital presence
  if (input.website)     score += 8;
  if (input.linkedin_url) score += 8;
  else                   score -= 10;

  // Geography
  const country = (input.country ?? "").toLowerCase().trim();
  if (US_CA.has(country)) score += 10;

  return Math.max(0, Math.min(100, score));
}

interface ConfidenceInput {
  email: string | null | undefined;
  website: string | null | undefined;
  linkedin_url: string | null | undefined;
  title: string | null | undefined;
}

export function computeConfidenceScore(input: ConfidenceInput): number {
  let score = 15; // base

  if (input.email)        score += 30;
  if (input.website)      score += 20;
  if (input.linkedin_url) score += 20;
  if (input.title)        score += 10;

  return Math.min(95, score);
}
