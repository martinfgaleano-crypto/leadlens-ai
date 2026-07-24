import Anthropic from "@anthropic-ai/sdk";

// Model to use across all agents. Change here to update everywhere.
export const MODEL = "claude-sonnet-4-6";
// Standard API list price verified 2026-07-22. Env overrides make pricing
// explicit and auditable when Anthropic changes rates. This calculates token
// usage at list price; it is NOT a provider invoice or proof of billed spend.
export const ANTHROPIC_PRICING = {
  inputUsdPerMillion: Number(process.env.ANTHROPIC_INPUT_USD_PER_MTOK ?? "3"),
  outputUsdPerMillion: Number(process.env.ANTHROPIC_OUTPUT_USD_PER_MTOK ?? "15"),
  source: "Anthropic Sonnet 4.6 public list price, verified 2026-07-22",
};

export function calculateAnthropicListCost(inputTokens: number, outputTokens: number): number | null {
  const p = ANTHROPIC_PRICING;
  if (![p.inputUsdPerMillion, p.outputUsdPerMillion].every(Number.isFinite)) return null;
  return Number(((inputTokens * p.inputUsdPerMillion + outputTokens * p.outputUsdPerMillion) / 1_000_000).toFixed(8));
}

async function assertRunBudget(systemPrompt: string, userMessage: string, maxTokens: number): Promise<void> {
  const cap = Number(process.env.LEADLENS_LLM_BUDGET_USD ?? "");
  const baseline = Number(process.env.LEADLENS_LLM_COST_BASELINE_USD ?? "0");
  if (!Number.isFinite(cap) || cap <= 0) return;
  const { getUsage } = await import("@/lib/ops/usage-ledger");
  const observed = Math.max(0, (getUsage().anthropic?.calculated_cost_usd_today ?? 0) - baseline);
  // Conservative pre-call ceiling: input chars/4 plus the requested maximum
  // output. This can stop early, but cannot silently authorize extra spend.
  const estimatedInputTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  const projected = calculateAnthropicListCost(estimatedInputTokens, maxTokens) ?? 0;
  if (observed + projected > cap) {
    throw new Error(`[anthropic] RUN_BUDGET_GUARD: observed_list_cost=$${observed.toFixed(4)} projected_call_ceiling=$${projected.toFixed(4)} cap=$${cap.toFixed(4)}`);
  }
}

// Per-request timeout. Intelligence agents can use long prompts — 60s is safe.
const REQUEST_TIMEOUT_MS = 60_000;
// Max attempts for retryable failures (network glitches, 529 overload)
const MAX_RETRIES = 2;

// ─── Lazy singleton ──────────────────────────────────────────────────────────
// Do NOT instantiate at module level — this file is imported even in DEMO_MODE.
// The client is created on first actual call.

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "[anthropic] ANTHROPIC_API_KEY is not set. " +
        "Set DEMO_MODE=true to run without it, or add the key to .env.local."
    );
  }

  _client = new Anthropic({ apiKey: key });
  return _client;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls Claude and returns raw text.
 * Retries on transient failures. Throws on permanent errors (bad key, 4xx).
 */
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2000
): Promise<string> {
  await assertRunBudget(systemPrompt, userMessage, maxTokens);
  const client = getClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(
        client.messages.create({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
        REQUEST_TIMEOUT_MS
      );

      const block = result.content[0];
      if (block.type !== "text") {
        throw new Error("[anthropic] Unexpected content type: " + block.type);
      }

      try {
        const { recordProviderCall, recordLLMUsage } = await import("@/lib/ops/usage-ledger");
        const inputTokens = result.usage.input_tokens ?? 0;
        const outputTokens = result.usage.output_tokens ?? 0;
        recordProviderCall("anthropic", true, Date.now() - startedAt);
        recordLLMUsage({ provider: "anthropic", model: MODEL, inputTokens, outputTokens, calculatedCostUsd: calculateAnthropicListCost(inputTokens, outputTokens), pricingSource: ANTHROPIC_PRICING.source });
      } catch { /* ledger best-effort */ }
      return block.text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      try { const { recordProviderCall } = await import("@/lib/ops/usage-ledger"); recordProviderCall("anthropic", false, 0, msg); } catch { /* ledger best-effort */ }

      const isRetryable =
        msg.includes("timeout") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("529") ||
        msg.includes("rate_limit") ||
        msg.includes("overloaded");

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.warn(
          `[anthropic] attempt ${attempt}/${MAX_RETRIES} failed (${msg.slice(0, 80)}) — retrying in ${delay}ms`
        );
        await sleep(delay);
        continue;
      }

      // Log without exposing anything from the key or response body
      console.error(
        `[anthropic] callClaude failed after ${attempt} attempt(s): ${msg.slice(0, 120)}`
      );
      throw lastError;
    }
  }

  throw lastError ?? new Error("[anthropic] callClaude: unknown failure");
}

/**
 * Calls Claude and parses the response as JSON.
 * Strips markdown fences, extracts the JSON block, retries on bad JSON once.
 * Throws with a descriptive message if the JSON is unrecoverable.
 */
export async function callClaudeJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2000
): Promise<T> {
  const system = systemPrompt +
    "\n\nReturn ONLY valid JSON. No markdown, no explanation, no code fences.";
  const raw = await callClaude(system, userMessage, maxTokens);
  try {
    return parseClaudeJSON<T>(raw);
  } catch (firstErr) {
    // One retry with doubled budget — the dominant failure is max_tokens
    // truncation (unterminated JSON), especially for Spanish outputs whose
    // strings run longer. Bounded: single retry, capped at 8000 tokens.
    console.warn("[anthropic] JSON parse failed — retrying once with larger budget");
    const retryRaw = await callClaude(
      system + "\nKeep every string concise so the FULL JSON fits in the response.",
      userMessage,
      Math.min(maxTokens * 2, 8000)
    );
    try {
      return parseClaudeJSON<T>(retryRaw);
    } catch {
      throw firstErr;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseClaudeJSON<T>(raw: string): T {
  // 1. Strip markdown code fences
  let cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 2. Extract the outermost JSON object/array in case Claude prefixed text
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  let start = -1;

  if (objStart !== -1 && arrStart !== -1) start = Math.min(objStart, arrStart);
  else if (objStart !== -1) start = objStart;
  else if (arrStart !== -1) start = arrStart;

  if (start > 0) {
    // Find the matching closing bracket
    const openChar = cleaned[start];
    const closeChar = openChar === "{" ? "}" : "]";
    const end = cleaned.lastIndexOf(closeChar);
    if (end > start) cleaned = cleaned.slice(start, end + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (parseErr) {
    // Log only the first 400 chars — avoids dumping large PII-containing payloads
    console.error(
      "[anthropic] JSON parse failed. Cleaned response (first 400 chars):",
      cleaned.slice(0, 400)
    );
    throw new Error(
      "[anthropic] Claude returned invalid JSON: " +
        (parseErr instanceof Error ? parseErr.message : String(parseErr))
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`[anthropic] Request timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
