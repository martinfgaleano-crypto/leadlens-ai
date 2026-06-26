import type { LeadCandidate, EnrichedLead, LeadSearchCriteria, EvidenceClaim } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

export async function runResearchAgent(
  candidate: LeadCandidate,
  criteria: LeadSearchCriteria
): Promise<EnrichedLead> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return buildDemoEnrichment(candidate, criteria);
  }
  return buildClaudeEnrichment(candidate, criteria);
}

// ─── Demo enrichment ──────────────────────────────────────────────────────────

function buildDemoEnrichment(
  candidate: LeadCandidate,
  criteria: LeadSearchCriteria
): EnrichedLead {
  const industry = candidate.industry ?? "their industry";
  const company = candidate.company;
  const size = candidate.company_size ?? "a mid-sized team";
  const conf = candidate.confidence_score;

  // Extract best signal from raw_context
  const keySignal = candidate.raw_context
    ? extractKeySignal(candidate.raw_context)
    : null;

  const hasStrongSignal = Boolean(
    keySignal &&
    !keySignal.toLowerCase().includes("no confirmed") &&
    !keySignal.toLowerCase().includes("inferred") &&
    keySignal.length > 20
  );

  // Pain hypothesis — specific to offer + company profile
  const offerKeywords = criteria.offer_summary.toLowerCase();
  const painHypothesis = buildPainHypothesis(company, industry, size, offerKeywords, candidate.raw_context);

  // Why now — based on signals or timing context
  const whyNow = buildWhyNow(company, industry, keySignal, hasStrongSignal, conf);

  // Evidence discipline — classify what we know vs infer
  const evidenceDiscipline = buildEvidenceDiscipline(candidate, keySignal, hasStrongSignal);

  // Risks / weaknesses
  const risks = buildRisks(candidate, hasStrongSignal);

  return {
    candidate,
    company_summary: buildCompanySummary(company, industry, size, candidate.location, candidate.raw_context),
    role_relevance: buildRoleRelevance(company, industry, size, criteria.offer_summary),
    inferred_pain: painHypothesis,
    timing_signals: buildTimingSignals(candidate, keySignal, hasStrongSignal),
    evidence: buildEvidence(candidate, hasStrongSignal),
    missing_data: buildMissingData(candidate, hasStrongSignal),
    research_confidence: conf * 0.8,
    why_now: whyNow,
    pain_hypothesis: painHypothesis,
    risks_weaknesses: risks,
    evidence_discipline: evidenceDiscipline,
    segment_fit_note: buildSegmentFitNote(company, industry, criteria),
  };
}

function buildCompanySummary(company: string, industry: string, size: string, location?: string, rawContext?: string): string {
  const geo = location ? ` based in ${location}` : "";
  const contextNote = rawContext
    ? ` Public signals suggest ${rawContext.slice(0, 100).replace(/\.$/, "")} — indicating active commercial activity.`
    : ` Limited public context available — profile derived from industry and company size signals.`;
  return `${company} is a ${size} company${geo} operating in the ${industry} space.${contextNote}`;
}

function buildRoleRelevance(company: string, industry: string, size: string, offerSummary: string): string {
  return `${company} operates in ${industry} at the ${size} scale — a profile that aligns with accounts actively evaluating solutions like: ${offerSummary.slice(0, 80)}. This account matches the ICP on industry fit and company stage.`;
}

function buildPainHypothesis(company: string, industry: string, size: string, offerKeywords: string, rawContext?: string): string {
  if (rawContext && rawContext.length > 30) {
    const contextLower = rawContext.toLowerCase();
    if (/hiring|recruit|sdr|bdr|sales rep/.test(contextLower)) {
      return `${company} appears to be scaling their commercial team — companies at this stage often lack structured account prioritization to maximize new hire productivity.`;
    }
    if (/expand|new market|open|launch/.test(contextLower)) {
      return `${company} appears to be entering new markets or expanding — identifying high-signal accounts before outreach becomes critical during expansion phases.`;
    }
    if (/software|platform|tool|system/.test(contextLower)) {
      return `${company} is investing in technology — likely evaluating vendors in adjacent categories. The window for positioning is before the evaluation process is formalized.`;
    }
  }
  if (/pipeline|prospect|lead/.test(offerKeywords)) {
    return `${industry} companies at the ${size} stage typically lack a systematic way to identify which accounts to contact first — signals exist publicly but are rarely organized into actionable intelligence.`;
  }
  if (/distribut|import|export|supplier/.test(offerKeywords)) {
    return `${company} may face challenges identifying qualified buyers or distributors in target markets without reliable commercial intelligence about who is actively sourcing.`;
  }
  return `${company} likely faces the same challenge common in ${industry}: identifying accounts with genuine purchase intent vs. those that merely fit the ICP profile on paper.`;
}

function buildWhyNow(company: string, industry: string, keySignal: string | null, hasStrongSignal: boolean, conf: number): string {
  if (hasStrongSignal && keySignal) {
    return `Public signal detected: ${keySignal.replace(/\.$/, "")}. This type of event typically correlates with an active vendor evaluation window of 30–90 days.`;
  }
  if (conf >= 0.7) {
    return `Based on available public data, ${company} appears to be in an active commercial investment phase — confidence is moderate (${Math.round(conf * 100)}%). Timing is inferred from company stage, not confirmed signal.`;
  }
  return `No confirmed timing signal available for ${company}. Opportunity angle is based on ${industry} segment patterns and company profile fit. Outreach should be hypothesis-led, not signal-led.`;
}

function buildTimingSignals(candidate: LeadCandidate, keySignal: string | null, hasStrongSignal: boolean): string[] {
  if (hasStrongSignal && keySignal) {
    const signals = [keySignal];
    // Try to extract additional signals from raw_context
    if (candidate.raw_context && candidate.raw_context.length > keySignal.length + 10) {
      const remaining = candidate.raw_context.replace(keySignal, "").trim();
      const secondSignal = extractKeySignal(remaining);
      if (secondSignal && secondSignal !== keySignal && secondSignal.length > 15) {
        signals.push(secondSignal);
      }
    }
    return signals;
  }
  if (!candidate.raw_context) {
    return ["No confirmed public timing signals — opportunity based on company profile and segment fit"];
  }
  return [`Context available but no confirmed buying event detected — inferred from: ${candidate.raw_context.slice(0, 80)}`];
}

function buildEvidence(candidate: LeadCandidate, hasStrongSignal: boolean): string[] {
  const evidence: string[] = [
    `Signal source: ${candidate.source} (confidence: ${Math.round(candidate.confidence_score * 100)}%)`,
  ];
  if (candidate.source_url) evidence.push(`Source reference: ${candidate.source_url}`);
  if (candidate.raw_context) evidence.push(`Public context: ${candidate.raw_context.slice(0, 120)}`);
  if (!hasStrongSignal) evidence.push("Note: opportunity inferred from segment + profile fit, not from a confirmed buying event");
  return evidence;
}

function buildMissingData(candidate: LeadCandidate, hasStrongSignal: boolean): string[] {
  const missing: string[] = [];
  if (!hasStrongSignal) missing.push("No confirmed recent news or commercial trigger verified from public record");
  if (candidate.confidence_score < 0.6) missing.push("Source confidence is below 60% — manual research recommended before outreach");
  if (!candidate.raw_context) missing.push("No direct public signal context — profile derived entirely from company metadata");
  if (!candidate.location) missing.push("Company location not confirmed — geography targeting is approximate");
  return missing.length > 0 ? missing : ["Evidence base is adequate for segment-level outreach"];
}

function buildRisks(candidate: LeadCandidate, hasStrongSignal: boolean): string[] {
  const risks: string[] = [];
  if (candidate.confidence_score < 0.5) risks.push(`Low evidence confidence (${Math.round(candidate.confidence_score * 100)}%) — outreach assumptions may be wrong`);
  if (!hasStrongSignal) risks.push("No confirmed buying signal — outreach is ICP-hypothesis-led, response rate may be lower");
  if (!candidate.raw_context) risks.push("No public context available — company pain is inferred from industry segment, not observed behavior");
  if (candidate.confidence_score < 0.3) risks.push("Very low confidence — recommend manual review before including in any outreach sequence");
  return risks;
}

function buildEvidenceDiscipline(candidate: LeadCandidate, keySignal: string | null, hasStrongSignal: boolean): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];

  if (hasStrongSignal && keySignal) {
    claims.push({ claim: keySignal, type: "verified_public_signal" });
  }

  if (candidate.industry) {
    claims.push({
      claim: `Company operates in ${candidate.industry} sector`,
      type: candidate.confidence_score >= 0.7 ? "inferred_from_context" : "weak_inference",
    });
  }

  if (candidate.company_size) {
    claims.push({
      claim: `Company size: ${candidate.company_size}`,
      type: "inferred_from_context",
    });
  }

  if (!candidate.raw_context) {
    claims.push({
      claim: "Pain hypothesis and timing are inferred — no direct public signal observed",
      type: "missing_evidence",
    });
  }

  return claims;
}

function buildSegmentFitNote(company: string, industry: string, criteria: LeadSearchCriteria): string {
  const targetIndustries = criteria.target_industries.map(i => i.toLowerCase());
  const industryLower = industry.toLowerCase();
  const isDirectMatch = targetIndustries.some(t => industryLower.includes(t) || t.includes(industryLower));
  if (isDirectMatch) {
    return `${company} is in a directly targeted segment (${industry}) — strong ICP segment match.`;
  }
  return `${company}'s industry (${industry}) is adjacent to the target segments. Validate whether this account type has historically converted for similar offers.`;
}

// Extracts the most actionable timing signal from raw_context.
function extractKeySignal(rawContext: string): string {
  const sentences = rawContext
    .split(/\.\s+/)
    .map(s => s.trim().replace(/\.$/, ""))
    .filter(s => s.length > 12);

  const TRIGGER_PATTERNS = /\b(recently|just|new\b|hired|raised|launched|growing|building|looking|pipeline|outbound|sdr|bdr|no\s+dedic|wants|ready|trying|expanding|opened|acquired|announced|seeking|partnered)\b/i;
  const bestSignal = sentences.find(s => TRIGGER_PATTERNS.test(s));
  if (bestSignal) return bestSignal;

  const byLength = [...sentences].sort((a, b) => b.length - a.length);
  return byLength[0] ?? rawContext.slice(0, 110).replace(/\.$/, "");
}

// ─── Claude + Tavily enrichment ───────────────────────────────────────────────

async function buildClaudeEnrichment(
  candidate: LeadCandidate,
  criteria: LeadSearchCriteria
): Promise<EnrichedLead> {
  const { callClaudeJSON } = await import("@/lib/anthropic");

  let webContext = "";
  if (process.env.TAVILY_API_KEY && candidate.company) {
    try {
      const { searchTavilyForLead } = await import("@/lib/providers/tavily-lead-provider");
      webContext = await searchTavilyForLead(candidate.company, candidate.industry);
    } catch {
      // Tavily failure is non-blocking
    }
  }

  const SYSTEM = `You are a senior B2B commercial intelligence analyst building account-level opportunity research.
Focus on the COMPANY as a whole — not on any individual contact or decision-maker.

Evidence discipline rules — this is critical:
- Classify every major claim as one of: verified_public_signal | inferred_from_context | weak_inference | missing_evidence
- verified_public_signal: confirmed from raw_context or web_context (a real event, announcement, or observable fact)
- inferred_from_context: a reasonable inference based on industry, company size, or segment patterns
- weak_inference: a guess with thin supporting evidence — be honest about this
- missing_evidence: something we don't know and shouldn't pretend to know

Language discipline:
- For verified signals: "Recently hired...", "Announced...", "Reports indicate..."
- For inferences: "appears to", "suggests", "based on available public signals", "may indicate"
- NEVER say: "they need", "they are struggling", "they are buying", "they are ready to purchase"
- Only put confirmed events in timing_signals — inference goes in pain_hypothesis and why_now

Return only valid JSON.`;

  const userMsg = `Offer: ${criteria.offer_summary}
Company: ${candidate.company}
Industry: ${candidate.industry ?? "unknown"} | Size: ${candidate.company_size ?? "unknown"} | Location: ${candidate.location ?? "unknown"}
Public source: ${candidate.source} | Confidence: ${Math.round(candidate.confidence_score * 100)}%
${candidate.raw_context ? `Raw context (public signals observed): ${candidate.raw_context}` : "Raw context: none"}
Web context (live search): ${webContext || "none available"}

Return JSON:
{
  "company_summary": "2-3 sentences about this company — its market, scale, and commercially relevant characteristics",
  "role_relevance": "Why this account is a relevant opportunity for the offer — segment fit, stage, likely priorities",
  "inferred_pain": "1 sentence: the most plausible company-level pain relevant to this offer (use 'appears to' or 'may indicate' if inferred)",
  "timing_signals": ["Only confirmed public events from raw_context or web_context. Empty array if none."],
  "evidence": ["What specific public signals or sources support this account's relevance — cite raw_context details"],
  "missing_data": ["What we couldn't confirm from public record"],
  "research_confidence": 0.0,
  "why_now": "Why this account is relevant *right now* — confirmed timing or honest inference. State which.",
  "pain_hypothesis": "A specific, falsifiable hypothesis about what challenge this company faces that this offer addresses",
  "risks_weaknesses": ["Real risks: thin evidence, wrong industry segment, overextended team, etc."],
  "evidence_discipline": [{ "claim": "string", "type": "verified_public_signal|inferred_from_context|weak_inference|missing_evidence" }],
  "segment_fit_note": "1 sentence on whether this company's industry/stage genuinely fits the target segment or is adjacent"
}`;

  const result = await callClaudeJSON<Omit<EnrichedLead, "candidate">>(SYSTEM, userMsg, 2500);
  return { candidate, ...result };
}
