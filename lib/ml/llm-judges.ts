// ─── LLM judges (provider-neutral, silver labels) ─────────────────────────────
// Three independent judges over a feature snapshot + evidence text. Judges
// never see: human labels, customer labels, other judges' output, baseline
// decision/category, or future outcomes. Output is validated JSON; on missing
// credits/keys the caller records status provider_unavailable — never a fake
// silver label.

export const JUDGE_VERSION = 1;
export type JudgeId = "evidence_judge" | "commercial_fit_judge" | "skeptical_judge";

export interface JudgeInput {
  // Account-level only — no contacts, no tenant identity.
  company_context: string;   // signal summary + evidence snippet as frozen in the report
  icp_context: string;       // target market/icp notes (admin criteria, not customer notes)
  snapshot: Record<string, unknown>;
}

export interface JudgeResult {
  judge_id: JudgeId;
  judge_version: number;
  label: 0 | 1 | null;       // null = abstain
  probability: number | null;
  confidence: number | null;
  abstain: boolean;
  reason_codes: string[];
  explanation: string;
  provider: string;
  model_id: string;
  status: "completed" | "provider_unavailable" | "invalid_output";
}

const JUDGE_PROMPTS: Record<JudgeId, string> = {
  evidence_judge:
    "You are an evidence auditor. Given a B2B opportunity's evidence, judge ONLY evidence quality: are claims sourced, dated, non-contradictory and grounded? Ignore commercial appeal. Respond with strict JSON: {\"label\":0|1|null,\"probability\":0..1|null,\"confidence\":0..1,\"abstain\":bool,\"reason_codes\":[max 3 short snake_case],\"explanation\":\"<=200 chars\"}. label 1 = evidence supports acting, 0 = evidence too weak, null = cannot judge.",
  commercial_fit_judge:
    "You are a commercial fit analyst. Given a B2B opportunity and the target ICP, judge ONLY fit: industry, region, size, signal relevance to the ICP. Ignore evidence strength. Respond with strict JSON: {\"label\":0|1|null,\"probability\":0..1|null,\"confidence\":0..1,\"abstain\":bool,\"reason_codes\":[max 3 short snake_case],\"explanation\":\"<=200 chars\"}.",
  skeptical_judge:
    "You are a skeptic. Hunt for exaggeration, generic signals, unjustified inference, and timing claims without dates in this B2B opportunity. Respond with strict JSON: {\"label\":0|1|null,\"probability\":0..1|null,\"confidence\":0..1,\"abstain\":bool,\"reason_codes\":[max 3 short snake_case],\"explanation\":\"<=200 chars\"}. label 0 = overstated/weak, 1 = survives skepticism, null = cannot judge.",
};

export async function runJudge(judgeId: JudgeId, input: JudgeInput): Promise<JudgeResult> {
  const base: Omit<JudgeResult, "status"> = {
    judge_id: judgeId, judge_version: JUDGE_VERSION, label: null, probability: null,
    confidence: null, abstain: true, reason_codes: [], explanation: "",
    provider: "anthropic", model_id: "unknown",
  };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...base, status: "provider_unavailable", explanation: "ANTHROPIC_API_KEY missing" };
  }
  try {
    const { callClaude, MODEL } = await import("@/lib/anthropic") as { callClaude: (system: string, user: string, maxTokens?: number) => Promise<string>; MODEL: string };
    const user = JSON.stringify({
      company_context: input.company_context.slice(0, 1500),
      icp_context: input.icp_context.slice(0, 500),
      snapshot: input.snapshot,
    });
    const raw = await callClaude(JUDGE_PROMPTS[judgeId], user, 300);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ...base, model_id: MODEL, status: "invalid_output", explanation: "no JSON in response" };
    const parsed = JSON.parse(jsonMatch[0]) as Partial<JudgeResult> & { label?: unknown };
    const label = parsed.label === 0 || parsed.label === 1 ? parsed.label : null;
    return {
      ...base,
      model_id: MODEL,
      label,
      probability: typeof parsed.probability === "number" ? Math.max(0, Math.min(1, parsed.probability)) : null,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : null,
      abstain: label === null || parsed.abstain === true,
      reason_codes: Array.isArray(parsed.reason_codes) ? parsed.reason_codes.slice(0, 3).map(String) : [],
      explanation: String(parsed.explanation ?? "").slice(0, 220),
      status: "completed",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "call failed";
    const unavailable = /credit|billing|401|403|api key/i.test(msg);
    return { ...base, status: unavailable ? "provider_unavailable" : "invalid_output", explanation: msg.slice(0, 150) };
  }
}
