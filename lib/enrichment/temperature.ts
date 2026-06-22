import type { Seniority } from "@/lib/quality/title-normalizer";
import type { EmailType } from "@/lib/quality/email-quality";

export type Temperature = "Hot" | "Warm" | "Cold";

interface TemperatureInput {
  seniority: Seniority;
  email_type: EmailType;
  linkedin_url: string | null | undefined;
}

const HIGH_SENIORITY = new Set<Seniority>(["C-Level", "VP"]);

export function computeTemperature(input: TemperatureInput): Temperature {
  // Cold: missing email — can't reach them
  if (input.email_type === "missing") return "Cold";

  // Hot: decision-maker, reachable via corporate email, AND has LinkedIn
  if (
    HIGH_SENIORITY.has(input.seniority) &&
    input.email_type === "corporate" &&
    input.linkedin_url
  ) {
    return "Hot";
  }

  return "Warm";
}
