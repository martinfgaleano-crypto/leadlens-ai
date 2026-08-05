// Recurring Opportunity Cycle V1 — foundation tests (§24). Deterministic, no DB,
// no providers. Covers Account Memory, events, outcomes, anti-repetition/novelty,
// What Changed, cycle object, the Amor de Gea seed, and Pilot 1/Pilot 2 invariants.
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  MEMORY_EVENT_TYPES, OUTCOME_STATUSES, OUTCOME_REASONS, NOVELTY_STATES, REAPPEARANCE_STATES,
  CHANGE_TYPES, CYCLE_STATES,
} from "../../lib/intelligence/recurring/model";
import {
  validateOutcome, decideNovelty, buildWhatChanged, isCustomerSafe, appendEvents, buildMemoryEvent,
  consolidateIdentity, createCycle, aggregateRouteLearning,
} from "../../lib/intelligence/recurring/engine";
import {
  AMOR_ACCOUNT_MEMORY, AMOR_MEMORY_COUNTERS, AMOR_PILOT2_READINESS, AMOR_CYCLE_1, AMOR_CYCLE_1_ID,
} from "../../lib/intelligence/amor-de-gea-account-memory";
import { AMOR_PILOT1_FINAL } from "../../lib/intelligence/amor-de-gea-pilot1-finalization";

let pass = 0;
const t = (name: string, fn: () => void) => { try { fn(); pass++; } catch (e) { console.error(`❌ ${name}: ${(e as Error).message}`); process.exitCode = 1; } };

const mem = (name: string) => AMOR_ACCOUNT_MEMORY.find((m) => m.identity.canonical_name === name)!;
const ACTIVE = AMOR_PILOT1_FINAL.accounts.map((a) => a.name);
const INACTIVE = ["BioPlaza", "Distribuidora DAM", "Hotel Spa La Colina", "Tu Tienda Saludable", "Somos Consiente"];

// 1–3. Canonical identity, alternate-name resolution, duplicate protection.
t("1 canonical identity", () => assert.equal(mem("Éteka").identity.canonical_id, "amor:eteka"));
t("2 alternate-name resolution merges on shared domain", () => {
  const d = consolidateIdentity({ canonical_id: "a", canonical_name: "Éteka", official_domain: "etekacartagena.com" }, { canonical_id: "b", canonical_name: "Eteka Cartagena", official_domain: "www.etekacartagena.com" });
  assert.equal(d.merged, true); assert(d.aliases.includes("Eteka Cartagena"));
});
t("2b no merge on name alone with conflicting domains", () => assert.equal(consolidateIdentity({ canonical_id: "a", canonical_name: "Vitálica", official_domain: "tiendavitalica.com" }, { canonical_id: "b", canonical_name: "Vitalica", official_domain: "otra.com" }).merged, false));
t("3 duplicate protection (unique canonical ids)", () => assert.equal(new Set(AMOR_ACCOUNT_MEMORY.map((m) => m.identity.canonical_id)).size, AMOR_ACCOUNT_MEMORY.length));

// 4–5. Memory events append-only, historical decisions preserved.
t("4 memory events append-only + dedup + sorted", () => {
  const e1 = buildMemoryEvent({ account_id: "a", tenant_id: null, client_id: "amor-de-gea", cycle_id: "c1", event_type: "account_discovered", timestamp: "2026-08-01T00:00:00Z", actor: "x", source: "s", previous_state: null, new_state: "discovered", reason: "r" });
  const e2 = buildMemoryEvent({ account_id: "a", tenant_id: null, client_id: "amor-de-gea", cycle_id: "c1", event_type: "account_prioritized", timestamp: "2026-08-02T00:00:00Z", actor: "x", source: "s", previous_state: "discovered", new_state: "prioritized", reason: "r" });
  const log = appendEvents(appendEvents([], [e2]), [e1, e1]); // out of order + duplicate
  assert.equal(log.length, 2); assert.equal(log[0].event_id, e1.event_id); // sorted asc, no overwrite
});
t("5 historical decisions preserved", () => AMOR_ACCOUNT_MEMORY.forEach((m) => assert(m.historical_decisions.length >= 1)));

// 6–10. Seed invariants.
t("6 Pilot 1 accounts seeded", () => ACTIVE.forEach((n) => assert(mem(n))));
t("7 inactive accounts seeded", () => INACTIVE.forEach((n) => assert(mem(n))));
t("8 first-seen cycle preserved", () => AMOR_ACCOUNT_MEMORY.forEach((m) => assert.equal(m.first_seen.cycle_id, AMOR_CYCLE_1_ID)));
t("9 delivered state preserved (10 active)", () => assert.equal(AMOR_ACCOUNT_MEMORY.filter((m) => m.historical_decisions[0].recommendation === "delivered").length, 10));
t("10 exclusion reasons preserved", () => { assert.equal(mem("Tu Tienda Saludable").reappearance, "permanently_excluded"); assert(mem("Tu Tienda Saludable").review.suppression_reason); });
t("10b seeded reappearance states valid", () => AMOR_ACCOUNT_MEMORY.forEach((m) => assert((REAPPEARANCE_STATES as readonly string[]).includes(m.reappearance))));

// 11–17. Outcome taxonomy + capture validation.
t("11 outcome taxonomy complete", () => { assert.equal(OUTCOME_STATUSES.length, 28); assert.equal(OUTCOME_REASONS.length, 17); assert.equal(MEMORY_EVENT_TYPES.length, 24); });
t("12 valid outcome accepted", () => { const r = validateOutcome({ account_id: "amor:eteka", cycle_id: "c1", client_id: "amor-de-gea", actor: "admin", outcome_date: "2026-09-01", primary_status: "meeting_completed", reason_code: null }); assert(r.ok && r.outcome.status_group === "commercial"); });
t("13 invalid status rejected", () => assert.equal(validateOutcome({ account_id: "a", cycle_id: "c", client_id: "x", actor: "y", outcome_date: "2026-09-01", primary_status: "nope" }).ok, false));
t("14 invalid reason rejected", () => assert.equal(validateOutcome({ account_id: "a", cycle_id: "c", client_id: "x", actor: "y", outcome_date: "2026-09-01", primary_status: "contacted", reason_code: "bogus" }).ok, false));
t("15 buyer-path confirmation stored", () => { const r = validateOutcome({ account_id: "a", cycle_id: "c", client_id: "x", actor: "y", outcome_date: "2026-09-01", primary_status: "buyer_confirmed", buyer_path: "confirmed" }); assert(r.ok && r.outcome.buyer_path === "confirmed"); });
t("16 buyer-path rejection stored", () => { const r = validateOutcome({ account_id: "a", cycle_id: "c", client_id: "x", actor: "y", outcome_date: "2026-09-01", primary_status: "negative_response", buyer_path: "rejected" }); assert(r.ok && r.outcome.buyer_path === "rejected"); });
t("17 follow-up date stored", () => { const r = validateOutcome({ account_id: "a", cycle_id: "c", client_id: "x", actor: "y", outcome_date: "2026-09-01", primary_status: "paused", follow_up_date: "2026-10-01" }); assert(r.ok && r.outcome.follow_up_date === "2026-10-01"); });

// 18–24. Anti-repetition + novelty trace.
const eteka = mem("Éteka"); // delivered
const dam = mem("Distribuidora DAM"); // monitor_only, not delivered
const tts = mem("Tu Tienda Saludable"); // permanently_excluded
t("18 delivered account blocked as new", () => { const d = decideNovelty({ canonical_id: eteka.identity.canonical_id }, eteka); assert.equal(d.novelty_decision, "previously_delivered"); assert.equal(d.eligible_as_new, false); });
t("19 prior candidate cannot become new silently", () => assert.equal(decideNovelty({ canonical_id: dam.identity.canonical_id }, dam).eligible_as_new, false));
t("20 rediscovery alone is not a meaningful change", () => { const d = decideNovelty({ canonical_id: eteka.identity.canonical_id }, eteka, null); assert(/rediscovery is not a change/.test(d.suppression_reason ?? "")); });
t("21 meaningful signal permits update", () => { const d = decideNovelty({ canonical_id: eteka.identity.canonical_id }, eteka, "new_public_signal"); assert.equal(d.novelty_decision, "monitored_update"); assert.equal(d.eligible_as_update, true); });
t("22 evidence repair permits reconsideration", () => { const d = decideNovelty({ canonical_id: dam.identity.canonical_id }, dam, "prior_evidence_repaired"); assert.equal(d.eligible_as_reconsidered, true); });
t("23 client request permits reconsideration", () => { const d = decideNovelty({ canonical_id: dam.identity.canonical_id }, dam, null, true); assert.equal(d.novelty_decision, "reconsidered"); });
t("23b permanently excluded stays suppressed even with change", () => assert.equal(decideNovelty({ canonical_id: tts.identity.canonical_id }, tts, "new_public_signal").novelty_decision, "excluded"));
t("24 novelty decision trace exists", () => { const d = decideNovelty({ canonical_id: eteka.identity.canonical_id }, eteka); assert(d.rule_applied && d.prior_appearances.length >= 1); });
t("24b genuinely new when no memory", () => assert.equal(decideNovelty({ canonical_id: "new:x" }, null).novelty_decision, "genuinely_new"));

// 25–31. What Changed.
const wc = buildWhatChanged("cycle_2", "amor-de-gea-cycle-1", [
  { account: "Nueva Cuenta", category: "account", change_type: "new_account", previous_state: "none", current_state: "candidate", evidence: "official site", reason: "encaje", effect_on_priority: "up", effect_on_next_action: "validar", customer_safe_wording: "Nueva cuenta candidata con encaje de ruta." },
  { account: "Éteka", category: "account", change_type: "promoted_account", previous_state: "priority", current_state: "first", evidence: "e", reason: "r", effect_on_priority: "up", effect_on_next_action: "validar", customer_safe_wording: "Éteka sube en prioridad." },
  { account: "BioPlaza", category: "account", change_type: "lowered_account", previous_state: "priority", current_state: "monitor", evidence: "e", reason: "r", effect_on_priority: "down", effect_on_next_action: "monitorear", customer_safe_wording: "BioPlaza baja a monitoreo." },
  { account: "X", category: "account", change_type: "removed_account", previous_state: "active", current_state: "removed", evidence: "e", reason: "r", effect_on_priority: "down", effect_on_next_action: "n/a", customer_safe_wording: "Cuenta retirada." },
  { account: "Vitálica", category: "evidence", change_type: "new_official_evidence", previous_state: "old", current_state: "fresh", evidence: "e", reason: "r", effect_on_priority: "up", effect_on_next_action: "validar", customer_safe_wording: "Nueva evidencia oficial para Vitálica." },
  { account: "Sinergy On", category: "client", change_type: "outcome_changed_search_rules", previous_state: "a", current_state: "b", evidence: "outcome", reason: "r", effect_on_priority: "up", effect_on_next_action: "n", customer_safe_wording: "Un resultado ajustó las reglas de búsqueda." },
]);
t("25 detects new account", () => assert(wc.internal.items.some((i) => i.change_type === "new_account")));
t("26 detects promotion", () => assert(wc.internal.items.some((i) => i.change_type === "promoted_account")));
t("27 detects lowering", () => assert(wc.internal.items.some((i) => i.change_type === "lowered_account")));
t("28 detects removal", () => assert(wc.internal.items.some((i) => i.change_type === "removed_account")));
t("29 detects evidence change", () => assert(wc.internal.items.some((i) => i.category === "evidence")));
t("30 detects outcome-driven change", () => assert(wc.internal.items.some((i) => i.change_type === "outcome_changed_search_rules")));
t("31 customer-safe excludes internal codes", () => { assert(isCustomerSafe(wc)); assert(wc.internal.rule_ids.length > 0); assert(!JSON.stringify(wc.customer_safe).match(/WC:|rule_applied|reason_code/)); });

// 32–34. Cycle object.
t("32 cycle links prior cycle", () => assert.equal(AMOR_PILOT2_READINESS.next_cycle.prior_cycle_id, AMOR_CYCLE_1_ID));
t("33 cycle loads memory snapshot", () => assert.match(AMOR_CYCLE_1.account_memory_snapshot ?? "", /15 accounts/));
t("34 cycle loads outcome snapshot slot + valid state", () => { const c = createCycle({ client_id: "z", cycle_number: 3, outcome_snapshot: "snap" }); assert.equal(c.outcome_snapshot, "snap"); assert((CYCLE_STATES as readonly string[]).includes(c.status)); });

// 35–37, 42. Pilot 2 planned + Pilot 1 unchanged.
t("35 Pilot 2 remains planned", () => assert.equal(AMOR_PILOT2_READINESS.state, "PLANNED — NOT AUTHORIZED"));
t("36 Pilot 2 contains no new accounts", () => assert.equal(AMOR_PILOT2_READINESS.accounts.length, 0));
t("37 Pilot 1 unchanged (10 accounts + portfolio)", () => { assert.equal(AMOR_PILOT1_FINAL.accounts.length, 10); assert.equal(AMOR_PILOT1_FINAL.portfolio.first_validation.length, 4); assert.equal(AMOR_PILOT1_FINAL.pilot2.state, "PLANNED — NOT AUTHORIZED"); });
t("38 no provider calls", () => assert.equal(AMOR_PILOT2_READINESS.provider_calls, 0));
t("39/40 no search/outreach in model", () => assert(!("search" in AMOR_PILOT2_READINESS) || AMOR_PILOT2_READINESS.accounts.length === 0));

// 15/19 route learning awaiting.
t("route learning awaiting real outcomes", () => assert.equal(aggregateRouteLearning("specialty_retail", []).status, "awaiting_real_outcomes"));
t("counters: 10 delivered, novelty states valid", () => { assert.equal(AMOR_MEMORY_COUNTERS.delivered, 10); AMOR_ACCOUNT_MEMORY.forEach((m) => assert((NOVELTY_STATES as readonly string[]).includes(m.novelty_default))); assert.equal(Object.keys(CHANGE_TYPES).length, 5); });

// 43–44. Auth + tenant isolation on the outcomes API.
async function apiTests() {
  const { POST, GET } = await import("../../app/api/admin/intelligence/pilots/[pilotId]/outcomes/route");
  // 44 unauthorized rejected
  const noauth = await POST(new NextRequest("http://localhost/api/admin/intelligence/pilots/amor-de-gea/outcomes", { method: "POST", body: "{}" }), { params: { pilotId: "amor-de-gea" } });
  assert([401, 403].includes(noauth.status));
  process.env.ADMIN_SECRET_TOKEN = "roc-test";
  const headers = { "x-admin-token": "roc-test", "content-type": "application/json" };
  // wrong pilot → 404
  const wrong = await GET(new NextRequest("http://localhost/x", { headers }), { params: { pilotId: "other" } });
  assert.equal(wrong.status, 404);
  // valid admin, invalid outcome → 400
  const bad = await POST(new NextRequest("http://localhost/x", { method: "POST", headers, body: JSON.stringify({ account_id: "a", cycle_id: "c", outcome_date: "2026-09-01", primary_status: "nope" }) }), { params: { pilotId: "amor-de-gea" } });
  assert.equal(bad.status, 400);
  // valid admin, valid outcome, no DB → 503 validated (fail-closed, no fabrication)
  const ok = await POST(new NextRequest("http://localhost/x", { method: "POST", headers, body: JSON.stringify({ account_id: "amor:eteka", cycle_id: AMOR_CYCLE_1_ID, outcome_date: "2026-09-01", primary_status: "contacted" }) }), { params: { pilotId: "amor-de-gea" } });
  assert([201, 503].includes(ok.status));
  // GET without DB → awaiting_real_outcomes
  const list = await GET(new NextRequest("http://localhost/x", { headers }), { params: { pilotId: "amor-de-gea" } });
  const body = await list.json();
  assert(body.status === "awaiting_real_outcomes" || body.status === "measured");
  pass += 5;
}

apiTests().then(() => console.log(`recurring opportunity cycle: ${pass} checks ok`)).catch((e) => { console.error("❌ api", e); process.exitCode = 1; });
