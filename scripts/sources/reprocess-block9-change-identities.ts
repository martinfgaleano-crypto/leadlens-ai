import { loadEnvConfig } from "@next/env";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { compareSignalObservations, type SignalObservation } from "@/lib/intelligence/signal-temporal";

loadEnvConfig(process.cwd());

async function main() {
  const dir = join(process.cwd(), "ml/data/signal-monitoring-operations");
  const file = readdirSync(dir).filter((x) => /^amor-de-gea-block9-.*\.json$/.test(x)).sort().at(-1);
  if (!file) throw new Error("Block 9 operating artifact unavailable.");
  const path = join(dir, file);
  const artifact = JSON.parse(readFileSync(path, "utf8")) as {
    generated_at: string; run: { run_id: string }; accounts: Array<Record<string, unknown>>;
  };
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const errors: string[] = [];
  for (const account of artifact.accounts) {
    const domain = String(account.domain);
    const current = ((account.accepted_signals as SignalObservation[] | undefined) ?? [])[0] ?? null;
    const corrected = compareSignalObservations({
      account_id: domain, monitoring_run_id: artifact.run.run_id, prior: null, current,
      baseline_available: true, detected_at: artifact.generated_at,
    });
    account.what_changed = corrected;
    const result = await db.from("intelligence_signal_changes").insert({
      id: corrected.change_id, tenant_user_id: null, client_id: "amor-de-gea", account_id: domain,
      signal_key: corrected.signal_key, monitoring_run_id: artifact.run.run_id, change_state: corrected.state,
      change_json: corrected, qualification_transition_json: account.qualification_transition,
      methodology_version: corrected.methodology_version,
    });
    if (result.error && result.error.code !== "23505") errors.push(`${domain}:${result.error.message}`);
  }
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({ artifact: path, accounts_reprocessed: artifact.accounts.length, errors, provider_calls: 0 }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
