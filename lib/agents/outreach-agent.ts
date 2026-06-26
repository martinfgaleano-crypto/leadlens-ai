import type { QualifiedLead, OutreachSequence, LeadSearchCriteria, QCStatus, PersonalizationResult } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

const TONE_INSTRUCTIONS: Record<string, string> = {
  direct: "Direct and to the point. No filler. Short sentences.",
  consultative: "Consultative and curious. Asks a question. Shows you understand their world.",
  casual: "Conversational and warm. Reads like a human, not a template.",
};

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

// ─── Post-QC deterministic repair (exported — called from pipeline) ───────────

export function repairOutreachIfNeeded(
  outreach: OutreachSequence,
  criteria: LeadSearchCriteria,
  qualified: QualifiedLead
): OutreachSequence {
  const qcNotes = outreach.qc_notes ?? [];
  const industry = qualified.enrichment.candidate.industry ?? "their sector";
  const company = qualified.enrichment.candidate.company;
  const trigger = outreach.personalization_trigger;
  const category = qualified.category;

  let emailBody = outreach.email_body;
  let subject = outreach.subject;
  let repaired = false;
  const repairNotes: string[] = [];

  // Repair 1: Opener copies trigger verbatim
  const hasVerbatimFlag = qcNotes.some(n =>
    (n.toLowerCase().includes("copy") && n.toLowerCase().includes("trigger")) ||
    n.toLowerCase().includes("verbatim")
  );
  if (hasVerbatimFlag && trigger && trigger.length > 20) {
    const paras = emailBody.split("\n\n");
    const naturalOpener = rewriteSignalNaturally(trigger, company, true);
    if (paras.length > 0 && !paras[0].startsWith(naturalOpener.slice(0, 30))) {
      paras[0] = naturalOpener;
      emailBody = paras.join("\n\n");
      repaired = true;
      repairNotes.push("opener rewritten — was copying trigger verbatim");
    }
  }

  // Repair 2: Hardcoded audience suffix for wrong industry
  const isSaaSTarget = criteria.target_industries.some(i => /saas|software|tech|agency/i.test(i));
  if (!isSaaSTarget) {
    const patterns = [
      { from: /for b2b saas and agencies/gi, to: `for ${industry} teams` },
      { from: /for saas companies/gi, to: `for ${industry} companies` },
      { from: /for b2b saas/gi, to: `for ${industry} businesses` },
    ];
    for (const { from, to } of patterns) {
      if (from.test(emailBody)) {
        emailBody = emailBody.replace(from, to);
        repaired = true;
        repairNotes.push("offer adapted — removed hardcoded 'B2B SaaS and agencies' for non-SaaS target");
        break;
      }
    }
  }

  // Repair 3: Generic repeated CTA
  const genericCTAs: [string, string][] = [
    ["Worth a 15-minute call this week?", buildContextualCTA(industry, category, criteria.tone, company)],
    ["Worth a 15-minute call?", buildContextualCTA(industry, category, criteria.tone, company)],
    [
      "specifically relevant for",
      `particularly relevant for ${industry} companies at this stage —`,
    ],
  ];
  for (const [from, to] of genericCTAs) {
    if (emailBody.includes(from)) {
      emailBody = emailBody.replace(from, to);
      repaired = true;
      repairNotes.push("CTA contextualised");
      break;
    }
  }

  // Repair 4: Generic subject
  if (/signal caught our attention/i.test(subject)) {
    subject = buildSubjectFromSignal(company, trigger, true);
    repaired = true;
    repairNotes.push("subject rewritten");
  }

  if (!repaired) return outreach;

  return {
    ...outreach,
    email_body: emailBody,
    subject,
    was_repaired: true,
    qc_notes: [...qcNotes, `[Auto-repair] ${repairNotes.join("; ")}`],
  };
}

// ─── Signal rewriting — natural, never verbatim ───────────────────────────────

function rewriteSignalNaturally(trigger: string, company: string, hasSignal: boolean): string {
  if (!hasSignal || !trigger || trigger.length < 10) {
    return `${company} came up in a segment scan for accounts that match this profile at this commercial stage.`;
  }

  const t = trigger.toLowerCase();

  if (/hiring|open role|job posting|head of|vp sales|cro|sdr|bdr|recruiti|sales director/.test(t)) {
    const roleMatch = trigger.match(/(?:hiring|open role for|new |recruiting\s+a?\s*)([A-Z][a-zA-Z ]{3,30})/);
    const role = roleMatch ? roleMatch[1].trim() : "commercial roles";
    return `Noticed ${company} is building out their ${role} team — that kind of hiring usually tracks with active go-to-market investment.`;
  }

  if (/warehouse|distribution center|expand|new facilit|new location|opening/.test(t)) {
    return `Saw the expansion activity at ${company} — physical growth at that scale typically comes with vendor re-evaluation on the operations side.`;
  }

  if (/funding|raised|series|seed|investment|round/.test(t)) {
    return `Caught the recent investment news for ${company} — new capital typically accelerates vendor decisions in the 90-day window after close.`;
  }

  if (/pricing page|product launch|product update|new tier|new plan|feature/.test(t)) {
    return `Noticed ${company} updated its commercial offering — that kind of move usually signals a broader market push or go-to-market shift.`;
  }

  if (/trade show|conference|event|exhibit/.test(t)) {
    return `Saw ${company} is active at industry events this season — that typically signals active market development.`;
  }

  if (/acquisition|merger|partner/.test(t)) {
    return `${company}'s recent structural changes suggest there may be a vendor review window opening up.`;
  }

  if (/linkedin|announcement|press release/.test(t)) {
    return `${company}'s recent announcements looked relevant — the signals match what we track for accounts at this stage.`;
  }

  // Fallback: paraphrase the first clause naturally
  const firstClause = trigger.split(/[,.;]/)[0].trim();
  if (firstClause.length > 20 && firstClause.length <= 100) {
    return `${firstClause} — when accounts show that kind of activity, it's usually worth a short conversation to see if the timing is right.`;
  }

  return `${company} came up based on public signals that match what we track for accounts at this commercial stage.`;
}

// ─── Industry-adaptive offer framing ─────────────────────────────────────────

function adaptOfferToIndustry(
  offerSummary: string,
  valueProp: string,
  industry: string,
  company: string
): { offerLine: string; valueAngle: string } {
  // Strip hardcoded audience suffixes that break adaptation
  const cleanOffer = offerSummary
    .replace(/\s*—?\s*for b2b saas (and|&) agencies\.?/gi, "")
    .replace(/\s*—?\s*for saas companies\.?/gi, "")
    .replace(/\s*—?\s*for b2b companies\.?/gi, "")
    .replace(/\s*—?\s*for (software|tech) teams\.?/gi, "")
    .trim();

  const lower = industry.toLowerCase();

  if (/logistic|freight|supply chain|transport|warehouse|3pl|shipping/.test(lower)) {
    return {
      offerLine: `${cleanOffer} — applied to logistics and freight operations where account prioritization determines route profitability`,
      valueAngle: `3PLs and freight operators expanding capacity typically face the same problem: too many potential accounts, not enough signal on which ones are actively evaluating vendors. We narrow that list based on public expansion signals.`,
    };
  }

  if (/food|import|export|commodity|wholesale|grocery|produce|fmcg/.test(lower)) {
    return {
      offerLine: `${cleanOffer} — adapted for food exporters and importers expanding wholesale buyer or distributor coverage`,
      valueAngle: `Identifying new wholesale buyers or distributors in a target market typically requires months of relationship groundwork. We surface accounts already showing public purchasing signals or expansion activity in your category.`,
    };
  }

  if (/health|clinic|medical|pharma|dental|hospital|care|wellness/.test(lower)) {
    return {
      offerLine: `${cleanOffer} — adapted for healthcare organizations navigating vendor evaluation cycles`,
      valueAngle: `Healthcare procurement decisions often track budget windows and facility expansions. Identifying facilities actively evaluating new vendors — before they've committed — significantly shortens the sales cycle.`,
    };
  }

  if (/manufactur|industrial|supplier|hardware|equipment/.test(lower)) {
    return {
      offerLine: `${cleanOffer} — applicable to industrial suppliers identifying new distribution and procurement accounts`,
      valueAngle: `Industrial B2B sales depend on catching accounts at the right moment — plant expansions, vendor consolidations, or new distribution channel openings.`,
    };
  }

  if (/hospitality|hotel|restaurant|travel|accommodation|leisure/.test(lower)) {
    return {
      offerLine: `${cleanOffer} — relevant for hospitality operators evaluating supplier relationships`,
      valueAngle: `Hospitality procurement typically follows property expansions or management transitions. Identifying these moments early gives vendors a meaningful timing advantage.`,
    };
  }

  // SaaS/Software/Agency — use as-is (the offer is already scoped correctly)
  if (/saas|software|tech|agency|consulting|service/.test(lower)) {
    return {
      offerLine: cleanOffer,
      valueAngle: valueProp.slice(0, 150),
    };
  }

  // Generic fallback — still better than a hardcoded "B2B SaaS" suffix
  return {
    offerLine: `${cleanOffer} — relevant for ${industry} companies at this scale`,
    valueAngle: valueProp.slice(0, 150),
  };
}

// ─── CTA variation by industry, category, tone ───────────────────────────────

function buildContextualCTA(
  industry: string,
  category: string,
  tone: string,
  company: string
): string {
  const isCold = category === "COLD" || category === "DISCARD";
  if (isCold) {
    return `If this matches anything ${company} is working on right now, happy to share a short overview — no commitment either way.`;
  }

  const lower = industry.toLowerCase();
  const idx = (company.charCodeAt(0) + company.length) % 3;

  if (/logistic|freight|3pl|transport|warehouse/.test(lower)) {
    return [
      "Open to a 15-min call to see if this makes sense for your current account mix?",
      "Happy to share a relevant example from the logistics segment if useful.",
      "Would it be worth a quick conversation to see if the fit is there?",
    ][idx];
  }

  if (/food|import|export|distribut|wholesale/.test(lower)) {
    return [
      "Would it be useful if I shared a short buyer-fit overview for your target markets?",
      "Open to a quick call to explore whether this matches what you're looking for?",
      "Happy to put together a short example relevant to your target buyers.",
    ][idx];
  }

  if (/health|clinic|medical/.test(lower)) {
    return [
      "Open to a 15-minute call to see if this is relevant to your current evaluation cycle?",
      "Happy to share a short example from similar healthcare accounts if useful.",
      "Would it be worth exploring whether the timing lines up with your next review?",
    ][idx];
  }

  if (tone === "consultative") {
    return [
      "Happy to share a short example relevant to your segment — just say the word.",
      "Curious whether this matches what you're prioritising right now — worth a quick call?",
      "Would it help if I shared a concrete example first, before any commitment?",
    ][idx];
  }

  if (tone === "casual") {
    return [
      "Worth a quick 15-min to see if there's a fit?",
      "Happy to share more if this resonates — no pitch, just context.",
      "Would it be useful to compare notes? 15 minutes, no obligation.",
    ][idx];
  }

  return [
    "Open to a 15-minute call to see if this is relevant for your current focus?",
    "Happy to share a short example if useful — 15 minutes would be enough.",
    "Worth a quick call to see if there's a fit here?",
  ][idx];
}

// ─── Subject line from signal ─────────────────────────────────────────────────

function buildSubjectFromSignal(company: string, trigger: string, hasSignal: boolean): string {
  if (!hasSignal || !trigger) return `Question for ${company}`;
  const t = trigger.toLowerCase();
  if (/hiring|open role|job posting|sdr|bdr|head of/.test(t)) return `${company} — re: the team expansion`;
  if (/warehouse|distribution|expand|new location|new facilit/.test(t)) return `${company} expansion — quick question`;
  if (/funding|raised|series|investment/.test(t)) return `${company} — following the investment news`;
  if (/pricing|product launch|product update|new plan/.test(t)) return `${company} — noticed the product update`;
  if (/trade show|conference|event/.test(t)) return `Following ${company}'s market activity`;
  if (/acquisition|merger/.test(t)) return `${company} — re: recent changes`;
  if (/linkedin|announcement/.test(t)) return `Following ${company}'s growth`;
  return `${company} — thought this was relevant`;
}

// ─── COLD / monitor email ─────────────────────────────────────────────────────

function buildColdMonitorEmail(company: string, industry: string, offerLine: string, trigger: string): string {
  const hasConfirmedSignal = trigger && trigger.length > 20 && !/based on|no confirmed|inferred/i.test(trigger);
  const signalNote = hasConfirmedSignal
    ? `Public signals suggest ${company} may be at an early stage of evaluating options in this area.`
    : `${company} fits the ${industry} segment profile but lacks confirmed buying signals at this time.`;

  return `${signalNote}\n\nBefore formal outreach, recommend validating: (1) whether the pain hypothesis matches their current priorities, and (2) whether a decision-maker is in place to receive this message.\n\n${offerLine.slice(0, 120)}.\n\nIf fit is confirmed, this account can move into the active pipeline.`;
}

// ─── Demo outreach builder ────────────────────────────────────────────────────

function buildDemoOutreach(
  qualified: QualifiedLead,
  personalization: PersonalizationResult,
  criteria: LeadSearchCriteria
): OutreachSequence {
  const { candidate } = qualified.enrichment;
  const company = candidate.company;
  const industry = candidate.industry ?? "your sector";
  const lang = criteria.output_language ?? "en";
  const trigger = personalization.personalization_trigger;
  const hasSignal = personalization.personalization_confidence >= 0.75;
  const category = qualified.category;
  const isCold = category === "COLD" || category === "DISCARD";

  const { offerLine, valueAngle } = adaptOfferToIndustry(
    criteria.offer_summary,
    criteria.value_proposition,
    industry,
    company
  );

  const signalOpener = rewriteSignalNaturally(trigger, company, hasSignal);
  const cta = buildContextualCTA(industry, category, criteria.tone, company);

  // ── Email body ─────────────────────────────────────────────────────────────
  let emailBody: string;

  if (isCold) {
    emailBody =
      lang === "es"
        ? `${company} apareció en un análisis del segmento ${industry}.\n\nSin señal de compra confirmada por ahora. Antes de hacer outreach directo, recomendamos validar si el encaje es real.\n\n${offerLine.slice(0, 100)}.\n\nSi el encaje se confirma, puede pasar a seguimiento activo.`
        : lang === "pt"
        ? `${company} apareceu numa análise do segmento ${industry}.\n\nSem sinal de compra confirmado. Recomendamos validar o encaixe antes de iniciar outreach direto.\n\n${offerLine.slice(0, 100)}.\n\nSe confirmado, esta conta pode avançar para acompanhamento ativo.`
        : buildColdMonitorEmail(company, industry, offerLine, trigger);
  } else {
    emailBody =
      lang === "es"
        ? buildSpanishEmail(company, industry, signalOpener, cta, offerLine, valueAngle)
        : lang === "pt"
        ? buildPortugueseEmail(company, industry, signalOpener, cta, offerLine, valueAngle)
        : lang === "ja"
        ? buildJapaneseEmail(company, industry, signalOpener, offerLine)
        : buildEnglishEmail(signalOpener, cta, offerLine, valueAngle);
  }

  // ── LinkedIn DM ────────────────────────────────────────────────────────────
  const ldm = isCold
    ? (lang === "es"
        ? `${company} está en nuestro radar para el segmento ${industry} — sin señal activa por ahora.`
        : lang === "pt"
        ? `${company} está em nosso radar para o segmento ${industry} — sem sinal ativo por enquanto.`
        : `${company} is on our monitor list for the ${industry} segment — no active signal yet.`)
    : lang === "es"
    ? `Pregunta rápida para ${company}: ¿cómo están priorizando actualmente su expansión en ${industry}? ${offerLine.slice(0, 80)} — relevante para equipos en esta etapa.`
    : lang === "pt"
    ? `Pergunta rápida para ${company}: como priorizam expansão em ${industry}? ${offerLine.slice(0, 80)} — relevante para equipes nessa fase.`
    : lang === "ja"
    ? `${company}様への質問：${industry}での優先事項は何でしょうか？${offerLine.slice(0, 60)}について、お役に立てる可能性があります。`
    : buildLinkedInDM(company, industry, personalization.strongest_hook, offerLine);

  // ── Follow-ups ─────────────────────────────────────────────────────────────
  const offerShort = offerLine.slice(0, 70).replace(/\.$/, "");

  const fu1 = isCold
    ? `Following up — ${company} is still in the monitor category for the ${industry} segment. If priorities have shifted, happy to reconnect.`
    : lang !== "en"
    ? buildFollowUp1Localized(company, industry, lang, offerShort)
    : buildFollowUp1English(company, industry, offerShort);

  const fu2 = isCold
    ? `Last note — leaving ${company} in monitor. Will revisit if the signal picture changes.`
    : lang !== "en"
    ? buildFollowUp2Localized(company, lang)
    : buildFollowUp2English(company);

  // ── Call opener ────────────────────────────────────────────────────────────
  const call_opener = isCold
    ? `Hi, ${company} came up in a segment scan for ${industry} — the fit looks partial. Would you have 90 seconds to tell me whether the timing makes sense?`
    : `Hi, reaching out because ${company} came up as a strong fit for what we do — ${offerShort}. Do you have 90 seconds for a one-sentence overview?`;

  // ── CTA recommendation ─────────────────────────────────────────────────────
  const cta_recommendation = isCold
    ? `COLD account — do not begin outreach before manual validation. Recommended next step: research whether the pain hypothesis holds, then decide whether to move to active pipeline.`
    : hasSignal
    ? `Lead with the signal in the subject line — it's the strongest differentiator from generic outreach. Keep the CTA a soft 15-minute ask, not a demo request.`
    : `No confirmed signal — frame as curiosity-driven: 'curious whether this matches what you're working on'. Avoid asserting knowledge of their priorities.`;

  return {
    personalization_trigger: trigger,
    recommended_angle: personalization.recommended_angle,
    subject: isCold
      ? `${company} — segment fit (monitor)`
      : buildSubjectFromSignal(company, trigger, hasSignal),
    email_body: emailBody,
    linkedin_dm: ldm,
    followup_1: fu1,
    followup_2: fu2,
    call_opener,
    cta_recommendation,
    outreach_assumptions: personalization.account_reasoning,
    what_to_avoid_in_outreach: isCold
      ? `Do not send this as ready-to-send outreach. Validate pain hypothesis and confirm decision-maker before initiating contact.`
      : personalization.what_to_avoid,
    tone: criteria.tone,
    qc_status: (isCold ? "REVIEW_NEEDED" : "APPROVED") as QCStatus,
    qc_notes: isCold
      ? ["COLD account — manual review required before outreach. Validate fit and timing before sending."]
      : [],
  };
}

// ─── Email body builders ──────────────────────────────────────────────────────

function buildEnglishEmail(signalOpener: string, cta: string, offerLine: string, valueAngle: string): string {
  return `${signalOpener}\n\n${offerLine.slice(0, 150)}.\n\n${valueAngle.slice(0, 150)}\n\n${cta}`;
}

function buildSpanishEmail(
  company: string, industry: string, signalOpener: string, cta: string,
  offerLine: string, valueAngle: string
): string {
  return `${signalOpener}\n\n${offerLine.slice(0, 150)}.\n\n${valueAngle.slice(0, 150)}\n\n${cta}`;
}

function buildPortugueseEmail(
  company: string, industry: string, signalOpener: string, cta: string,
  offerLine: string, valueAngle: string
): string {
  return `${signalOpener}\n\n${offerLine.slice(0, 150)}.\n\n${valueAngle.slice(0, 150)}\n\nValeria uma conversa rápida esta semana?`;
}

function buildJapaneseEmail(company: string, industry: string, signalOpener: string, offerLine: string): string {
  return `${signalOpener}\n\n${offerLine.slice(0, 100)} — ${industry}の企業に特に関連性が高いと考えています。\n\n今週15分ほどお話しできますか？`;
}

function buildLinkedInDM(company: string, industry: string, hook: string, offerLine: string): string {
  const hookLine = hook && hook.length > 20
    ? hook.slice(0, 100).replace(/\.$/, "")
    : `Quick question for ${company}`;
  return `${hookLine}. ${offerLine.slice(0, 80).replace(/\.$/, "")} — relevant for ${industry} teams at this stage. Happy to share more if it fits.`;
}

function buildFollowUp1English(company: string, industry: string, offerShort: string): string {
  const idx = (company.charCodeAt(0) + company.length) % 3;
  return [
    `Circling back — ${offerShort} for ${industry} teams. Happy to share a short example if that would help.`,
    `Following up in case this got buried. The fit looked strong for ${company}'s current stage — ${offerShort}. Worth a quick look?`,
    `Looping back on this. Still think the timing could work for ${company} — ${offerShort}. Happy to share more context.`,
  ][idx];
}

function buildFollowUp2English(company: string): string {
  const idx = (company.charCodeAt(0) + company.length) % 3;
  return [
    `Last note. If this isn't the right timing for ${company}, no problem — reply "later" and I'll check back. If there's someone else better placed to evaluate this, happy to reach them instead.`,
    `Final follow-up on this one. If priorities have shifted or this doesn't match what ${company} is working on, just say the word. No pressure.`,
    `Leaving it here. If the moment isn't right for ${company}, I'll circle back when the signals line up better. Reply "not now" and I'll respect that.`,
  ][idx];
}

function buildFollowUp1Localized(company: string, industry: string, lang: string, offerShort = ""): string {
  if (lang === "es") return `Retomo por si no llegó. ${offerShort ? offerShort + " —" : ""} relevante para equipos de ${industry}. ¿Te comparto un ejemplo concreto?`;
  if (lang === "pt") return `Retomando caso não tenha chegado. ${offerShort ? offerShort + " —" : ""} relevante para equipes de ${industry}. Posso compartilhar um exemplo?`;
  if (lang === "ja") return `先日のメッセージを念のため再送します。${offerShort ? offerShort + " —" : ""}${industry}チームに関連性が高いです。詳細をシェアできますか？`;
  return buildFollowUp1English(company, industry, offerShort);
}

function buildFollowUp2Localized(company: string, lang: string): string {
  if (lang === "es") return `Último mensaje. Si no es el momento para ${company}, sin problema — responde "después" y retomo cuando cambie el contexto. Si hay otra persona mejor posicionada, con gusto me pongo en contacto.`;
  if (lang === "pt") return `Última mensagem. Se não é o momento certo para ${company}, sem problema — responda "depois" e retorno quando as condições mudarem.`;
  if (lang === "ja") return `最後のご連絡です。${company}での優先事項でなければ、「後日」とご返信ください。担当者が他にいれば、そちらへご連絡することも可能です。`;
  return buildFollowUp2English(company);
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
  const locNotes = criteria.localization_notes ?? "";
  const hasConfirmedSignal = personalization.personalization_confidence >= 0.75;
  const category = qualified.category;
  const isCold = category === "COLD" || category === "DISCARD";
  const industry = candidate.industry ?? "their sector";

  const senderName = criteria.sender_company_name ?? "the company using this system";
  const senderDesc = criteria.sender_company_description ?? criteria.offer_summary;

  const coldInstructions = isCold
    ? `\nCOLD ACCOUNT (score ${qualified.fit_score}/10) — SPECIAL RULES:
- Do NOT generate aggressive outreach or strong CTAs
- Generate a short "research validation" email — exploratory, not a pitch
- CTA must be very low-friction: "let us know if this is relevant" not "let's book a call"
- Follow-ups should be minimal, not pushy
- outreach_assumptions must start with "COLD — validate fit before sending"`
    : "";

  const SYSTEM = `You write B2B commercial outreach at the company/account level — not to a named individual.

CRITICAL ROLE CLARITY:
- SENDER (who writes this message): ${senderName} — ${senderDesc.slice(0, 120)}
- RECIPIENT (who receives this message): the target account in the user message
- Write as if you ARE the sender company reaching out to the recipient
- The value proposition is what the SENDER offers to the RECIPIENT
- NEVER mention "LeadLens" in any outreach copy
- Use "we", "our", "us" from the SENDER's perspective

OFFER ADAPTATION — CRITICAL:
- If the sender offer mentions "B2B SaaS and agencies" or "software teams" but the RECIPIENT is in ${industry}, do NOT copy those words
- Reframe the offer value line for what it would do for a ${industry} company specifically
- The email must feel written for THIS industry, not pasted from a template

FORBIDDEN PHRASES — NEVER USE THESE:
- "That kind of signal often correlates with commercial evaluation activity"
- "signal caught our attention" (in subject or body)
- "Worth a 15-minute call this week?" (too generic — vary the CTA)
- "specifically relevant for [X] teams at this stage" (overused)
- "B2B SaaS and agencies" (unless recipient IS in SaaS/agencies)
- "could benefit from", "may be interested in", "improve efficiency", "streamline operations"
- "drive more revenue", "boost productivity"
${coldInstructions}

VARIETY REQUIRED:
- First line must REWRITE the trigger naturally — do NOT copy trigger text verbatim
- Instead of "LinkedIn company updates from last month reference an upcoming product expansion into performance management", write "Noticed ${candidate.company} is pushing into performance management — that kind of product move typically signals..."
- CTAs must be industry-specific and non-generic

Evidence discipline:
- Confirmed signal (confidence ≥ 0.75): reference it naturally but rewritten, never copy-pasted
- No confirmed signal: use "appears to", "based on what we've observed", "companies at your stage often"
- NEVER claim to know their internal priorities as fact

Structure (non-COLD):
- Email: (1) unique natural opener rewriting the signal, (2) why this matters for THIS industry specifically, (3) sender offer adapted to this recipient's industry in ONE sentence, (4) contextual low-friction CTA
- Max 120 words email body
- LinkedIn: max 3 lines, completely different angle, start with question or observation

Compliance:
- No "Hi [Name]", no fake familiarity
- No hard outcome promises
- No personal data
- No emojis in email
- ${locNotes ? `LOCALIZATION: ${locNotes}` : `Write in ${criteria.outreach_language ?? "English"}`}
Return only valid JSON.`;

  const userMsg = `SENDER (writing this message): ${senderName}
Sender description: ${senderDesc.slice(0, 150)}
Sender offer: ${criteria.offer_summary}
Sender value prop: ${criteria.value_proposition}
Tone: ${toneGuide}

RECIPIENT (target account receiving this message):
Account: ${candidate.company}
Industry: ${industry} | Size: ${candidate.company_size ?? "?"}
Fit score: ${qualified.fit_score}/10 (${category})
Fit reasons: ${qualified.fit_reasons.join(", ")}
Score explanation: ${qualified.score_explanation ?? "see fit_reasons"}

Personalization:
- Trigger: "${personalization.personalization_trigger}"
- Recommended angle: "${personalization.recommended_angle}"
- Strongest hook: "${personalization.strongest_hook}"
- What to avoid: "${personalization.what_to_avoid}"
- Confidence: ${Math.round(personalization.personalization_confidence * 100)}% (${hasConfirmedSignal ? "signal-led" : "hypothesis-led"})

IMPORTANT: Do NOT copy the trigger verbatim. Rewrite it naturally.
IMPORTANT: Adapt the offer framing to what it would do specifically for a ${industry} company — not generic "B2B SaaS and agencies" language.

Return JSON:
{
  "subject": "max 8 words, company-level, references signal if available — no 'signal caught our attention'",
  "email_body": "full email, max 120 words, 4-part structure, industry-adapted",
  "linkedin_dm": "max 3 lines, completely different angle, starts with question",
  "followup_1": "day 3-4, new angle, max 80 words",
  "followup_2": "day 7-8 breakup, max 60 words${isCold ? " — minimal and non-pushy" : ""}",
  "call_opener": "1-sentence cold call intro, reference company and industry, ask for 90 seconds",
  "cta_recommendation": "what CTA works best for this account and why${isCold ? " (COLD = research validation, not call booking)" : ""}",
  "outreach_assumptions": "key assumption this outreach makes${isCold ? " — start with COLD: validate fit before sending" : ""}",
  "what_to_avoid_in_outreach": "what would make this outreach feel generic or wrong for this specific company"
}`;

  type Result = Pick<OutreachSequence, "subject" | "email_body" | "linkedin_dm" | "followup_1" | "followup_2" | "call_opener" | "cta_recommendation" | "outreach_assumptions" | "what_to_avoid_in_outreach">;
  const result = await callClaudeJSON<Result>(SYSTEM, userMsg, 2500);

  return {
    ...result,
    personalization_trigger: personalization.personalization_trigger,
    recommended_angle: personalization.recommended_angle,
    tone: criteria.tone,
    qc_status: (isCold ? "REVIEW_NEEDED" : "APPROVED") as QCStatus,
    qc_notes: isCold ? ["COLD account — manual review required before outreach"] : [],
  };
}
