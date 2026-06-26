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
    : `${trigger}\n\nThis message is based on ${company}'s public profile and ${industry} segment patterns — not a specific claim about your internal priorities.\n\n`;

  const emailBody = lang === "es"
    ? buildSpanishEmail(company, industry, trigger, cta, hasSignal)
    : lang === "pt"
    ? buildPortugueseEmail(company, industry, trigger, cta, hasSignal)
    : lang === "ja"
    ? buildJapaneseEmail(company, industry, trigger)
    : buildEnglishEmail(company, industry, signalLine, cta, criteria.offer_summary, criteria.value_proposition);

  // LinkedIn DM — different angle (based on recommended_angle)
  const ldm = lang === "es"
    ? `Pregunta rápida para ${company}: ¿cómo priorizan actualmente qué cuentas abordar primero en ${industry}? Ayudamos a equipos de esta industria a mapear señales públicas de compra y enfocar más rápido. Con gusto compartimos más si es relevante.`
    : lang === "pt"
    ? `Pergunta rápida para ${company}: como priorizam quais contas abordar primeiro em ${industry}? Ajudamos equipes dessa indústria a mapear sinais de compra e focar mais rápido. Posso compartilhar mais.`
    : lang === "ja"
    ? `${company}様への質問：${industry}において最初にアプローチするアカウントをどのように優先順位付けされていますか？この業界のチームが公開購買シグナルをマッピングし、より迅速に集中できるよう支援してきました。`
    : buildLinkedInDM(company, industry, personalization.strongest_hook);

  // Follow-up 1 — different angle (use account_reasoning for context)
  const fu1 = lang !== "en"
    ? buildFollowUp1Localized(company, industry, lang)
    : `Circling back in case this got buried. We work with ${industry} teams to identify which accounts have public buying signals before the first outreach wave — the difference in response rates is usually significant. Happy to show a relevant example if useful.`;

  // Follow-up 2 — breakup
  const fu2 = lang !== "en"
    ? buildFollowUp2Localized(company, lang)
    : `Last note on this one. If this isn't a priority right now, no problem — reply "later" and I'll circle back next quarter. If this fits something you're thinking about for ${industry} accounts, happy to go deeper.`;

  const subject = lang === "es" ? `Pregunta rápida para ${company}`
    : lang === "pt" ? `Pergunta rápida para ${company}`
    : lang === "ja" ? `${company}へのご質問`
    : buildSubject(company, industry, hasSignal);

  // Call opener — phone first-touch
  const call_opener = `Hi, I'm reaching out because ${company} came up as a strong match for something we built for ${industry} teams. I'll be quick — do you have 90 seconds for a 1-sentence pitch?`;

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
  return `${signalLine}LeadLens builds commercial intelligence for ${industry} companies — detecting public buying signals, ranking accounts by opportunity, and generating evidence-based outreach strategy. Most teams use it to focus their commercial energy on the right accounts before the first conversation.\n\n${cta}`;
}

function buildLinkedInDM(company: string, industry: string, hook: string): string {
  const hookLine = hook.length > 20 ? `${hook.slice(0, 120)}.` : `How does ${company} currently prioritize which accounts to approach first in ${industry}?`;
  return `${hookLine} We've been helping ${industry} teams map public buying signals and identify the right accounts before the first call. Happy to share more if it's relevant.`;
}

function buildSubject(company: string, industry: string, hasSignal: boolean): string {
  if (hasSignal) return `${company} — signal caught our attention`;
  return `Quick question for ${company}`;
}

function buildSpanishEmail(company: string, industry: string, trigger: string, cta: string, hasSignal: boolean): string {
  const opening = hasSignal ? trigger : `${company} apareció como una cuenta relevante dentro del segmento ${industry}.`;
  return `${opening}\n\nLeadLens construye inteligencia comercial para empresas en ${industry} — detectando señales públicas de compra, priorizando cuentas por oportunidad y generando estrategia de outreach basada en evidencia.\n\n¿Tendría sentido una llamada de 15 minutos esta semana?`;
}

function buildPortugueseEmail(company: string, industry: string, trigger: string, cta: string, hasSignal: boolean): string {
  const opening = hasSignal ? trigger : `${company} apareceu como uma conta relevante no segmento ${industry}.`;
  return `${opening}\n\nLeadLens constrói inteligência comercial para empresas em ${industry} — detectando sinais públicos de compra, priorizando contas por oportunidade e gerando estratégia de outreach baseada em evidências.\n\nValeria uma chamada de 15 minutos esta semana?`;
}

function buildJapaneseEmail(company: string, industry: string, trigger: string): string {
  return `${trigger}\n\nLeadLensは${industry}企業向けに商業インテリジェンスを構築します — 公開購買シグナルの検出、機会別のアカウント優先順位付け、エビデンスベースのアウトリーチ戦略の生成。\n\n今週15分ほどお話しできますか？`;
}

function buildFollowUp1Localized(company: string, industry: string, lang: string): string {
  if (lang === "es") return `Retomo por si se perdió entre los correos. Recientemente trabajamos con un equipo de ${industry} que identificó cuentas de alta señal que no habían considerado — y una de ellas se convirtió en conversación en la primera semana. ¿Te comparto el detalle?`;
  if (lang === "pt") return `Retomando caso tenha ficado perdido. Recentemente trabalhamos com uma equipe de ${industry} que identificou contas de alto sinal que não tinham considerado — uma delas gerou conversa na primeira semana. Posso compartilhar os detalhes?`;
  if (lang === "ja") return `先日のメッセージを念のため再送します。最近、${industry}のチームがLeadLensを使って見落としていた高シグナルのアカウントを特定しました。詳細をシェアできますか？`;
  return `Circling back in case this got buried. We work with ${industry} teams to identify which accounts have public buying signals before the first outreach wave. Happy to show a relevant example.`;
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

  const SYSTEM = `You write B2B commercial outreach at the company/account level — not to a named individual.
Messages are addressed to the company or "your team" based on public signals and account fit.

Evidence discipline in outreach:
- If a confirmed signal exists (personalization_confidence ≥ 0.75): reference it directly in the opener
- If no confirmed signal: frame as a hypothesis or pattern — use "appears to", "based on what we've observed", "companies at your stage often"
- NEVER claim to know their internal priorities or challenges as fact
- NEVER invent or embellish events not provided in the evidence

Structure rules:
- Email: (1) honest signal/pattern opener — specific to this company, (2) one-sentence pain hypothesis at company level, (3) what the offer helps with in ONE sentence, (4) low-friction CTA
- Max 120 words for email body
- LinkedIn: max 3 lines, completely different angle, start with a question or observation
- call_opener: 1-sentence cold call intro — reference company + industry, ask for 90 seconds
- cta_recommendation: explain what CTA works best for this account and why
- outreach_assumptions: what key assumption does this outreach make about the company?
- what_to_avoid_in_outreach: specific to this company — what would make this outreach feel generic or wrong?

Compliance rules:
- No "Hi [Name]", no fake familiarity
- No hard outcome promises (no "10–20 demos guaranteed", "we'll get you X clients")
- No personal data (email, LinkedIn profile, phone number)
- No emojis in email
- ${locNotes ? `LOCALIZATION: ${locNotes}` : `Write in ${criteria.outreach_language ?? "English"}`}
Return only valid JSON.`;

  const userMsg = `Offer: ${criteria.offer_summary}
Value prop: ${criteria.value_proposition}
Tone: ${toneGuide}

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
