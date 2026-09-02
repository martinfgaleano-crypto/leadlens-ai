// Monitor Production Autonomy gate — scheduler route authentication + kill-switch behavior.
// Deterministic, no provider cost: the disabled/unauthorized paths return BEFORE any DB or
// research. Proves the cron endpoint is not customer-callable and no-ops safely when disabled,
// with no secret leakage in the response.

import { NextRequest } from "next/server";
import { schedulerEnabled } from "../../lib/monitor/monitor-config";
import { POST } from "../../app/api/internal/monitor-scheduler/route";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const CRON = "test-cron-secret-xyz";
process.env.CRON_SECRET = CRON;
delete process.env.INTERNAL_RUN_SECRET;
delete process.env.ADMIN_SECRET_TOKEN;

const req = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/internal/monitor-scheduler", { method: "POST", headers });

async function run() {
  // ── Kill switch (pure) ──
  process.env.MONITOR_SCHEDULER_ENABLED = "true";
  t("schedulerEnabled true only for exact 'true'", schedulerEnabled() === true);
  process.env.MONITOR_SCHEDULER_ENABLED = "1";
  t("schedulerEnabled false for '1'", schedulerEnabled() === false);
  delete process.env.MONITOR_SCHEDULER_ENABLED;
  t("schedulerEnabled false when unset", schedulerEnabled() === false);

  // ── Auth: rejected before any work ──
  const noAuth = await POST(req());
  t("missing credential → 401", noAuth.status === 401);
  const badAuth = await POST(req({ authorization: "Bearer wrong-secret" }));
  t("invalid credential → 401", badAuth.status === 401);

  // ── Valid credential + disabled → safe no-op 200 (returns before DB/research) ──
  const disabled = await POST(req({ authorization: `Bearer ${CRON}` }));
  const body = await disabled.json() as any;
  t("valid credential + disabled → 200 disabled no-op", disabled.status === 200 && body.status === "disabled");
  t("disabled response leaks no secret value", !new RegExp(CRON).test(JSON.stringify(body)) && !/service_role|password|token/i.test(JSON.stringify(body)));

  // ── 401 responses leak no secret ──
  t("401 responses carry no secret", !new RegExp(CRON).test(JSON.stringify(await badAuth.json())));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((e) => { console.error(e); process.exit(1); });
