import assert from "node:assert/strict";
import { withVaultReuse } from "../../lib/lead-hunter/vault-identity-reuse";
import { createVaultReuseDeps, VAULT_REUSE_FETCH_LIMIT } from "../../lib/lead-hunter/vault-reuse-deps";
import { resolveVaultReuseConfig, makeVaultReuseGate } from "../../lib/lead-hunter/vault-reuse-config";
import { DEFAULT_DISCOVERY_BUDGET } from "../../lib/lead-hunter/candidate-universe";
import type { DiscoveryPlan, DiscoveryRunner, DiscoveryRunOutput, RawDiscoveredOrg } from "../../lib/lead-hunter/candidate-universe";

let p = 0; const t = (n: string, ok: boolean) => { assert.equal(ok, true, n); p++; console.log(`✅ ${n}`); };

const plan: DiscoveryPlan = {
  contextRef: { contextId: "ctx_wire", version: 1 },
  objectiveType: "sell", targetRelationship: "customer",
  organizationTypes: ["manufacturer"], industries: [], geographies: ["United States"],
  routes: [], exclusions: [], namedAccountSeeds: [], watchSignalFamilies: [],
  budget: DEFAULT_DISCOVERY_BUDGET, planGaps: [],
};
const thinBase: DiscoveryRunner = async (): Promise<DiscoveryRunOutput> =>
  ({ orgs: [{ name: "Rockwell", domain: "rockwellautomation.com", country: "United States", origin: "event_first", provider: "engine", route: "engine", confidence: "verified" } as RawDiscoveredOrg], providersAvailable: ["brave"], providersFailed: [], operatingMode: "live" });

// Fake Supabase client that records the exact column projection requested.
function fakeDb(rows: unknown[]) {
  const calls: { table: string; columns: string; limit: number }[] = [];
  return {
    calls,
    from(table: string) {
      return {
        select(columns: string) {
          return {
            order(_col: string, _opts: { ascending: boolean }) {
              return {
                async limit(n: number) { calls.push({ table, columns, limit: n }); return { data: rows, error: null }; },
              };
            },
          };
        },
      };
    },
  };
}

// Exactly the composition the two productive routes build.
const composeLikeRoute = (db: Parameters<typeof createVaultReuseDeps>[0], env: NodeJS.ProcessEnv) =>
  withVaultReuse(thinBase, createVaultReuseDeps(db), undefined, { gate: makeVaultReuseGate(resolveVaultReuseConfig(env)) });

async function main() {
  // ── DEFAULT production config (OFF) = pass-through, no Vault read ──
  const db = fakeDb([{ name: "Post Holdings", domain: "postholdings.com", country: "United States", region: "MO" }]);
  const offRunner = composeLikeRoute(db as never, {} as NodeJS.ProcessEnv);
  const offOut = await offRunner(plan);
  t("default (OFF) wiring is a pass-through: base universe unchanged", offOut.orgs.length === 1 && offOut.orgs[0].origin === "event_first");
  t("default (OFF) wiring never queries the Vault", db.calls.length === 0);

  // ── ELIGIBLE_FALLBACK + thin universe = Vault contributes, via the real deps ──
  const db2 = fakeDb([
    { name: "Post Holdings", domain: "PostHoldings.com", country: "United States", region: "MO" },
    { name: "SunOpta", domain: "sunopta.com", country: "United States", region: null },
  ]);
  const onRunner = composeLikeRoute(db2 as never, { VAULT_REUSE_MODE: "ELIGIBLE_FALLBACK" } as never);
  const onOut = await onRunner(plan);
  t("fallback wiring appends neutral Vault identities to a thin universe", onOut.orgs.filter((o) => o.origin === "vault_reuse").length === 2);
  t("production deps request ONLY the neutral columns from vault_companies",
    db2.calls.length === 1 && db2.calls[0].table === "vault_companies"
    && db2.calls[0].columns === "name, domain, country, region"
    && db2.calls[0].limit === VAULT_REUSE_FETCH_LIMIT);
  t("deps normalize identity (domain lowercased) with no extra fields",
    onOut.orgs.some((o) => o.domain === "postholdings.com" && o.provider === "vault"));

  // ── deps fail-closed on a null client and on a query error ──
  const nullDeps = createVaultReuseDeps(null);
  t("null db → deps return [] (fail-closed)", (await nullDeps.fetchNeutralIdentities(["United States"])).length === 0);
  const errDb = { from() { return { select() { return { order() { return { async limit() { return { data: null, error: { message: "boom" } }; } }; } }; } }; } };
  const errDeps = createVaultReuseDeps(errDb as never);
  t("query error → deps return [] (fail-closed)", (await errDeps.fetchNeutralIdentities(["United States"])).length === 0);

  console.log(`\n${p} passed, 0 failed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
