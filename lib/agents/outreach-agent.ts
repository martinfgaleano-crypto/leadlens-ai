import type { QualifiedLead, OutreachSequence, LeadSearchCriteria, QCStatus, PersonalizationResult } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

const TONE_INSTRUCTIONS: Record<string, string> = {
  direct: "Direct and to the point. No filler. Short sentences.",
  consultative: "Consultative and curious. Asks a question. Shows you understand their world.",
  casual: "Conversational and warm. Reads like a human, not a template.",
};

/**
 * Writes the full outreach sequence based on the PersonalizationResult.
 * QC status is set to PENDING here — runQCAgent sets the final status.
 */
export async function runOutreachAgent(
  qualified: QualifiedLead,
  personalization: PersonalizationResult,
  criteria: LeadSearchCriteria
): Promise<OutreachSequence> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return buildDemoOutreach(qualified, personalization, criteria);
  }
  return buildClaudeOutreach(qualified, personalization, criteria);
}

// ─── Demo outreach ────────────────────────────────────────────────────────────

function buildDemoOutreach(
  qualified: QualifiedLead,
  personalization: PersonalizationResult,
  criteria: LeadSearchCriteria
): OutreachSequence {
  const { candidate } = qualified.enrichment;
  const company = candidate.company;
  const industry = candidate.industry ?? "your space";
  const lang = criteria.output_language ?? "en";
  const trigger = personalization.personalization_trigger;
  const hasSignal = personalization.personalization_confidence >= 0.75;

  // Tone-adjusted CTA
  const cta =
    criteria.tone === "casual"
      ? `Would it be worth a quick 15 min to see if there's a fit?`
      : criteria.tone === "consultative"
      ? `Happy to share a short example relevant to ${industry} companies if that would help first — just say the word.`
      : `Worth a 15-minute call this week?`;

  // Email body — signal-led if evidence supports it, hypothesis-led if not
  const signalLine = hasSignal
    ? `${trigger}\n\n`
    : `${trigger}\n\nThis is based on ${company}'s public profile and ${industry} segment patterns — not a specific claim about your internal priorities.\n\n`;

  const emailBody = lang === "es"
    ? buildSpanishEmail(company, industry, trigger, cta, hasSignal, criteria.offer_summary, criteria.value_proposition)
    : lang === "pt"
    ? buildPortugueseEmail(company, industry, trigger, cta, hasSignal, criteria.offer_summary, criteria.value_proposition)
    : lang === "ja"
    ? buildJapaneseEmail(company, industry, trigger, criteria.offer_summary)
    : buildEnglishEmail(company, industry, signalLine, cta, criteria.offer_summary, criteria.value_proposition);

  // LinkedIn DM — different angle (based on recommended_angle + offer)
  const ldm = lang === "es"
    ? `Pregunta rápida para ${company}: ¿cómo priorizan actualmente su expansión en ${industry}? ${criteria.offer_summary.slice(0, 80)} — diseñado para equipos en esta etapa. Con gusto compartimos más si es relevante.`
    : lang === "pt"
    ? `Pergunta rápida para ${company}: como priorizam sua expansão em ${industry}? ${criteria.offer_summary.slice(0, 80)} — pensado para equipes nessa fase. Posso compartilhar mais.`
    : lang === "ja"
    ? `${company}様への質問：${industry}における事業展開をどのように優先されていますか？${criteria.offer_summary.slice(0, 60)}について、お役に立てる可能性があります。`
    : buildLinkedInDM(company, industry, personalization.strongest_hook, criteria.offer_summary);

  // Follow-up 1 — different angle
  const offerShort = criteria.offer_summary.slice(0, 70).replace(/\.$/, "");
  const fu1 = lang !== "en"
    ? buildFollowUp1Localized(company, industry, lang, offerShort)
    : `Circling back in case this got buried. ${offerShort} — specifically relevant for ${industry} teams at your stage. Happy to share a relevant example if useful.`;

  // Follow-up 2 — breakup
  const fu2 = lang !== "en"
    ? buildFollowUp2Localized(company, lang)
    : `Last note on this one. If this isn't a priority right now, no problem — reply "later" and I'll check back. If there's someone else at ${company} handling this area, happy to reach them instead.`;

  const subject = lang === "es" ? `Pregunta rápida para ${company}`
    : lang === "pt" ? `Pergunta rápida para ${company}`
    : lang === "ja" ? `${company}へのご質問`
    : buildSubject(company, industry, hasSignal);

  // Call opener — phone first-touch
  const call_opener = `Hi, reaching out because ${company} came up as a match for what we do — ${criteria.offer_summary.slice(0, 60).replace(/\.$/, "")}. Do you have 90 seconds for a one-sentence overview?`;

  // CTA recommendation
  const cta_recommendation = hasSignal
    ? "Lead with the signal in the subject line — it's the strongest differentiator from generic outreach. Keep the CTA a soft 15-minute ask, not a demo request."
    : "No signal detected — use a curiosity-driven subject line and a hypothesis-framing CTA ('curious whether this matches what you're working on').";

  return {
    personalization_trigger: trigger,
    recommended_angle: personalization.recommended_angle,
    subject,
    email_body: emailBody,
    linkedin_dm: ldm,
    followup_1: fu1,
    followup_2: fu2,
    call_opener,
    cta_recommendation,
    outreach_assumptions: personalization.account_reasoning,
    what_to_avoid_in_outreach: personalization.what_to_avoid,
    tone: criteria.tone,
    qc_status: "APPROVED" as QCStatus,
    qc_notes: [],
  };
}

function buildEnglishEmail(company: string, industry: string, signalLine: string, cta: string, offerSummary: string, valueProp: string): string {
  return `${signalLine}${offerSummary.slice(0, 120)} — specifically for ${industry} companies at this scale.\n\n${valueProp.slice(0, 100)}\n\n${cta}`;
}

function buildLinkedInDM(company: string, industry: string, hook: string, offerSummary: string): string {
  const hookLine = hook.length > 20 ? `${hook.slice(0, 120)}.` : `Quick question for ${company}: how are you currently approaching [key priority] in ${industry}?`;
  return `${hookLine} ${offerSummary.slice(0, 80).replace(/\.$/, "")} — relevant for ${industry} teams at this stage. Happy to share more if it fits.`;
}

function buildSubject(company: string, industry: string, hasSignal: boolean): string {
  if (hasSignal) return `${company} — signal caught our attention`;
  return `Quick question for ${company}`;
}

function buildSpanishEmail(company: string, industry: string, trigger: string, cta: string, hasSignal: boolean, offerSummary: string, valueProp: string): string {
  const opening = hasSignal ? trigger : `${company} apareció como una cuenta relevante dentro del segmento ${industry}.`;
  return `${opening}\n\n${offerSummary.slice(0, 120)} — especialmente relevante para empresas en ${industry} en esta etapa.\n\n${valueProp.slice(0, 100)}\n\n¿Tendría sentido una llamada de 15 minutos esta semana?`;
}

function buildPortugueseEmail(company: string, industry: string, trigger: string, cta: string, hasSignal: boolean, offerSummary: string, valueProp: string): string {
  const opening = hasSignal ? trigger : `${company} apareceu como uma conta relevante no segmento ${industry}.`;
  return `${opening}\n\n${offerSummary.slice(0, 120)} — especialmente relevante para empresas em ${industry} nessa fase.\n\n${valueProp.slice(0, 100)}\n\nValeria uma chamada de 15 minutos esta semana?`;
}

function buildJapaneseEmail(company: string, industry: string, trigger: string, offerSummary: string): string {
  return `${trigger}\n\n${offerSummary.slice(0, 100)} — ${industry}企業に特に関連性が高いと考えています。\n\n今週15分ほどお話しできますか？`;
}

function buildFollowUp1Localized(company: string, industry: string, lang: string, offerShort = ""): string {
  if (lang === "es") return `Retomo por si se perdió entre los correos. ${offerShort ? offerShort + " —" : ""} relevante para equipos de ${industry} en esta etapa. ¿Te comparto un ejemplo?`;
  if (lang === "pt") return `Retomando caso tenha ficado perdido. ${offerShort ? offerShort + " —" : ""} relevante para equipes de ${industry} nessa fase. Posso compartilhar um exemplo?`;
  if (lang === "ja") return `先日のメッセージを念のため再送します。${offerShort ? offerShort + " —" : ""}${industry}チームに関連性が高いと思っています。詳細をシェアできますか？`;
  return `Circling back in case this got buried. ${offerShort ? offerShort + " —" : ""} relevant for ${industry} teams at your stage. Happy to share an example if useful.`;
}

function buildFollowUp2Localized(company: string, lang: string): string {
  if (lang === "es") return `Último mensaje sobre esto. Si no es prioridad en este momento, sin problema — responde "después" y retomo en el próximo trimestre. Si hay alguien más en ${company} que lleva la estrategia comercial, con gusto me pongo en contacto.`;
  if (lang === "pt") return `Última mensagem sobre isso. Se não é prioridade agora, sem problema — responda "depois" e retorno no próximo trimestre. Se há outra pessoa em ${company} responsável pela estratégia comercial, posso entrar em contato.`;
  if (lang === "ja") return `最後のご連絡です。今は優先事項でなければ、「後日」とご返信ください。${company}で商業戦略を担当されている別の方がいれば、そちらにご連絡することも可能です。`;
  return `Last note on this one. If this isn't a priority right now, no problem — reply "later" and I'll circle back next quarter.`;
}

// ─── Claude outreach ──────────────────────────────────────────────────────────

async function buildClaudeOutreach(
  qualified: QualifiedLead,
  personalization: PersonalizationResult,
  criteria: LeadSearchCriteria
): Promise<OutreachSequence> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  const { candidate } = qualified.enrichment;

  const toneGuide = TONE_INSTRUCTIONS[criteria.tone] ?? TONE_INSTRUCTIONS.direct;
  const outputLang = criteria.output_language ?? "en";
  const locNotes = criteria.localization_notes ?? "";
  const hasConfirmedSignal = personalization.personalization_confidence >= 0.75;

  const senderName = criteria.sender_company_name ?? "the company using this system";
  const senderDesc = criteria.sender_company_description ?? criteria.offer_summary;

  const SYSTEM = `You write B2B commercial outreach at the company/account level — not to a named individual.

CRITICAL ROLE CLARITY — READ BEFORE WRITING:
- SENDER (who writes this message): ${senderName} — ${senderDesc.slice(0, 120)}
- RECIPIENT (who receives this message): the target account described in the user message
- Write as if you ARE the sender company reaching out to the recipient
- The value proposition is what the SENDER offers to the RECIPIENT — use the "Sender offer" field
- NEVER mention "LeadLens" in any outreach copy — LeadLens generates this output but is NOT the sender
- Use "we", "our", "us" from the SENDER's perspective
- The message is FROM the sender TO the recipient — never confuse these roles

Evidence discipline in outreach:
- If a confirmed signal exists (personalization_confidence ≥ 0.75): reference it directly in the opener
- If no confirmed signal: frame as a hypothesis or pattern — use "appears to", "based on what we've observed", "companies at your stage often"
- NEVER claim to know their internal priorities or challenges as fact
- NEVER invent or embellish events not provided in the evidence

Structure rules:
- Email: (1) honest signal/pattern opener — specific to the recipient company, (2) one-sentence pain hypothesis at company level, (3) what the SENDER's offer helps with in ONE sentence, (4) low-friction CTA
- Max 120 words for email body
- LinkedIn: max 3 lines, completely different angle, start with a question or observation
- call_opener: 1-sentence cold call intro — reference recipient company + industry, ask for 90 seconds
- cta_recommendation: explain what CTA works best for this account and why
- outreach_assumptions: what key assumption does this outreach make about the recipient company?
- what_to_avoid_in_outreach: specific to this recipient — what would make this outreach feel generic or wrong?

Compliance rules:
- No "Hi [Name]", no fake familiarity
- No hard outcome promises (no "10–20 demos guaranteed", "we'll get you X clients")
- No personal data (email, LinkedIn profile, phone number)
- No emojis in email
- ${locNotes ? `LOCALIZATION: ${locNotes}` : `Write in ${criteria.outreach_language ?? "English"}`}
Return only valid JSON.`;

  const userMsg = `SENDER (the company writing this message): ${senderName}
Sender description: ${senderDesc.slice(0, 150)}
Sender offer: ${criteria.offer_summary}
Sender value prop: ${criteria.value_proposition}
Tone: ${toneGuide}

RECIPIENT (the target account this message is sent TO):
Account: ${candidate.company}
Industry: ${qualified.enrichment.candidate.industry ?? "?"} | Size: ${qualified.enrichment.candidate.company_size ?? "?"}
Fit score: ${qualified.fit_score}/10 (${qualified.category})
Fit reasons: ${qualified.fit_reasons.join(", ")}
Score explanation: ${qualified.score_explanation ?? "see fit_reasons"}

Personalization context:
- Trigger: "${personalization.personalization_trigger}"
- Recommended angle: "${personalization.recommended_angle}"
- Strongest hook: "${personalization.strongest_hook}"
- What to avoid: "${personalization.what_to_avoid}"
- Confidence: ${Math.round(personalization.personalization_confidence * 100)}% (${hasConfirmedSignal ? "signal-led" : "hypothesis-led"})

Write a fresh, natural company-level outreach. Do NOT copy the trigger or angle verbatim — use them as context to write something natural.

Return JSON:
{
  "subject": "max 8 words, company-level, no clickbait, references signal if available",
  "email_body": "full email, max 120 words, company-addressed, 4-part structure",
  "linkedin_dm": "max 3 lines, completely different angle, start with question",
  "followup_1": "day 3-4, new angle, max 80 words",
  "followup_2": "day 7-8 breakup, max 60 words",
  "call_opener": "1-sentence cold call intro, reference company and industry, ask for 90 seconds",
  "cta_recommendation": "what CTA works best for this account and why",
  "outreach_assumptions": "key assumption this outreach makes about the company",
  "what_to_avoid_in_outreach": "what would make this outreach feel generic or wrong for this specific company"
}`;

  type Result = Pick<OutreachSequence, "subject" | "email_body" | "linkedin_dm" | "followup_1" | "followup_2" | "call_opener" | "cta_recommendation" | "outreach_assumptions" | "what_to_avoid_in_outreach">;
  const result = await callClaudeJSON<Result>(SYSTEM, userMsg, 2500);

  return {
    ...result,
    personalization_trigger: personalization.personalization_trigger,
    recommended_angle: personalization.recommended_angle,
    tone: criteria.tone,
    qc_status: "APPROVED" as QCStatus,
    qc_notes: [],
  };
}
