import type { QualifiedLead, OutreachSequence, QCResult, QCStatus, RiskLevel, LeadSearchCriteria } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

// Generic phrases that signal low-quality outreach — no specific evidence backing them
const GENERIC_PHRASES = [
  "could benefit from",
  "may be interested in",
  "fits your icp",
  "as a growing company",
  "improve efficiency",
  "streamline operations",
  "scale their sales team",
  "drive more revenue",
  "boost productivity",
  "take your business to the next level",
  "i hope this finds you",
  "i hope you're doing well",
  "i wanted to reach out",
  "i came across your profile",
  "touching base",
  "circling back",
  "i know you're busy",
  "just following up",
];

// Overclaiming patterns — hard outcome promises
const OVERCLAIM_PATTERNS = [
  /\d+[\-–]\d+\s*(demos?|meetings?|leads?)\s*(per|a)\s*(month|week|day)/i,
  /guaranteed?\s*(meetings?|demos?|results?|clients?)/i,
  /we('ll|will)\s+get\s+you\s+\d+/i,
  /\d+\s*x\s*(more|increase|growth|roi)/i,
  /100\s*%\s*(guaranteed?|success|delivery)/i,
];

// Personal data leak patterns
const CONTACT_LEAK_PATTERNS = [
  /\b[a-z]+@[a-z]+\.[a-z]{2,}\b/i,  // email addresses
  /linkedin\.com\/in\//i,              // personal LinkedIn URLs
  /\+\d{1,3}[\s\-]?\d{6,}/,          // phone numbers
];

/**
 * Reviews the outreach for quality, genericness, hallucination risk, and compliance.
 * Returns an updated OutreachSequence with qc_status, qc_notes, and analysis fields set.
 */
export async function runQCAgent(
  qualified: QualifiedLead,
  outreach: OutreachSequence,
  criteria?: LeadSearchCriteria
): Promise<OutreachSequence> {
  const qcResult = IS_DEMO || !process.env.ANTHROPIC_API_KEY
    ? runDemoQC(qualified, outreach, criteria)
    : await runClaudeQC(qualified, outreach, criteria);

  return {
    ...outreach,
    qc_status: qcResult.status,
    qc_notes: qcResult.notes,
    genericness_risk: qcResult.genericness_risk,
    hallucination_risk: qcResult.hallucination_risk,
    evidence_weakness: qcResult.evidence_weakness,
    buyer_seller_confusion_risk: qcResult.buyer_seller_confusion_risk,
    improvement_notes: qcResult.improvement_notes,
  };
}

// ─── Demo QC ──────────────────────────────────────────────────────────────────

function runDemoQC(qualified: QualifiedLead, outreach: OutreachSequence, criteria?: LeadSearchCriteria): QCResult {
  const notes: string[] = [];
  const improvement_notes: string[] = [];
  const { candidate } = qualified.enrichment;
  const emailLower = outreach.email_body.toLowerCase();
  const fullText = [outreach.email_body, outreach.subject, outreach.linkedin_dm].join(" ").toLowerCase();

  // ── Hard fail: DISCARD lead ───────────────────────────────────────────────
  if (qualified.fit_score < 4) {
    notes.push("Fit score below minimum threshold (4/10) — recommend excluding from outreach sequence");
    return {
      status: "FAILED",
      notes,
      genericness_risk: "high",
      hallucination_risk: "low",
      evidence_weakness: "high",
      buyer_seller_confusion_risk: "low",
      improvement_notes: ["Discard this account — ICP mismatch too significant to outreach"],
    };
  }

  // ── Genericness detection ─────────────────────────────────────────────────
  const genericCount = GENERIC_PHRASES.filter(phrase => emailLower.includes(phrase)).length;
  let genericness_risk: RiskLevel = genericCount >= 2 ? "high" : genericCount === 1 ? "medium" : "low";

  if (genericCount > 0) {
    const found = GENERIC_PHRASES.filter(p => emailLower.includes(p));
    notes.push(`Generic phrases detected: "${found.join('", "')}" — these phrases could be sent to any company in the segment`);
    improvement_notes.push(`Replace generic phrases with signal-specific language. Instead of "${found[0]}", reference a specific observable fact about ${candidate.company} or ${candidate.industry ?? "their industry"}`);
  }

  // ── Trigger text copied verbatim ──────────────────────────────────────────
  if (outreach.personalization_trigger && outreach.personalization_trigger.length > 30) {
    const triggerWords = outreach.personalization_trigger.toLowerCase().split(" ").slice(0, 8).join(" ");
    if (emailLower.includes(triggerWords)) {
      notes.push("Email opener appears to copy the trigger insight verbatim — paraphrase for a more natural tone");
      genericness_risk = "medium" as RiskLevel;
    }
  }

  // ── Overclaiming detection ────────────────────────────────────────────────
  const overclaims = OVERCLAIM_PATTERNS.filter(p => p.test(outreach.email_body));
  if (overclaims.length > 0) {
    notes.push("Hard outcome claims detected — remove specific numbers or guarantees; use directional language instead");
    improvement_notes.push('Replace outcome claims with directional language: "identify which accounts to contact first" instead of "10–20 demos per month"');
  }

  // ── Hallucination risk ────────────────────────────────────────────────────
  const hasConfirmedSignal = qualified.enrichment.timing_signals.some(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );
  const confidence = candidate.confidence_score;
  const hallucination_risk: RiskLevel =
    confidence < 0.4 ? "high" :
    !hasConfirmedSignal && confidence < 0.65 ? "medium" :
    "low";

  if (hallucination_risk === "high") {
    notes.push(`Low evidence confidence (${Math.round(confidence * 100)}%) — claims about this company's priorities may be unsupported`);
    improvement_notes.push("Add explicit hedging: 'based on available public signals' or 'if this matches what you're working on'");
  } else if (hallucination_risk === "medium") {
    notes.push("Moderate hallucination risk — outreach makes assumptions without confirmed signals; ensure language is hypothesis-framed");
  }

  // ── Contact/personal data leak ────────────────────────────────────────────
  const contactLeaks = CONTACT_LEAK_PATTERNS.filter(p => p.test(fullText));
  if (contactLeaks.length > 0) {
    notes.push("Personal contact data detected in outreach (email, personal LinkedIn, or phone) — remove immediately");
    return {
      status: "FAILED", notes,
      genericness_risk, hallucination_risk,
      evidence_weakness: "high",
      buyer_seller_confusion_risk: "low",
      improvement_notes: ["Remove all personal contact data — LeadLens does not include personal emails, phone numbers, or personal LinkedIn URLs"],
    };
  }

  // ── Evidence weakness ─────────────────────────────────────────────────────
  const evidence_weakness: RiskLevel =
    !hasConfirmedSignal && confidence < 0.5 ? "high" :
    !hasConfirmedSignal ? "medium" :
    "low";

  if (evidence_weakness === "high") {
    improvement_notes.push(`Strengthen outreach by explicitly framing it as hypothesis-led: "We noticed ${candidate.company ?? "companies in your space"} fits a pattern we've seen in similar ${candidate.industry ?? "industry"} accounts..."`);
  }

  // ── Missing why now ───────────────────────────────────────────────────────
  if (!hasConfirmedSignal && !outreach.email_body.includes("pattern") && !outreach.email_body.includes("stage")) {
    improvement_notes.push("No timing anchor in the email — add a reference to why now, even if inferred: 'companies at your stage' or 'based on the hiring patterns we've observed in your segment'");
  }

  // ── Score inconsistency check ─────────────────────────────────────────────
  if (qualified.fit_score < 5 && outreach.qc_status !== "FAILED") {
    notes.push(`Score is ${qualified.fit_score}/10 (COLD) — review manually before including in primary outreach sequence`);
  }

  // ── Low personalization trigger ───────────────────────────────────────────
  if (!outreach.personalization_trigger || outreach.personalization_trigger.length < 30) {
    notes.push("Personalization trigger is missing or too short — outreach lacks account-specific context");
    genericness_risk = "high" as RiskLevel;
  }

  // ── Buyer/seller confusion check ──────────────────────────────────────────
  // Flags if the email body pitches LeadLens (the tool) when the sender isn't selling LeadLens
  const LEADLENS_SELF_PITCH = ["LeadLens builds", "LeadLens construye", "LeadLens constrói", "LeadLensは"];
  const hasSelfPitch = LEADLENS_SELF_PITCH.some(p => outreach.email_body.includes(p));
  const senderIsLeadLens = criteria?.offer_summary?.toLowerCase().includes("leadlens") ?? false;
  const buyer_seller_confusion_risk: RiskLevel =
    hasSelfPitch && !senderIsLeadLens ? "high" :
    hasSelfPitch ? "low" :
    "low";
  if (buyer_seller_confusion_risk === "high") {
    notes.push("AUDIENCE MISMATCH (critical): outreach body pitches LeadLens when the sender is not LeadLens — outreach must be written FROM the customer TO the target account using the customer's offer");
    improvement_notes.push("Rewrite email body to use the sender's actual offer as the value proposition — do not pitch LeadLens capabilities as if the sender is LeadLens");
  }

  // ── Determine final status ────────────────────────────────────────────────
  const hasCritical = overclaims.length > 0 || contactLeaks.length > 0 || buyer_seller_confusion_risk === "high";
  const hasMajor = notes.filter(n => !n.includes("manually")).length > 2;

  let status: QCStatus;
  if (hasCritical) {
    status = "FAILED";
  } else if (hasMajor || genericness_risk === "high" || qualified.fit_score < 6) {
    status = "REVIEW_NEEDED";
  } else {
    status = "APPROVED";
  }

  return { status, notes, genericness_risk, hallucination_risk, evidence_weakness, buyer_seller_confusion_risk, improvement_notes };
}

// ─── Claude QC ────────────────────────────────────────────────────────────────

async function runClaudeQC(qualified: QualifiedLead, outreach: OutreachSequence, criteria?: LeadSearchCriteria): Promise<QCResult> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  const { candidate } = qualified.enrichment;

  const category = qualified.fit_score >= 8 ? "HOT" : qualified.fit_score >= 6 ? "WARM" : qualified.fit_score >= 4 ? "COLD" : "DISCARD";
  const hasConfirmedSignal = qualified.enrichment.timing_signals.some(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );

  const SYSTEM = `You are a senior B2B outreach QC reviewer. Your job is to be CRITICAL, not just permissive.
Flag real problems — don't reject for perfection, but don't approve generic outreach either.

Status rules:
- APPROVED: ready to send — specific, evidence-backed, not generic, no false claims
- REVIEW_NEEDED: fixable issues — provide a suggested revision in your note
- FAILED: do not send — DISCARD lead, false claims, contact data leak, or completely generic

Check specifically for:
1. GENERICNESS (most important): Could this email be sent to ANY company in the segment? If yes → high genericness_risk + REVIEW_NEEDED
   Generic red flags: "could benefit from", "fits your ICP", "as a growing company", "improve efficiency", "streamline operations"
   Non-generic: references a specific signal, a specific company characteristic, or a specific segment behavior
2. OVERCLAIMING: "10–20 demos per month", "guaranteed meetings", specific outcome promises → FAILED
3. HALLUCINATION: claims about this company's behavior or internal priorities not supported by evidence → flag + suggest hedge language
4. CONTACT DATA LEAK: email address, personal LinkedIn (/in/), phone number → FAILED immediately
5. OLD LEAD-GEN LANGUAGE: "verified contact", "qualified leads", "10x your pipeline" → flag
6. WEAK WHY NOW: if there's no timing anchor (signal OR explicit hypothesis) → improvement_note
7. SCORE INCONSISTENCY: HOT/WARM lead with generic outreach, or COLD lead with aggressive CTA
8. MISSING EVIDENCE HEDGE: if no confirmed signal, outreach should use "appears to", "based on public patterns", "if this matches..." — flag if it speaks with false certainty
9. BUYER/SELLER CONFUSION (critical): Does the outreach pitch a third-party tool or brand (not the sender's offer) as the value proposition? Does it write as if LeadLens is the sender when the sender is a different company? Is the message FROM the sender TO the recipient, or does it confuse the two roles?

For each issue, include "REVISION: [suggested safer version]" when applicable.
Return only valid JSON.`;

  const triggerPreview = outreach.personalization_trigger.slice(0, 100);
  const emailStart = outreach.email_body.slice(0, 150);
  const senderName = criteria?.sender_company_name ?? "the LeadLens customer";
  const senderOffer = criteria?.offer_summary ?? "not specified";

  const userMsg = `SENDER (who is writing this outreach): ${senderName}
Sender offer: ${senderOffer}
RECIPIENT (target account): ${candidate.company} (${candidate.industry ?? "?"})

Opportunity score: ${qualified.fit_score} (${category})
Signal confidence: ${Math.round(candidate.confidence_score * 100)}%
Confirmed signals: ${hasConfirmedSignal ? qualified.enrichment.timing_signals.filter(s => !s.includes("inferred") && !s.includes("no confirmed")).join("; ") : "none"}
Score explanation: ${qualified.score_explanation ?? "not provided"}

Trigger insight: "${triggerPreview}"
Email subject: ${outreach.subject}
Email opening (first 150 chars): "${emailStart}"
Full email body: ${outreach.email_body}
Recommended angle: ${outreach.recommended_angle ?? "not provided"}
Missing data flags: ${qualified.enrichment.missing_data.slice(0, 3).join("; ") || "none"}
Hallucination risk context: ${qualified.enrichment.evidence_discipline?.slice(0, 3).map(e => `${e.type}: ${e.claim}`).join("; ") ?? "not classified"}

Return JSON:
{
  "status": "APPROVED|REVIEW_NEEDED|FAILED",
  "notes": ["issue description — REVISION: suggested fix if applicable"],
  "genericness_risk": "low|medium|high",
  "hallucination_risk": "low|medium|high",
  "evidence_weakness": "low|medium|high",
  "buyer_seller_confusion_risk": "low|medium|high",
  "improvement_notes": ["specific, actionable improvement for this account's outreach"]
}`;

  return callClaudeJSON<QCResult>(SYSTEM, userMsg, 1200);
}
