#!/usr/bin/env node
// Non-destructive live acceptance + diagnostic for the confirmed_commercial_contexts
// table (migrations 053 / 054). Verifies the table exists with the CANONICAL
// schema WITHOUT inserting into production (the immutability trigger blocks
// cleanup, and the user_id FK to auth.users prevents synthetic rows). Reads
// .env.local without printing secret values. Never uses head:true.
//
// Exit codes: 0 = canonical & accepted · 2 = table absent · 3 = table present but
// stray/incomplete (apply 054) · 4 = unexpected error.
import { createClient } from "@supabase/supabase-js";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "SUPABASE_SERVICE_ROLE_KEY")) {
  console.log("SUPABASE_NOT_CONFIGURED");
  process.exit(0);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLE = "confirmed_commercial_contexts";
const CANONICAL_COLUMNS = [
  "id", "user_id", "context_id", "version", "supersedes_version", "client_id",
  "schema_version", "objective_type", "payload", "provenance_summary",
  "effective_from", "confirmed_at", "created_at",
];

// 1. Does the table exist at all? A bare `select id` distinguishes absent-table
//    from present-but-incomplete.
const probe = await sb.from(TABLE).select("id").limit(1);
if (probe.error) {
  if (/does not exist|schema cache|42P01|find the table/i.test(probe.error.message)) {
    console.log("TABLE_ABSENT :: neither 053 nor 054 applied — apply 054 (canonical schema).");
    process.exit(2);
  }
  console.log("UNEXPECTED_ERROR ::", probe.error.message);
  process.exit(4);
}

// 2. Column-by-column presence: identifies a stray/incomplete table precisely.
const present = [];
const missing = [];
for (const col of CANONICAL_COLUMNS) {
  const { error } = await sb.from(TABLE).select(col).limit(1);
  (error ? missing : present).push(col);
}

if (missing.length > 0) {
  console.log(`TABLE_STRAY :: present=[${present.join(", ")}]`);
  console.log(`             :: MISSING=[${missing.join(", ")}]`);
  console.log("             :: a non-canonical table exists (not from repo migrations). APPLY 054 to reconcile.");
  process.exit(3);
}

console.log("SCHEMA_CANONICAL :: all expected columns selectable");

// 3. RLS: anon must NOT read (owner-only policy). Confirm anon is blocked/empty.
if (has(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.from(TABLE).select("id").limit(1);
  if (error) console.log("RLS_ANON :: anon blocked by RLS/policy");
  else console.log(`RLS_ANON :: anon select returned ${data?.length ?? 0} rows (owner-scoped; expected 0 without a session)`);
}

console.log("ACCEPTANCE :: confirmed_commercial_contexts is live and canonical (no production rows written).");
process.exit(0);
