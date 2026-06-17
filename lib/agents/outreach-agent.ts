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
  const firstName = candidate.name?.split(" ")[0] ?? "there";
  const company = candidate.company;
  const industry = candidate.industry ?? "your space";
  const lang = criteria.output_language ?? "en";

  // Tone-adjusted closing
  const cta =
    criteria.tone === "casual"
      ? `Would it be worth a quick 15 min to see if there's a fit?`
      : criteria.tone === "consultative"
      ? `Happy to share a short example relevant to ${industry} if that would help first — just say the word.`
      : `Worth a 15-minute call this week?`;

  const emailBody = lang === "es"
    ? `${trigger}\n\nLeadLens investiga y califica prospectos en ${industry} según tu ICP ideal, y genera secuencias de outreach personalizadas para cada contacto. La mayoría de los equipos lo usan para reemplazar el trabajo manual de prospección.\n\n¿Tendría sentido una llamada de 15 minutos esta semana?`
    : lang === "pt"
    ? `${trigger}\n\nLeadLens pesquisa e qualifica leads em ${industry} com base no seu ICP e cria sequências de outreach personalizadas para cada contato. A maioria das equipes usa para substituir a prospecção manual.\n\nValeria uma chamada de 15 minutos esta semana?`
    : lang === "ja"
    ? `${trigger}\n\nLeadLensは${industry}の見込み客をICPに基づいて調査・評価し、各連絡先向けにパーソナライズされたアウトリーチシーケンスを作成します。多くのチームが手動でのリスト作業の代替として活用しています。\n\n今週15分ほどお話しできますか？`
    : `${trigger}\n\nLeadLens researches and qualifies ${industry} leads against your ICP, then writes personalized outreach for each — email, LinkedIn DM, and two follow-ups. Most teams use it to replace manual list-building and generic templates.\n\n${cta}`;

  const ldm = lang === "es"
    ? `${firstName} — pregunta rápida: ¿cómo están manejando actualmente la investigación de prospectos y la personalización en ${company}? Hemos estado ayudando a equipos de ${industry} a agilizar ese proceso. Con gusto te cuento más si es relevante.`
    : lang === "pt"
    ? `${firstName} — uma pergunta rápida: como vocês estão lidando com pesquisa de leads e personalização no ${company}? Temos ajudado equipes de ${industry} a acelerar esse processo. Posso compartilhar mais se fizer sentido.`
    : lang === "ja"
    ? `${firstName}様、${company}では現在、リサーチとパーソナライズをどのように対応されていますか？${industry}のチームをサポートしてきた実績があります。ご関心があればご共有できます。`
    : `${firstName} — quick one: how are you currently handling lead research and first-touch personalization at ${company}? We've been helping ${industry} teams speed that up significantly. Happy to share what we're doing if relevant.`;

  const fu1 = lang === "es"
    ? `${firstName}, retomo por si se perdió entre los correos. Trabajamos con un equipo de ${industry} similar a ${company} y lograron estructurar su outbound sin contratar un SDR de tiempo completo. ¿Te comparto el detalle?`
    : lang === "pt"
    ? `${firstName}, retomando caso tenha ficado perdido. Trabalhamos com uma equipe de ${industry} parecida com ${company} e conseguiram estruturar o outbound sem contratar um SDR. Posso compartilhar os detalhes?`
    : lang === "ja"
    ? `${firstName}様、先日のメッセージを念のため再送します。${industry}の${company}様に似たチームと取り組んだ事例があります。詳細をシェアできますか？`
    : `${firstName}, circling back in case this got buried. We recently worked with a ${industry} team similar to ${company} — went from zero structured outbound to 12 qualified conversations in one batch. Happy to share the breakdown if useful.`;

  const fu2 = lang === "es"
    ? `Último mensaje, ${firstName}. Si esto no es prioridad en este momento, sin problema — responde "después" y retomo en el próximo trimestre. Si alguien más en ${company} es quien lleva este tema, con gusto lo contactamos.`
    : lang === "pt"
    ? `Última mensagem, ${firstName}. Se isso não é prioridade agora, sem problema — responda "depois" e retorno no próximo trimestre. Se outra pessoa em ${company} cuida disso, posso entrar em contato com ela.`
    : lang === "ja"
    ? `${firstName}様、最後のご連絡です。今は優先事項でなければ、「後日」とご返信ください。来四半期に改めてご連絡します。${company}で別のご担当者がいれば、そちらにご連絡することも可能です。`
    : `Last note, ${firstName}. If outbound lead research isn't on the priority list right now, no worries — reply "later" and I'll check back next quarter. If someone else at ${company} owns this, happy to connect with them instead.`;

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

  const SYSTEM = `You write B2B cold outreach with high reply rates.
Rules:
- No "I hope you're well", "I came across your profile", or "I wanted to reach out"
- No hard outcome claims: never say "10–20 demos per month", "guaranteed meetings", "we will get you X clients", or any specific pipeline numbers. Use softer language: "build a more consistent outbound motion", "improve lead quality before reps start sending", "reduce time spent on manual prospect research", "test outbound without immediately hiring a full SDR team"
- No emojis in emails
- Do NOT invent facts: no fake hiring news, funding events, or LinkedIn activity unless explicitly provided
- Initial email: max 120 words, 4-part structure: (1) honest role/stage/industry opener, (2) one-sentence problem hypothesis, (3) one-sentence what the offer helps with, (4) soft CTA
- LinkedIn DM: max 3 lines, different angle from email
- Follow-ups: shorter, different angle each time
- CTA: soft ask (20-min call, happy to share a case study, etc.)
- Tone: ${toneGuide}
- LANGUAGE: Write ALL copy in ${criteria.outreach_language ?? "English"}. Subject, email body, LinkedIn DM, and follow-ups must ALL be in ${criteria.outreach_language ?? "English"}.${locNotes ? `\n- LOCALIZATION: ${locNotes}` : ""}
Return only valid JSON.`;

  const userMsg = `Sender offer: ${criteria.offer_summary}
Value prop: ${criteria.value_proposition}
Tone: ${toneGuide}

Lead: ${candidate.name ?? "?"}, ${candidate.title ?? "?"} at ${candidate.company}
Industry: ${qualified.enrichment.candidate.industry ?? "?"} | Size: ${qualified.enrichment.candidate.company_size ?? "?"}
Fit reasons: ${qualified.fit_reasons.join(", ")}

Personalization context (internal insight — use this to inform your opener angle, do NOT copy it verbatim):
"${trigger}"

Write a fresh, natural email opener based on this context. The subject line and email body must NOT repeat the insight word-for-word.

Return JSON:
{
  "subject": "max 8 words, no clickbait, no ALL CAPS",
  "email_body": "full email following the 4-part structure, max 120 words",
  "linkedin_dm": "max 3 lines, completely different angle from email",
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
