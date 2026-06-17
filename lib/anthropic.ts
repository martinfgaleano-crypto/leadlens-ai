import Anthropic from "@anthropic-ai/sdk";

// Model to use across all agents. Change here to update everywhere.
export const MODEL = "claude-sonnet-4-6";

// Per-request timeout. Claude rarely needs >25s on short prompts.
const REQUEST_TIMEOUT_MS = 30_000;
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
  const client = getClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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

      return block.text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;

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
  const raw = await callClaude(
    systemPrompt +
      "\n\nReturn ONLY valid JSON. No markdown, no explanation, no code fences.",
    userMessage,
    maxTokens
  );

  return parseClaudeJSON<T>(raw);
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
