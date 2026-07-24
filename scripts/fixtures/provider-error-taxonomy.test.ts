// Unit tests: classifyProviderError (shared provider status taxonomy).
// Run: npm run test:provider-error-taxonomy
import { classifyProviderError } from "@/lib/ops/provider-health";
let p = 0, f = 0; const t = (n: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${n}`); ok ? p++ : f++; };
t("Serper 'Not enough credits' → exhausted", classifyProviderError("Not enough credits") === "exhausted");
t("Tavily 432/quota → exhausted", classifyProviderError("HTTP 432 plan limit") === "exhausted");
t("402 payment required → exhausted", classifyProviderError("402 payment required") === "exhausted");
t("usage limit → exhausted", classifyProviderError("You have reached your usage limit") === "exhausted");
t("401 unauthorized → invalid", classifyProviderError("401 Unauthorized") === "invalid");
t("invalid api key → invalid", classifyProviderError("invalid api key") === "invalid");
t("429 → rate_limited", classifyProviderError("429 Too Many Requests") === "rate_limited");
t("timeout → unknown (request_failed)", classifyProviderError("network timeout") === "unknown");
t("null → unknown", classifyProviderError(null) === "unknown");
console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
