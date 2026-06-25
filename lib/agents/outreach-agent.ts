import type { QualifiedLead, OutreachSequence, LeadSearchCriteria, QCStatus } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

const TONE_INSTRUCTIONS: Record<string, string> = {
  direct: "Direct and to the point. No filler. Short sentences.",
  consultative: "Consultative and curious. Asks a question. Shows you understand their world.",
  casual: "Conversational and warm. Reads like a human, not a template.",
};

/**
 * Writes the full outreach sequence: email, LinkedIn DM, and 2 follow-ups.
 * QC status is set to PENDING here — runQCAgent sets the final status.
 */
export async function runOutreachAgent(
  qualified: QualifiedLead,
  personalizationTrigger: string,
  criteria: LeadSearchCriteria
): Promise<OutreachSequence> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return buildDemoOutreach(qualified, personalizationTrigger, criteria);
  }
  return buildClaudeOutreach(qualified, personalizationTrigger, criteria);
}

// ─── Demo outreach ────────────────────────────────────────────────────────────

function buildDemoOutreach(
  qualified: QualifiedLead,
  trigger: string,
  criteria: LeadSearchCriteria
): OutreachSequence {
  const { candidate } = qualified.enrichment;
  const company = candidate.company;
  const industry = candidate.industry ?? "your space";
  const lang = criteria.output_language ?? "en";

  // Tone-adjusted closing
  const cta =
    criteria.tone === "casual"
      ? `Would it be worth a quick 15 min to see if there's a fit?`
      : criteria.tone === "consultative"
      ? `Happy to share a short example relevant to ${industry} companies if that would help first — just say the word.`
      : `Worth a 15-minute call this week?`;

  const emailBody = lang === "es"
    ? `${trigger}\n\nLeadLens construye inteligencia comercial para empresas en ${industry} — detectando señales públicas de compra, priorizando cuentas por oportunidad y generando estrategia de outreach basada en evidencia. La mayoría de los equipos lo usan para enfocar su energía comercial en las cuentas correctas antes de la primera conversación.\n\n¿Tendría sentido una llamada de 15 minutos esta semana?`
    : lang === "pt"
    ? `${trigger}\n\nLeadLens constrói inteligência comercial para empresas em ${industry} — detectando sinais públicos de compra, priorizando contas por oportunidade e gerando estratégia de outreach baseada em evidências. A maioria das equipes usa para focar energia comercial nas contas certas antes da primeira conversa.\n\nValeria uma chamada de 15 minutos esta semana?`
    : lang === "ja"
    ? `${trigger}\n\nLeadLensは${industry}企業向けに商業インテリジェンスを構築します — 公開購買シグナルの検出、機会別のアカウント優先順位付け、エビデンスベースのアウトリーチ戦略の生成。多くのチームが最初の商談前に正しいアカウントに集中するために活用しています。\n\n今週15分ほどお話しできますか？`
    : `${trigger}\n\nLeadLens builds commercial intelligence for ${industry} companies — detecting public buying signals, ranking accounts by opportunity, and generating evidence-based outreach strategy. Most teams use it to focus their commercial energy on the right accounts before the first conversation.\n\n${cta}`;

  const ldm = lang === "es"
    ? `Pregunta rápida para ${company}: ¿cómo están priorizando actualmente qué cuentas abordar primero en ${industry}? Hemos estado ayudando a equipos de esta industria a mapear señales públicas de compra y enfocar más rápido. Con gusto compartimos más si es relevante.`
    : lang === "pt"
    ? `Pergunta rápida para ${company}: como vocês estão priorizando quais contas abordar primeiro em ${industry}? Temos ajudado equipes dessa indústria a mapear sinais públicos de compra e focar mais rápido. Posso compartilhar mais se fizer sentido.`
    : lang === "ja"
    ? `${company}様への質問：${industry}において、最初にアプローチするアカウントをどのように優先順位付けされていますか？この業界のチームが公開購買シグナルをマッピングし、より迅速に集中できるよう支援してきました。ご関心があればご共有できます。`
    : `Quick question for ${company}: how are you currently prioritizing which accounts to approach first in ${industry}? We've been helping teams in this space map public buying signals and focus faster. Happy to share more if relevant.`;

  const fu1 = lang === "es"
    ? `Retomo por si se perdió entre los correos. Recientemente trabajamos con un equipo de ${industry} que usó LeadLens para identificar cuentas de alta señal que no habían considerado — y una de ellas se convirtió en conversación en la primera semana. ¿Te comparto el detalle?`
    : lang === "pt"
    ? `Retomando caso tenha ficado perdido. Recentemente trabalhamos com uma equipe de ${industry} que usou LeadLens para identificar contas de alto sinal que não tinham considerado — e uma delas se converteu em conversa na primeira semana. Posso compartilhar os detalhes?`
    : lang === "ja"
    ? `先日のメッセージを念のため再送します。最近、${industry}のチームがLeadLensを使って、見落としていた高シグナルのアカウントを特定しました — そのうちの1社が最初の週に商談に発展しました。詳細をシェアできますか？`
    : `Circling back in case this got buried. We recently worked with a ${industry} team that used LeadLens to identify high-signal accounts they hadn't considered — one converted to a conversation in the first week. Happy to share the breakdown if useful.`;

  const fu2 = lang === "es"
    ? `Último mensaje sobre esto. Si no es prioridad en este momento, sin problema — responde "después" y retomo en el próximo trimestre. Si hay alguien más en ${company} que lleva la estrategia comercial o de desarrollo de negocios, con gusto me pongo en contacto con ellos.`
    : lang === "pt"
    ? `Última mensagem sobre isso. Se não é prioridade agora, sem problema — responda "depois" e retorno no próximo trimestre. Se há outra pessoa em ${company} responsável pela estratégia comercial ou de desenvolvimento de negócios, posso entrar em contato.`
    : lang === "ja"
    ? `最後のご連絡です。今は優先事項でなければ、「後日」とご返信ください。来四半期に改めてご連絡します。${company}で商業戦略やビジネス開発を担当されている別の方がいれば、そちらにご連絡することも可能です。`
    : `Last note on this one. If this isn't a priority right now, no problem at all — reply "later" and I'll circle back next quarter. If someone else at ${company} handles commercial strategy or business development, happy to reach out there instead.`;

  const subject =
    lang === "es" ? `Pregunta rápida para ${company}` :
    lang === "pt" ? `Pergunta rápida para ${company}` :
    lang === "ja" ? `${company}へのご質問` :
    `Quick question for ${company}`;

  return {
    personalization_trigger: trigger,
    subject,
    email_body: emailBody,
    linkedin_dm: ldm,
    followup_1: fu1,
    followup_2: fu2,
    tone: criteria.tone,
    qc_status: "APPROVED" as QCStatus,
    qc_notes: [],
  };
}

// ─── Claude outreach ──────────────────────────────────────────────────────────

async function buildClaudeOutreach(
  qualified: QualifiedLead,
  trigger: string,
  criteria: LeadSearchCriteria
): Promise<OutreachSequence> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  const { candidate } = qualified.enrichment;

  const toneGuide = TONE_INSTRUCTIONS[criteria.tone] ?? TONE_INSTRUCTIONS.direct;
  const outputLang = criteria.output_language ?? "en";
  const locNotes = criteria.localization_notes ?? "";

  const SYSTEM = `You write B2B commercial outreach at the company/account level — not to a named individual.
The message is addressed to the company (e.g. "Hi [Company] team" or just a company-level opener) based on public signals and account fit.
Rules:
- No "I hope you're well", "I came across your profile", "I wanted to reach out", or personal name openers
- No hard outcome claims: no "10–20 demos per month", "guaranteed meetings", or specific pipeline numbers. Use: "build a clearer picture of which accounts to prioritize", "identify buying signals before the first conversation", "focus commercial energy on accounts with confirmed timing"
- No emojis in emails
- Do NOT invent facts: no fake hiring news, funding events, or internal company data unless explicitly provided
- Do NOT address a named individual. Use the company name or "your team" / "your commercial team"
- Initial email: max 120 words, 4-part structure: (1) honest company/signal opener, (2) one-sentence problem hypothesis at company level, (3) one-sentence what the offer helps with, (4) soft CTA
- LinkedIn message: max 3 lines, different angle from email, company-addressed
- Follow-ups: shorter, different angle each time, still company-addressed
- CTA: soft ask (15-min call, happy to share an example, etc.)
- Tone: ${toneGuide}
- LANGUAGE: Write ALL copy in ${criteria.outreach_language ?? "English"}. Subject, email body, LinkedIn message, and follow-ups must ALL be in ${criteria.outreach_language ?? "English"}.${locNotes ? `\n- LOCALIZATION: ${locNotes}` : ""}
Return only valid JSON.`;

  const userMsg = `Sender offer: ${criteria.offer_summary}
Value prop: ${criteria.value_proposition}
Tone: ${toneGuide}

Account: ${candidate.company}
Industry: ${qualified.enrichment.candidate.industry ?? "?"} | Size: ${qualified.enrichment.candidate.company_size ?? "?"}
Why this account fits: ${qualified.fit_reasons.join(", ")}

Opportunity context (internal insight — use this to inform your opener angle, do NOT copy it verbatim):
"${trigger}"

Write a fresh, natural company-level opener based on this context. The subject line and email body must NOT repeat the insight word-for-word.

Return JSON:
{
  "subject": "max 8 words, company-level, no clickbait, no ALL CAPS",
  "email_body": "full email following the 4-part structure, max 120 words, company-addressed (not to a named person)",
  "linkedin_dm": "max 3 lines, completely different angle from email, company-addressed",
  "followup_1": "day 3-4, different angle, max 80 words",
  "followup_2": "day 7-8 breakup or re-engage, max 60 words"
}`;

  type Result = Pick<OutreachSequence, "subject" | "email_body" | "linkedin_dm" | "followup_1" | "followup_2">;
  const result = await callClaudeJSON<Result>(SYSTEM, userMsg, 2000);

  return {
    ...result,
    personalization_trigger: trigger,
    tone: criteria.tone,
    qc_status: "APPROVED" as QCStatus,
    qc_notes: [],
  };
}
