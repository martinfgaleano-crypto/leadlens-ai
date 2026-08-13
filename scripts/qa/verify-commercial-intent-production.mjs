#!/usr/bin/env node
// Bounded production QA for migration 049 and the deployed Commercial Intent
// API. Creates two ordinary disposable users, prints statuses only, and always
// deletes both users in finally. Never prints credentials, tokens or row data.
import { randomBytes } from "node:crypto";
import { loadEnv } from "../lib/load-env.mjs";
import { createClient } from "@supabase/supabase-js";

const env = loadEnv();
const base = "https://leadlensintel.com";
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("required Supabase environment is unavailable");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const marker = randomBytes(8).toString("hex");
const password = `${randomBytes(24).toString("base64url")}Aa1!`;
const emails = [`qa+a-${marker}@leadlensintel.com`, `qa+b-${marker}@leadlensintel.com`];
const users = [];
let intentId = null;
const result = { user_a_created: false, user_b_created: false, api_create: false, canonical_product: false, direct_insert_denied: false, direct_update_denied: false, direct_delete_denied: false, cross_user_read_denied: false, cleanup: false };

try {
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { qa_disposable: true } });
    if (error || !data.user) throw new Error("QA user creation failed");
    users.push(data.user.id);
  }
  result.user_a_created = users.length >= 1; result.user_b_created = users.length >= 2;
  const clients = [anon(), anon()];
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const { data, error } = await clients[i].auth.signInWithPassword({ email: emails[i], password });
    if (error || !data.session) throw new Error("QA sign-in failed");
    sessions.push(data.session);
  }

  const api = await fetch(`${base}/api/commercial-intents`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${sessions[0].access_token}` },
    body: JSON.stringify({ product_code: "intelligence_launch_v0", source_cta: "pricing", locale: "es", return_to: "/dashboard" }),
  });
  const body = await api.json().catch(() => null);
  result.api_create = api.status === 201 && Boolean(body?.intent?.id);
  result.canonical_product = body?.intent?.product_code === "intelligence_launch_v0";
  intentId = body?.intent?.id ?? null;
  if (!intentId) throw new Error(`Commercial Intent API failed with HTTP ${api.status}`);

  const { error: insertError } = await clients[0].from("commercial_intents").insert({ user_id: users[0], product_code: "brief_launch_v0" });
  result.direct_insert_denied = Boolean(insertError);
  const { data: updated, error: updateError } = await clients[0].from("commercial_intents").update({ status: "converted" }).eq("id", intentId).select("id");
  result.direct_update_denied = Boolean(updateError) || (Array.isArray(updated) && updated.length === 0);
  const { data: deleted, error: deleteError } = await clients[0].from("commercial_intents").delete().eq("id", intentId).select("id");
  const { data: stillOwned } = await clients[0].from("commercial_intents").select("id,status").eq("id", intentId);
  result.direct_delete_denied = (Boolean(deleteError) || (Array.isArray(deleted) && deleted.length === 0)) && stillOwned?.length === 1 && stillOwned[0].status === "captured";
  const { data: cross, error: crossError } = await clients[1].from("commercial_intents").select("id").eq("id", intentId);
  result.cross_user_read_denied = !crossError && Array.isArray(cross) && cross.length === 0;
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => null);
  if (intentId) {
    const { data } = await admin.from("commercial_intents").select("id").eq("id", intentId);
    result.cleanup = Array.isArray(data) && data.length === 0;
  } else result.cleanup = users.length === 0;
  for (const [key, value] of Object.entries(result)) console.log(`${key}=${value}`);
}

if (!Object.values(result).every(Boolean)) process.exit(1);
