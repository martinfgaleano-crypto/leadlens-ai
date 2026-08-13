#!/usr/bin/env node
// Bounded production QA for migrations 049-051 and authenticated customer APIs.
// Prints booleans/counts only and deletes disposable users in finally.
import { randomBytes } from "node:crypto";
import { loadEnv } from "../lib/load-env.mjs";
import { createClient } from "@supabase/supabase-js";

const env = loadEnv();
const base = process.env.LEADLENS_QA_BASE_URL || "https://leadlensintel.com";
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("required Supabase environment is unavailable");
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const marker = randomBytes(8).toString("hex");
const password = `${randomBytes(24).toString("base64url")}Aa1!`;
const emails = [`qa-journey-a-${marker}@leadlensintel.com`, `qa-journey-b-${marker}@leadlensintel.com`];
const users = [];
const result = {
  migration_049_shape: false, migration_050_shape: false, migration_051_shape: false,
  user_a_created: false, user_b_created: false, profile_bootstrap_verified: false, intent_created: false, intent_owner_correct: false,
  onboarding_created: false, onboarding_owner_correct: false, intent_linked: false,
  multi_country_persisted: false, intent_completed: false, retry_idempotent: false,
  lifecycle_intent_recorded: false, lifecycle_onboarding_recorded: false, lifecycle_payload_private: false,
  invalid_onboarding_rejected: false, cross_user_onboarding_denied: false,
  direct_onboarding_insert_denied: false, cleanup: false,
};

async function cleanupUsers(ids) {
  if (!ids.length) return;
  await admin.from("customer_lifecycle_events").delete().in("user_id", ids);
  await admin.from("onboarding_requests").delete().in("user_id", ids);
  await admin.from("commercial_intents").delete().in("user_id", ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => null);
}

if (process.argv.includes("--cleanup-only")) {
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const staleIds = (existing?.users ?? []).filter(user =>
    user.email?.startsWith("qa-journey-") && user.user_metadata?.qa_disposable === true
  ).map(user => user.id);
  await cleanupUsers(staleIds);
  console.log(`qa_users_removed=${staleIds.length}`);
  process.exit(0);
}

try {
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const staleIds = (existing?.users ?? []).filter(user =>
    user.email?.startsWith("qa-journey-") && user.user_metadata?.qa_disposable === true
  ).map(user => user.id);
  await cleanupUsers(staleIds);

  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { qa_disposable: true, qa_marker: marker } });
    if (error || !data.user) throw new Error("QA user creation failed");
    users.push(data.user.id);
  }
  result.user_a_created = users.length >= 1;
  result.user_b_created = users.length >= 2;

  const clients = [anon(), anon()];
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const { data, error } = await clients[i].auth.signInWithPassword({ email: emails[i], password });
    if (error || !data.session) throw new Error("QA sign-in failed");
    sessions.push(data.session);
  }
  const headers = { "content-type": "application/json", authorization: `Bearer ${sessions[0].access_token}` };

  const intentResponse = await fetch(`${base}/api/commercial-intents`, {
    method: "POST", headers,
    body: JSON.stringify({ product_code: "intelligence_launch_v0", source_cta: "pricing_intelligence", locale: "es", return_to: "/onboarding" }),
  });
  const intentBody = await intentResponse.json().catch(() => null);
  const intentId = intentBody?.intent?.id ?? null;
  result.intent_created = intentResponse.status === 201 && Boolean(intentId);
  if (!intentId) throw new Error(`intent API failed with HTTP ${intentResponse.status}`);

  const { data: intentRows } = await admin.from("commercial_intents")
    .select("id,user_id,product_code,catalog_version,source_cta,locale,return_to,status,onboarding_id")
    .eq("id", intentId);
  const intent = intentRows?.[0];
  result.migration_049_shape = Boolean(intent && Object.hasOwn(intent, "catalog_version") && Object.hasOwn(intent, "onboarding_id"));
  result.intent_owner_correct = intent?.user_id === users[0];

  const onboardingPayload = {
    commercial_intent_id: intentId,
    company_name: "LeadLens QA Synthetic Business",
    offering: "Synthetic account opportunity intelligence validation service",
    target_customer: "B2B commercial teams validating account intelligence",
    target_countries: ["colombia", "United States", "Colombia"],
    commercial_objective: "Validate secure multi-country onboarding persistence",
    delivery_email: emails[0], locale: "es",
  };
  const invalidResponse = await fetch(`${base}/api/customer/onboarding`, {
    method: "POST", headers,
    body: JSON.stringify({ ...onboardingPayload, company_name: "", target_countries: [] }),
  });
  result.invalid_onboarding_rejected = invalidResponse.status === 400;

  const onboardingResponse = await fetch(`${base}/api/customer/onboarding`, {
    method: "POST", headers, body: JSON.stringify(onboardingPayload),
  });
  const onboardingBody = await onboardingResponse.json().catch(() => null);
  const onboardingId = onboardingBody?.onboarding?.id ?? null;
  result.onboarding_created = onboardingResponse.status === 201 && Boolean(onboardingId);
  if (!onboardingId) {
    const { error: shapeError } = await admin.from("onboarding_requests")
      .select("id,user_id,commercial_intent_id,product_code,target_countries,commercial_objective,locale,status")
      .limit(1);
    const { data: diagnosticRow, error: insertError } = await admin.from("onboarding_requests").insert({
      user_id: users[0], full_name: emails[0], email: emails[0], company_name: onboardingPayload.company_name,
      what_you_sell: onboardingPayload.offering, ideal_customer: onboardingPayload.target_customer,
      target_countries: ["Colombia", "United States"], commercial_objective: onboardingPayload.commercial_objective,
      delivery_email: emails[0], country: "Colombia", target_industries: [], target_job_titles: [],
      plan: "pro", product_code: "intelligence_launch_v0", locale: "es",
      commercial_intent_id: intentId, status: "pending",
    }).select("id").single();
    if (diagnosticRow?.id) await admin.from("onboarding_requests").delete().eq("id", diagnosticRow.id);
    const category = shapeError?.code === "42703" || shapeError?.code === "PGRST204"
      ? "migration_shape_mismatch"
      : shapeError ? `database_${shapeError.code ?? "error"}`
      : insertError ? `insert_${insertError.code ?? "error"}` : "api_post_insert_failure";
    throw new Error(`onboarding API failed with HTTP ${onboardingResponse.status}: ${category}`);
  }
  const { data: profileRows } = await admin.from("profiles").select("id,onboarding_completed").eq("id", users[0]);
  result.profile_bootstrap_verified = profileRows?.length === 1 && profileRows[0].onboarding_completed === true;

  const retryResponse = await fetch(`${base}/api/customer/onboarding`, {
    method: "POST", headers, body: JSON.stringify(onboardingPayload),
  });
  await retryResponse.json().catch(() => null);
  const { data: onboardingRows } = await admin.from("onboarding_requests")
    .select("id,user_id,commercial_intent_id,product_code,target_countries,commercial_objective,locale,status")
    .eq("user_id", users[0]).eq("commercial_intent_id", intentId);
  const onboarding = onboardingRows?.[0];
  result.migration_050_shape = Boolean(onboarding && Object.hasOwn(onboarding, "commercial_intent_id") && Object.hasOwn(onboarding, "commercial_objective"));
  result.onboarding_owner_correct = onboarding?.user_id === users[0];
  result.intent_linked = onboarding?.commercial_intent_id === intentId;
  result.multi_country_persisted = JSON.stringify(onboarding?.target_countries) === JSON.stringify(["Colombia", "United States"]);
  result.retry_idempotent = onboardingRows?.length === 1;

  const { data: completedRows } = await admin.from("commercial_intents").select("status,onboarding_id").eq("id", intentId);
  result.intent_completed = completedRows?.[0]?.status === "onboarding_completed" && completedRows?.[0]?.onboarding_id === onboardingId;

  const { data: lifecycleRows, error: lifecycleError } = await admin.from("customer_lifecycle_events")
    .select("event_name,user_id,object_type,object_id,metadata").eq("user_id", users[0]);
  result.migration_051_shape = !lifecycleError && Array.isArray(lifecycleRows);
  result.lifecycle_intent_recorded = lifecycleRows?.some(row => row.event_name === "commercial_intent_created") ?? false;
  result.lifecycle_onboarding_recorded = lifecycleRows?.some(row => row.event_name === "onboarding_completed") ?? false;
  result.lifecycle_payload_private = lifecycleRows?.every(row => {
    const payload = JSON.stringify(row.metadata ?? {}).toLowerCase();
    return !payload.includes("synthetic") && !payload.includes("@") && !payload.includes("target_customer");
  }) ?? false;

  const { data: cross } = await clients[1].from("onboarding_requests").select("id").eq("id", onboardingId);
  result.cross_user_onboarding_denied = Array.isArray(cross) && cross.length === 0;
  const { error: directError } = await clients[0].from("onboarding_requests").insert({
    user_id: users[0], full_name: "QA", email: emails[0], company_name: "QA",
  });
  result.direct_onboarding_insert_denied = Boolean(directError);
} finally {
  await cleanupUsers(users);
  const [intentCheck, onboardingCheck, lifecycleCheck] = users.length ? await Promise.all([
    admin.from("commercial_intents").select("id", { count: "exact", head: true }).in("user_id", users),
    admin.from("onboarding_requests").select("id", { count: "exact", head: true }).in("user_id", users),
    admin.from("customer_lifecycle_events").select("id", { count: "exact", head: true }).in("user_id", users),
  ]) : [{ count: 0 }, { count: 0 }, { count: 0 }];
  result.cleanup = intentCheck.count === 0 && onboardingCheck.count === 0 && lifecycleCheck.count === 0;
  for (const [key, value] of Object.entries(result)) console.log(`${key}=${value}`);
}

if (!Object.values(result).every(Boolean)) process.exit(1);
