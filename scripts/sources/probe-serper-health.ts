import { loadEnvConfig } from "@next/env";
import { serperProvider } from "@/lib/sources/access/providers";
import { classifyProviderHealth } from "@/lib/intelligence/colombian-entity-resolution";

loadEnvConfig(process.cwd());

async function main() {
  const configured = Boolean(process.env.SERPER_API_KEY);
  const response = await serperProvider.search({
    query: "BioPlaza Colombia",
    language: "es",
    region: "co",
    max_results: 1,
    query_type: "company_specific",
  });
  const status = Number(response.error?.match(/HTTP (\d{3})/)?.[1] ?? 0) || null;
  const health = classifyProviderHealth({
    provider: "serper",
    configured,
    status,
    error: response.error,
    successes: response.ok ? 1 : 0,
    attempts: configured ? 1 : 0,
    probed_at: new Date().toISOString(),
    supported_tasks: ["identity_discovery", "event_discovery", "negative_event"],
  });
  // This output is deliberately sanitized: adapter errors never contain keys
  // and raw provider payloads are not persisted.
  console.log(JSON.stringify({
    request: { endpoint: "https://google.serper.dev/search", method: "POST", headers: ["X-API-KEY", "content-type"], body_fields: ["q", "num", "hl", "gl"] },
    response: { ok: response.ok, status, safe_error: response.error },
    health,
  }, null, 2));
  if (!response.ok) process.exitCode = 2;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "probe_failed"); process.exit(1); });
