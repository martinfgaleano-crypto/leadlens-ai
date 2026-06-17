import type { OnboardingData, ICP, LeadSearchCriteria, PlanType } from "@/types";
import { PLAN_LEAD_COUNT } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

export async function runICPAgent(
  onboarding: OnboardingData,
  plan: PlanType
): Promise<{ icp: ICP; criteria: LeadSearchCriteria }> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return buildDeterministicICP(onboarding, plan);
  }
  return buildClaudeICP(onboarding, plan);
}

// ─── Deterministic ICP (no AI needed) ────────────────────────────────────────

export function buildDeterministicICP(
  onboarding: OnboardingData,
  plan: PlanType
): { icp: ICP; criteria: LeadSearchCriteria } {
  const text = [
    onboarding.target_customer_description,
    onboarding.company_description,
    onboarding.offer_description,
  ]
    .join(" ")
    .toLowerCase();

  const industries = inferIndustries(text);
  const titles = inferTitles(text);
  const sizeRange = inferCompanySize(text);
  const pains = inferPainPoints(onboarding.offer_description + " " + onboarding.value_proposition);

  const icp: ICP = {
    target_industries: industries,
    target_titles: titles,
    company_size_range: sizeRange,
    pain_points: pains,
    disqualifiers: [
      "No budget for external vendors",
      "Government or non-profit",
      "In-house SDR team already at scale",
    ],
    ideal_signals: [
      "Recently posted about pipeline challenges",
      "Job postings for SDR or BDR roles",
      "Recently hired VP Sales or Head of Growth",
      "Recently raised seed or Series A funding",
    ],
  };

  const criteria: LeadSearchCriteria = {
    target_industries: industries,
    target_company_size: sizeRangeToArray(sizeRange),
    target_job_titles: titles,
    target_geography: regionToGeography(onboarding.target_market_region),
    excluded_industries: ["Government", "Non-profit", "Education"],
    buying_signals: icp.ideal_signals,
    disqualification_criteria: icp.disqualifiers,
    average_ticket: onboarding.average_ticket,
    offer_summary: onboarding.offer_description,
    value_proposition: onboarding.value_proposition,
    tone: onboarding.tone,
    plan,
    lead_count: PLAN_LEAD_COUNT[plan],
    output_language: onboarding.output_language ?? "en",
    target_market_region: onboarding.target_market_region ?? "global",
    outreach_language: languageLabel(onboarding.output_language),
    localization_notes: buildLocalizationNotes(onboarding.output_language, onboarding.target_market_region),
  };

  return { icp, criteria };
}

// ─── Claude-powered ICP ───────────────────────────────────────────────────────

async function buildClaudeICP(
  onboarding: OnboardingData,
  plan: PlanType
): Promise<{ icp: ICP; criteria: LeadSearchCriteria }> {
  const { callClaudeJSON } = await import("@/lib/anthropic");

  const SYSTEM = `You are a B2B sales strategist. Extract a precise ICP and lead search criteria from the business inputs. Be specific. No vague categories. Return only valid JSON.`;

  const lang = onboarding.output_language ?? "en";
  const region = onboarding.target_market_region ?? "global";

  const prompt = `Business: ${onboarding.company_name}
Description: ${onboarding.company_description}
Offer: ${onboarding.offer_description}
Value prop: ${onboarding.value_proposition}
Target customer: ${onboarding.target_customer_description}
Average ticket: ${onboarding.average_ticket ?? "unknown"}
Tone: ${onboarding.tone}
Plan: ${plan} (${PLAN_LEAD_COUNT[plan]} leads)
Output language: ${languageLabel(lang)}
Target market region: ${region}

Return JSON:
{
  "icp": {
    "target_industries": ["string"],
    "target_titles": ["string"],
    "company_size_range": "string",
    "pain_points": ["string"],
    "disqualifiers": ["string"],
    "ideal_signals": ["string"]
  },
  "criteria": {
    "target_industries": ["string"],
    "target_company_size": ["string"],
    "target_job_titles": ["string"],
    "target_geography": ["string — match the target_market_region"],
    "excluded_industries": ["string"],
    "buying_signals": ["string"],
    "disqualification_criteria": ["string"],
    "offer_summary": "string",
    "value_proposition": "string",
    "tone": "${onboarding.tone}",
    "plan": "${plan}",
    "lead_count": ${PLAN_LEAD_COUNT[plan]},
    "output_language": "${lang}",
    "target_market_region": "${region}",
    "outreach_language": "${languageLabel(lang)}",
    "localization_notes": "string"
  }
}`;

  return callClaudeJSON<{ icp: ICP; criteria: LeadSearchCriteria }>(SYSTEM, prompt, 2000);
}

// ─── Keyword helpers ──────────────────────────────────────────────────────────

function inferIndustries(text: string): string[] {
  const map: [RegExp, string][] = [
    [/\bsaas\b|\bsoftware\b|\btech\b/, "B2B SaaS"],
    [/\bconsult/, "Consulting"],
    [/\bagency\b|\bmarketing\b/, "Marketing / Agency"],
    [/\becomm|\bretail/, "E-commerce"],
    [/\bfinance\b|\bfintech\b/, "FinTech"],
    [/\bhealth|\bmedic/, "HealthTech"],
    [/\bmanufactur/, "Manufacturing"],
    [/\blogistic|\bsupply chain/, "Logistics"],
  ];
  const found = map.filter(([re]) => re.test(text)).map(([, label]) => label);
  return found.length > 0 ? found : ["B2B SaaS", "Professional Services"];
}

function inferTitles(text: string): string[] {
  const map: [RegExp, string[]][] = [
    [/\bfounder|\bceo\b/, ["CEO", "Co-founder", "Founder"]],
    [/\bsales\b/, ["VP of Sales", "Head of Sales", "Sales Director"]],
    [/\bmarketing\b/, ["VP of Marketing", "CMO", "Head of Marketing"]],
    [/\bgrowth\b/, ["Head of Growth", "Growth Lead"]],
    [/\brevenue\b/, ["CRO", "VP Revenue"]],
  ];
  const found = map.filter(([re]) => re.test(text)).flatMap(([, labels]) => labels);
  const unique = Array.from(new Set(found));
  return unique.length > 0 ? unique.slice(0, 6) : ["CEO", "Founder", "VP Sales", "Head of Growth"];
}

function inferCompanySize(text: string): string {
  if (/\bstartup\b|\bearly.stage\b|\bpre.seed\b/.test(text)) return "5–50 employees";
  if (/\benterprise\b|\blarge\b/.test(text)) return "500–5000 employees";
  if (/\bsmb\b|\bsmall business\b/.test(text)) return "10–100 employees";
  return "20–200 employees";
}

function inferPainPoints(text: string): string[] {
  const lower = text.toLowerCase();
  const pains: string[] = [];
  if (/pipeline|lead|prospect/.test(lower)) pains.push("Struggling to build consistent B2B pipeline");
  if (/sdr|hire|headcount/.test(lower)) pains.push("Can't justify full-time SDR hire");
  if (/meeting|book|appoint/.test(lower)) pains.push("Low qualified meeting booking rate");
  if (/personaliz|generic|reply/.test(lower)) pains.push("Generic outreach with poor reply rates");
  if (/time|manual|slow/.test(lower)) pains.push("Too much time on manual prospecting");
  return pains.length > 0 ? pains : [
    "Inconsistent outbound pipeline",
    "Low reply rates on cold outreach",
    "No structured prospecting process",
  ];
}

function sizeRangeToArray(range: string): string[] {
  if (range.includes("5–50")) return ["1-10", "11-50"];
  if (range.includes("10–100")) return ["11-50", "51-200"];
  if (range.includes("20–200")) return ["11-50", "51-200"];
  if (range.includes("500–5000")) return ["501-1000", "1001-5000"];
  return ["11-50", "51-200"];
}

function regionToGeography(region?: string): string[] {
  switch (region) {
    case "north_america": return ["United States", "Canada"];
    case "latin_america": return ["Mexico", "Brazil", "Argentina", "Colombia", "Chile"];
    case "europe": return ["United Kingdom", "Germany", "France", "Spain", "Netherlands", "Sweden"];
    case "asia": return ["Japan", "Singapore", "Australia", "India", "South Korea"];
    default: return ["United States", "Canada", "United Kingdom", "Germany", "Australia"];
  }
}

function languageLabel(lang?: string): string {
  switch (lang) {
    case "es": return "Spanish";
    case "pt": return "Portuguese (Brazil)";
    case "ja": return "Japanese";
    default: return "English";
  }
}

function buildLocalizationNotes(lang?: string, region?: string): string {
  const notes: string[] = [];
  if (lang === "es") {
    notes.push("Write in neutral Latin American Spanish. Avoid 'vosotros'. Do not use 'vos'. Use 'usted' for formal, 'tú' for informal.");
    if (region === "latin_america") notes.push("Reference Latin American business context when relevant.");
  }
  if (lang === "pt") {
    notes.push("Write in Brazilian Portuguese. Use 'você' not 'tu' for business tone. Keep professional and natural.");
  }
  if (lang === "ja") {
    notes.push("Write in business Japanese (keigo). Use polite form (丁寧語). Keep email concise — shorter than English equivalent.");
  }
  return notes.join(" ") || "English — no special localization required.";
}
