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

// ─── Deterministic ICP ────────────────────────────────────────────────────────

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
  const signals = inferBuyingSignals(text);

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
    ideal_signals: signals,
    product_detected: onboarding.offer_description.slice(0, 120),
    problem_solved: onboarding.value_proposition.slice(0, 120),
    buyer_profile: titles.slice(0, 3).join(", ") + " at target company",
    icp_clarity_score: computeICPClarityScore(onboarding),
    icp_risks: buildICPRisks(onboarding, industries),
    top_priority_signals: signals.slice(0, 3),
  };

  const criteria: LeadSearchCriteria = {
    target_industries: industries,
    target_company_size: sizeRangeToArray(sizeRange),
    target_job_titles: titles,
    target_geography: regionToGeography(onboarding.target_market_region),
    excluded_industries: ["Government", "Non-profit", "Education"],
    buying_signals: signals,
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
    sender_company_name: onboarding.company_name,
    sender_company_description: onboarding.company_description,
  };

  return { icp, criteria };
}

// ─── Claude-powered ICP ───────────────────────────────────────────────────────

async function buildClaudeICP(
  onboarding: OnboardingData,
  plan: PlanType
): Promise<{ icp: ICP; criteria: LeadSearchCriteria }> {
  const { callClaudeJSON } = await import("@/lib/anthropic");

  const lang = onboarding.output_language ?? "en";
  const region = onboarding.target_market_region ?? "global";

  const SYSTEM = `You are a B2B commercial intelligence strategist building an Ideal Customer Profile.
Your job is to extract a SPECIFIC, ACTIONABLE ICP from the business inputs — not generic categories.
Rules:
- Be specific: "Logistics software companies with 50–200 employees actively expanding their fleet tracking" beats "Logistics"
- Identify the real buyer (role, responsibility, pain) — not just a job title
- Detect what buying signals actually predict this company will buy — e.g. "recently hired SDR" not "growing company"
- Rate ICP clarity honestly — if the user's description is vague, say so in icp_risks
- Never invent specific company names or made-up examples
- Identify hard exclusions that would waste outreach effort
Return only valid JSON.`;

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
    "target_industries": ["specific industry segment — not just 'SaaS'"],
    "target_titles": ["buyer role that would evaluate this offer"],
    "company_size_range": "X–Y employees",
    "pain_points": ["specific company-level pain that this offer solves"],
    "disqualifiers": ["hard exclusions — company types that cannot benefit"],
    "ideal_signals": ["specific observable event that predicts purchase intent"],
    "product_detected": "1 sentence: what the seller actually sells",
    "problem_solved": "1 sentence: the specific problem it eliminates",
    "buyer_profile": "1 sentence: who at the target company evaluates this offer and why",
    "icp_clarity_score": 0,
    "icp_risks": ["risks in this ICP definition — vague segment, over-broad geography, etc."],
    "top_priority_signals": ["top 3 signals that most strongly predict opportunity"],
    "exclusions_explicit": ["additional hard exclusions beyond obvious ones"]
  },
  "criteria": {
    "target_industries": ["string"],
    "target_company_size": ["string"],
    "target_job_titles": ["string"],
    "target_geography": ["string — match target_market_region: ${region}"],
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
    "localization_notes": "${buildLocalizationNotes(lang, region)}"
  }
}`;

  const result = await callClaudeJSON<{ icp: ICP; criteria: LeadSearchCriteria }>(SYSTEM, prompt, 2500);
  // Inject sender identity — Claude doesn't know to include these
  result.criteria.sender_company_name = onboarding.company_name;
  result.criteria.sender_company_description = onboarding.company_description;
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeICPClarityScore(onboarding: OnboardingData): number {
  let score = 0;
  if (onboarding.offer_description.length > 50) score += 25;
  if (onboarding.value_proposition.length > 40) score += 20;
  if (onboarding.target_customer_description.length > 60) score += 25;
  if (onboarding.average_ticket) score += 15;
  if (onboarding.target_market_region && onboarding.target_market_region !== "global") score += 15;
  return Math.min(100, score);
}

function buildICPRisks(onboarding: OnboardingData, industries: string[]): string[] {
  const risks: string[] = [];
  if (industries.length > 4) risks.push("Too many target industries — consider narrowing to 2–3 primary segments");
  if (onboarding.target_customer_description.length < 60) risks.push("Target customer description is vague — more specificity improves matching accuracy");
  if (!onboarding.average_ticket) risks.push("No average ticket defined — harder to calibrate account size fit");
  if (onboarding.target_market_region === "global") risks.push("Global geography broadens the pool but reduces signal specificity — consider narrowing");
  return risks;
}

function inferBuyingSignals(text: string): string[] {
  const signals: string[] = [];
  if (/pipeline|lead|prospect|outbound/.test(text)) signals.push("Job postings for SDR, BDR, or sales development roles");
  if (/sdr|hire|headcount|team|sales rep/.test(text)) signals.push("Recently hired VP Sales, CRO, or Head of Revenue");
  if (/meeting|book|appoint|convert/.test(text)) signals.push("Company posted about pipeline or conversion challenges");
  if (/personaliz|generic|cold email|reply/.test(text)) signals.push("Visible intent to improve outbound or outreach quality");
  if (/time|manual|slow|efficiency/.test(text)) signals.push("Hiring automation, RevOps, or growth operations roles");
  if (/logistic|supply chain|distribut/.test(text)) signals.push("Expanding fleet, new warehouse, or new distribution routes announced");
  if (/food|export|import|commodity/.test(text)) signals.push("Attending trade shows or seeking new supplier/buyer relationships");
  if (signals.length === 0) {
    signals.push("Hiring patterns suggesting commercial growth");
    signals.push("Recent product launch or expansion announcement");
    signals.push("Raised funding in the last 12 months");
  }
  return signals.slice(0, 5);
}

function inferIndustries(text: string): string[] {
  const map: [RegExp, string][] = [
    [/\bsaas\b|\bsoftware\b|\btech\b/, "B2B SaaS"],
    [/\bconsult/, "Consulting"],
    [/\bagency\b|\bmarketing\b/, "Marketing / Agency"],
    [/\becomm|\bretail/, "E-commerce"],
    [/\bfinance\b|\bfintech\b/, "FinTech"],
    [/\bhealth|\bmedic/, "HealthTech"],
    [/\bmanufactur/, "Manufacturing"],
    [/\blogistic|\bsupply chain|\btransport|\bfreight/, "Logistics / Supply Chain"],
    [/\bfood|\bfmcg|\bgrocery|\bdistribut|\bimport|\bexport/, "Food & Distribution"],
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
    [/\blogistic|\bsupply|\boperations\b/, ["VP Operations", "Director of Logistics", "Head of Supply Chain"]],
    [/\bimport|\bexport|\btrade\b/, ["Purchasing Manager", "Import/Export Director", "Head of Procurement"]],
  ];
  const found = map.filter(([re]) => re.test(text)).flatMap(([, labels]) => labels);
  const unique = Array.from(new Set(found));
  return unique.length > 0 ? unique.slice(0, 6) : ["CEO", "Founder", "VP Sales", "Head of Growth"];
}

function inferCompanySize(text: string): string {
  if (/\bstartup\b|\bearly.stage\b|\bpre.seed\b/.test(text)) return "5–50 employees";
  if (/\benterprise\b|\blarge\b/.test(text)) return "500–5000 employees";
  if (/\bsmb\b|\bsmall business\b/.test(text)) return "10–100 employees";
  if (/20.500|50.500|20 to 500|50 to 500/.test(text)) return "20–500 employees";
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
  if (/distribut|supplier|buyer|import|export/.test(lower)) pains.push("Difficulty finding qualified distributors or buyers in target markets");
  if (/market intel|intelligence|signal/.test(lower)) pains.push("No structured way to identify high-intent accounts before outreach");
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
  if (range.includes("20–500")) return ["11-50", "51-200", "201-500"];
  if (range.includes("50–500")) return ["51-200", "201-500"];
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
