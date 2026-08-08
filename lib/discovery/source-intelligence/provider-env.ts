// Discovery Engine V2.4.1 — safe CLI env loading + provider diagnostics.
// ROOT CAUSE of the earlier "provider keys unavailable" mismatch: Next.js auto-
// loads `.env.local` for the app runtime, but a standalone `tsx` CLI script does
// NOT — it must call `loadEnvConfig(process.cwd())` (the pattern already used by
// scripts/sources/*). Benchmark runners had not, so process.env.* was empty.
//
// This module never prints, duplicates, copies, or returns secret VALUES — only
// booleans/status. It does not commit credentials.
import { loadEnvConfig } from "@next/env";

let loaded = false;
/** Idempotently load project .env(.local) for CLI tooling (safe; no secrets exposed). */
export function loadCliEnv(projectRoot: string = process.cwd()): void {
  if (loaded) return;
  loadEnvConfig(projectRoot);
  loaded = true;
}

export const PROVIDER_KEYS = [
  { id: "tavily", key: "TAVILY_API_KEY", role: "evidence discovery" },
  { id: "brave", key: "BRAVE_SEARCH_API_KEY", role: "general search / freshness" },
  { id: "firecrawl", key: "FIRECRAWL_API_KEY", role: "page / structured extraction" },
  { id: "serper", key: "SERPER_API_KEY", role: "general search / domain resolution" },
  { id: "exa", key: "EXA_API_KEY", role: "semantic company discovery escalation" },
  { id: "sam_gov", key: "DATA_GOV_API_KEY", role: "USA government entity / procurement source" },
] as const;

export type ProviderExecState =
  | "configured_operational" | "configured_quota_exhausted" | "configured_auth_failed"
  | "configured_runtime_unavailable" | "not_configured" | "diagnostic_not_run";

export interface ProviderEnvStatus {
  provider: string; role: string; env_local_exists: boolean; key_defined_in_env_file: boolean;
  visible_to_runner_before_load: boolean; visible_to_runner_after_load: boolean;
  exec_state: ProviderExecState; call_tested: boolean; note: string;
}

/** Boolean-only diagnostic. Reports whether the CLI runner can SEE each key after
 *  loadCliEnv — the actual root-cause signal. Does NOT make billable calls (to
 *  preserve budget + avoid unauthorized spend); call_tested stays false. */
export function providerEnvDiagnostic(projectRoot: string = process.cwd()): { env_local_exists: boolean; providers: ProviderEnvStatus[] } {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const envLocalPath = path.join(projectRoot, ".env.local");
  const env_local_exists = fs.existsSync(envLocalPath);
  const fileText = env_local_exists ? fs.readFileSync(envLocalPath, "utf8") : "";
  const before: Record<string, boolean> = {};
  for (const p of PROVIDER_KEYS) before[p.key] = Boolean(process.env[p.key]);
  loadCliEnv(projectRoot);
  const providers: ProviderEnvStatus[] = PROVIDER_KEYS.map((p) => {
    const key_defined_in_env_file = new RegExp(`^\\s*${p.key}\\s*=`, "m").test(fileText);
    const visible_to_runner_after_load = Boolean(process.env[p.key]);
    const exec_state: ProviderExecState = visible_to_runner_after_load ? "diagnostic_not_run" : key_defined_in_env_file ? "configured_runtime_unavailable" : "not_configured";
    return {
      provider: p.id, role: p.role, env_local_exists, key_defined_in_env_file,
      visible_to_runner_before_load: before[p.key], visible_to_runner_after_load, exec_state, call_tested: false,
      note: visible_to_runner_after_load
        ? "Key now visible to the CLI runner after loadCliEnv (root cause fixed). Callable/quota not tested this sprint (no billable calls made)."
        : key_defined_in_env_file ? "Defined in .env.local but not visible even after load — check file format." : "Not configured.",
    };
  });
  return { env_local_exists, providers };
}

// Provider-call audit (§9): every real provider call must be logged with booleans/
// status only — never prompts or secrets.
export interface ProviderCallLog { provider: string; purpose: string; benchmark: string; timestamp: string; success: boolean; failure_reason: string | null; estimated_cost: number | null; }
export function newCallBudget(max = 40) {
  let used = 0; const log: ProviderCallLog[] = [];
  return {
    remaining: () => max - used,
    record(entry: Omit<ProviderCallLog, "timestamp">): boolean {
      if (used >= max) return false; used++; log.push({ ...entry, timestamp: new Date().toISOString() }); return true;
    },
    log: () => log, used: () => used, max,
  };
}
export const PROVIDER_ENV_VERSION = "discovery-v2-4-1-provider-env-v1";
