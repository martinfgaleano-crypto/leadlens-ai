import type { QualifiedLead, OutreachSequence, QCResult, QCStatus } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

/**
 * Reviews the lead + outreach for quality flags.
 * Returns an updated OutreachSequence with qc_status and qc_notes set.
 */
export async function runQCAgent(
  qualified: QualifiedLead,
  outreach: OutreachSequence
): Promise<OutreachSequence> {
  const qcResult = IS_DEMO || !process.env.ANTHROPIC_API_KEY
    ? runDemoQC(qualified, outreach)
    : await runClaudeQC(qualified, outreach);

  return {
    ...outreach,
    qc_status: qcResult.status,
    qc_notes: qcResult.notes,
  };
}

// ─── Demo QC ──────────────────────────────────────────────────────────────────

function runDemoQC(qualified: QualifiedLead, outreach: OutreachSequence): QCResult {
  const notes: string[] = [];
  const { candidate } = qualified.enrichment;

  if (qualified.fit_score < 4) {
    notes.push("Fit score below minimum threshold — consider discarding");
    return { status: "FAILED", notes };
  }

  if (!candidate.email) notes.push("No email found — LinkedIn DM only");
  if (candidate.email_status === "invalid") notes.push("Email marked invalid — verify before sending");
  if (candidate.email_status === "not_found") notes.push("Email not found — enrich before outreach");

  if (!outreach.personalization_trigger || outreach.personalization_trigger.length < 20) {
    notes.push("Personalization trigger is too short or generic");
  }

  if (outreach.email_body.toLowerCase().includes("i hope you")) {
    notes.push("Email contains filler phrase — revise opening");
  }

  if (qualified.fit_score < 6) {
    notes.push("COLD lead — review manually before including in active sequence");
    return { status: "REVIEW_NEEDED", notes };
  }

  if (notes.length > 1) {
    return { status: "REVIEW_NEEDED", notes };
  }

  return { status: "APPROVED", notes };
}

// ─── Claude QC ────────────────────────────────────────────────────────────────

async function runClaudeQC(qualified: QualifiedLead, outreach: OutreachSequence): Promise<QCResult> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  const { candidate } = qualified.enrichment;

  const category = qualified.fit_score >= 8 ? "HOT" : qualified.fit_score >= 6 ? "WARM" : qualified.fit_score >= 4 ? "COLD" : "DISCARD";

  const SYSTEM = `You are a B2B outreach QC reviewer. Flag real problems only — don't reject for perfection.

Status rules:
- APPROVED: ready to send as-is
- REVIEW_NEEDED: has fixable issues — provide a suggested revision in your note
- FAILED: do not send (DISCARD lead, bad email, false claims, or no useful personalization)

Check specifically for:
1. Trigger text copied verbatim as email opener — if the first sentence of email_body matches the trigger almost word-for-word, flag it and suggest a rewritten opener
2. Hard outcome claims: "10–20 demos per month", "guaranteed meetings", "we will get you X clients" — flag and provide a softer revision
3. Invented facts: hiring news, funding, or events not in evidence — flag as hallucination risk
4. Overly generic messaging: could be sent unchanged to any company in the industry — flag
5. Spam indicators: ALL CAPS, excessive exclamation, pushy language
6. DISCARD leads with outreach written — always FAILED

For each flagged issue, include "REVISION: [suggested safer version]" within the note when applicable.
Return only valid JSON.`;

  const triggerPreview = outreach.personalization_trigger.slice(0, 100);
  const emailStart = outreach.email_body.slice(0, 120);

  const userMsg = `Lead: ${candidate.name ?? "?"}, ${candidate.title ?? "?"} at ${candidate.company}
Fit score: ${qualified.fit_score} (${category})
Email status: ${candidate.email_status ?? "unknown"}

Trigger insight: "${triggerPreview}"
Email opening (first 120 chars): "${emailStart}"
Subject: ${outreach.subject}
Full email body: ${outreach.email_body}
Missing data flags: ${qualified.enrichment.missing_data.slice(0, 3).join("; ") || "none"}

Return JSON:
{
  "status": "APPROVED|REVIEW_NEEDED|FAILED",
  "notes": ["issue description — REVISION: suggested fix if applicable"]
}`;

  return callClaudeJSON<QCResult>(SYSTEM, userMsg, 600);
}
