import type {
  LeadCandidate, EnrichedLead, LeadSearchCriteria, EvidenceClaim,
  BuyingWindow, EvidenceQualityGrade, RecommendedActionType,
} from "@/types";

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

  const timingSignals = buildTimingSignals(candidate, keySignal, hasStrongSignal);
  const { window: buying_window, reason: buying_window_reason } = classifyBuyingWindow(timingSignals, conf);
  const evidence_quality_grade = classifyEvidenceQuality(hasStrongSignal, conf, candidate.raw_context ? 1 : 0);
  const opportunity_risks = buildOpportunityRisks(company, industry, hasStrongSignal, conf, criteria);
  const { action: recommended_action, reason: recommended_action_reason } = deriveResearchRecommendedAction(
    hasStrongSignal, conf, industry, criteria
  );

  return {
    candidate,
    company_summary: buildCompanySummary(company, industry, size, candidate.location, candidate.raw_context),
    role_relevance: buildRoleRelevance(company, industry, size, criteria.offer_summary),
    inferred_pain: painHypothesis,
    timing_signals: timingSignals,
    evidence: buildEvidence(candidate, hasStrongSignal),
    missing_data: buildMissingData(candidate, hasStrongSignal),
    research_confidence: conf * 0.8,
    why_now: whyNow,
    pain_hypothesis: painHypothesis,
    risks_weaknesses: risks,
    evidence_discipline: evidenceDiscipline,
    segment_fit_note: buildSegmentFitNote(company, industry, criteria),
    // Account Intelligence layer
    account_thesis: buildAccountThesis(company, industry, keySignal, criteria.offer_summary, hasStrongSignal, conf),
    signal_interpretation: interpretSignalMeaning(timingSignals, company, industry),
    buying_window,
    buying_window_reason,
    evidence_quality_grade,
    opportunity_risks,
    recommended_action,
    recommended_action_reason,
    next_best_question: buildNextBestQuestion(company, industry, hasStrongSignal, painHypothesis),
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

// ─── Account Intelligence helpers ────────────────────────────────────────────

function buildAccountThesis(
  company: string,
  industry: string,
  keySignal: string | null,
  offerSummary: string,
  hasSignal: boolean,
  conf: number
): string {
  if (hasSignal && keySignal) {
    const signal = keySignal.slice(0, 80).replace(/\.$/, "").toLowerCase();
    return `${company} surfaced based on a confirmed public signal — ${signal} — which typically precedes an active vendor evaluation window. The ${industry} profile aligns with accounts that evaluate: ${offerSummary.slice(0, 60)}.`;
  }
  if (conf >= 0.65) {
    return `${company} is a ${industry} account matching the ICP profile based on company stage and segment characteristics. No confirmed buying signal yet, but the account fits the pattern of companies that have historically evaluated this type of offer.`;
  }
  return `${company} matches the ${industry} segment criteria but lacks confirmed timing signals. Commercial relevance is inferred from the company profile — validate before investing outreach resources.`;
}

function interpretSignalMeaning(signals: string[], company: string, industry: string): string {
  const confirmed = signals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );

  if (confirmed.length === 0) {
    return `No confirmed signals for ${company} — opportunity is hypothesis-led from ${industry} segment profile. Lower expected response rate without a timing anchor.`;
  }

  const text = confirmed.join(" ").toLowerCase();

  if (/hir|recruit/.test(text) && /expand|new|grow|open|facilit|warehouse/.test(text)) {
    return `${company} is simultaneously hiring and expanding — a combination that typically signals an active operational scaling phase where companies identify and evaluate vendors to fill capability gaps. Higher urgency window.`;
  }
  if (/raised|funded|series|seed|investment|capital/.test(text)) {
    return `Post-funding phase at ${company} typically triggers a 3–12 month vendor evaluation cycle. Companies in this phase are actively buying capabilities. Contact within 60 days of the announcement for best timing.`;
  }
  if (/warehouse|facilit|distribut.?center|capacity|storage/.test(text)) {
    return `Physical infrastructure expansion at ${company} suggests operational scaling that typically exposes account management and prioritization gaps. The 30–90 day post-announcement window is the optimal outreach timing.`;
  }
  if (/trade.?show|expo|fair|conference|exhibit|fancy food/.test(text)) {
    return `${company}'s trade show or industry event participation signals active market engagement — companies attend these events when in buying or partner-discovery mode. Window typically lasts 30–60 days post-event.`;
  }
  if (/launch|new product|announced|platform|new service/.test(text)) {
    return `${company}'s recent announcement suggests active go-to-market investment. Post-launch phases create demand for adjacent vendor capabilities that support distribution, sales, or operations.`;
  }
  if (/hir|recruit|joined|headcount/.test(text)) {
    return `${company}'s hiring activity signals commercial growth investment — new hires often drive vendor evaluation within 60 days as they build or reshape their operational stack.`;
  }

  return `${company} shows active public signals — ${confirmed[0]?.slice(0, 80) ?? ""}. This type of observable event typically correlates with a 30–90 day evaluation window.`;
}

function classifyBuyingWindow(
  signals: string[],
  conf: number
): { window: BuyingWindow; reason: string } {
  const confirmed = signals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );

  if (confirmed.length === 0) {
    return { window: "unclear", reason: "No confirmed buying signal — timing is hypothetical based on segment profile" };
  }

  const text = confirmed.join(" ").toLowerCase();

  if (/just|this week|this month|recently raised|just hired|just launched/.test(text)) {
    return { window: "immediate", reason: "Recent high-signal event suggests active evaluation window within 30 days" };
  }
  if (/raised|funded|hired|launch|expand|new market|announced/.test(text) && conf >= 0.55) {
    return { window: "near_term", reason: "Active expansion or growth signals suggest 30–90 day evaluation window" };
  }
  if (confirmed.length > 0) {
    return { window: "monitor", reason: "Signal exists but timing is indirect — monitor for a more specific trigger before full outreach" };
  }

  return { window: "unclear", reason: "Signals are inferred rather than confirmed from public record" };
}

function classifyEvidenceQuality(
  hasSignal: boolean,
  conf: number,
  contextItems: number
): EvidenceQualityGrade {
  if (hasSignal && conf >= 0.8) return "strong_verified";
  if (hasSignal && conf >= 0.5) return "moderate_public";
  if (!hasSignal && conf >= 0.6 && contextItems > 0) return "inferred";
  if (conf >= 0.3) return "weak";
  return "missing";
}

function buildOpportunityRisks(
  company: string,
  industry: string,
  hasSignal: boolean,
  conf: number,
  criteria: LeadSearchCriteria
): string[] {
  const risks: string[] = [];

  if (!hasSignal) {
    risks.push("No confirmed timing signal — outreach is hypothesis-led; expected response rate is lower than signal-led campaigns");
  }
  if (conf < 0.5) {
    risks.push(`Low evidence confidence (${Math.round(conf * 100)}%) — key assumptions about this company's priorities may be wrong; manual research recommended first`);
  }

  const targetInds = criteria.target_industries.map(i => i.toLowerCase());
  const isDirectMatch = targetInds.some(t => industry.toLowerCase().includes(t) || t.includes(industry.toLowerCase().split(" ")[0]));
  if (!isDirectMatch) {
    risks.push(`${industry} is adjacent to the target segment, not a direct match — validate ICP alignment before investing outreach resources`);
  }

  if (criteria.excluded_industries?.some(excl => industry.toLowerCase().includes(excl.toLowerCase()))) {
    risks.push(`${industry} may overlap with an excluded industry category — verify this account isn't in a disqualified segment`);
  }

  return risks;
}

function deriveResearchRecommendedAction(
  hasSignal: boolean,
  conf: number,
  industry: string,
  criteria: LeadSearchCriteria
): { action: RecommendedActionType; reason: string } {
  // These are preliminary research-stage recommendations — ranking layer finalizes
  if (conf < 0.35) {
    return { action: "enrich_manually", reason: "Evidence quality is too low for outreach — manual research required to validate basic company context" };
  }
  if (!hasSignal && conf < 0.5) {
    return { action: "monitor_for_new_signal", reason: "Weak evidence and no confirmed trigger — add to watchlist and revisit when a public signal appears" };
  }
  if (hasSignal) {
    return { action: "validate_source_first", reason: "Confirmed signal exists — validate that the trigger is recent and the pain hypothesis holds before sending outreach" };
  }
  return { action: "monitor_for_new_signal", reason: "No confirmed buying signal — monitor this account for 30–60 days before committing outreach resources" };
}

function buildNextBestQuestion(
  company: string,
  industry: string,
  hasSignal: boolean,
  painHypothesis: string
): string {
  if (!hasSignal) {
    return `Is ${company} actively evaluating vendors in this category, or is the opportunity purely based on segment profile fit?`;
  }

  const pain = painHypothesis.toLowerCase();

  if (/expansion|new market|grow|open/.test(pain)) {
    return `Is ${company}'s expansion creating operational complexity that isn't solved internally yet, or do they already have vendor relationships in place?`;
  }
  if (/hiring|headcount|team|recruit/.test(pain)) {
    return `Are the new hires at ${company} expected to build their own process, or are they inheriting an evaluation of external solutions?`;
  }
  if (/distribut|import|export|supplier|sourcing/.test(pain)) {
    return `Is ${company} actively sourcing new suppliers or managing existing portfolio capacity — are they in buying mode or consolidating?`;
  }
  if (/billing|revenue.?cycle|denial|claim/.test(pain)) {
    return `Is ${company}'s billing workflow centralized across locations or managed independently per site — which affects where the decision gets made?`;
  }
  if (/account|priorit|outbound|pipeline|lead/.test(pain)) {
    return `Does ${company} have a formal process for identifying which accounts to contact first, or are reps currently self-selecting based on intuition?`;
  }

  return `What specific business outcome is ${company} trying to achieve in the next 60–90 days that would make this offer timely for them?`;
}

// ─── Signal extractor ─────────────────────────────────────────────────────────

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
  "segment_fit_note": "1 sentence on whether this company's industry/stage genuinely fits the target segment or is adjacent",
  "account_thesis": "1-2 sentences: WHY this account may be commercially relevant NOW — the core commercial thesis. Be honest if it's inferred.",
  "signal_interpretation": "1-2 sentences: What the confirmed signals MEAN commercially — not just what they are. If no signal, explain the hypothesis basis.",
  "buying_window": "immediate|near_term|monitor|unclear",
  "buying_window_reason": "1 sentence: why this buying window classification",
  "evidence_quality_grade": "strong_verified|moderate_public|inferred|weak|missing",
  "opportunity_risks": ["2-4 specific risks in pursuing this account — thin evidence, wrong segment, low urgency, unclear buyer, possible mismatch"],
  "recommended_action": "send_outreach_now|validate_source_first|monitor_for_new_signal|enrich_manually|exclude|add_to_watchlist",
  "recommended_action_reason": "1 sentence: why this action is recommended at this research stage",
  "next_best_question": "The single most important question the user should validate before contacting or during the first conversation"
}`;

  const result = await callClaudeJSON<Omit<EnrichedLead, "candidate">>(SYSTEM, userMsg, 2500);
  return { candidate, ...result };
}
