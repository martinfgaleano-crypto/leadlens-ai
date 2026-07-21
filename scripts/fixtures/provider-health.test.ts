// Unit tests: provider-health-v1 (alerts) + usage-ledger.
// Run: npm run test:provider-health

import { deriveAlerts, type ProviderStatus } from "@/lib/ops/provider-health";
import { recordProviderCall, getUsage } from "@/lib/ops/usage-ledger";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

const base = (over: Partial<ProviderStatus>): ProviderStatus => ({
  id: "x", name: "X", role: "r", configured: true, state: "ok", state_kind: "confirmed_by_provider",
  detail: null, latency_ms: 100, credits: { value: null, kind: "unavailable" }, usage: null,
  fallback: "f", impact: "i", probed_at: new Date().toISOString(), ...over,
});

// ── deriveAlerts ──
t("exhausted → alerta roja con fallback", deriveAlerts([base({ id: "anthropic", name: "Anthropic", state: "exhausted", detail: "reset 2026-08-01" })]).some((a) => a.level === "red" && /Agotado/.test(a.message) && /Fallback/.test(a.message)));
t("invalid → alerta roja", deriveAlerts([base({ id: "serper", name: "Serper", state: "invalid" })]).some((a) => a.level === "red"));
t("rate_limited → amarilla", deriveAlerts([base({ id: "tavily", name: "Tavily", state: "rate_limited" })]).some((a) => a.level === "yellow"));
t("ok → sin alertas", deriveAlerts([base({ id: "serper", name: "Serper", state: "ok" })]).length === 0);
t("lemonsqueezy missing NO alerta (inactivo por diseño)", deriveAlerts([base({ id: "lemonsqueezy", name: "LS", state: "missing" })]).length === 0);
t("supabase caído → crítica sin fallback", deriveAlerts([base({ id: "supabase", name: "Supabase", state: "unknown" })]).some((a) => a.level === "red" && /SIN fallback/.test(a.message)));
t("errores repetidos hoy → amarilla", deriveAlerts([base({ id: "serper", name: "Serper", state: "ok", usage: { calls_today: 10, calls_month: 10, errors_today: 6, last_success: null, last_failure: null, last_error: null, latency_avg_ms: 0, latency_n: 0, day: "", month: "" } as never })]).some((a) => /errores hoy/.test(a.message)));

// ── usage-ledger ──
recordProviderCall("__test__", true, 120);
recordProviderCall("__test__", false, 300, "boom");
const u = getUsage()["__test__"];
t("ledger cuenta llamadas", !!u && u.calls_today >= 2);
t("ledger cuenta errores y guarda último error", !!u && u.errors_today >= 1 && u.last_error === "boom");
t("ledger promedia latencia", !!u && u.latency_avg_ms > 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
