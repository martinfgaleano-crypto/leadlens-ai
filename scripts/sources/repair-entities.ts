// ─── Entity repair for provider-search Vault companies ────────────────────────
// Applies resolveCanonicalCompanyFromSignal to title-like company names.
// Non-destructive: renames + preserves the original in description; never
// merges or deletes; unresolved names stay flagged for human review.
// Idempotent: already-clean names are skipped. Run: npm run sources:repair-entities

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolveCanonicalCompanyFromSignal, isTitleLikeName } from "@/lib/vault/entity-resolution";

for (const f of [".env", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: companies } = await db.from("vault_companies")
    .select("id, name, domain, description")
    .eq("source_status", "provider_search")
    .limit(200);

  let repaired = 0, unresolved = 0, clean = 0;
  const samples: string[] = [];
  for (const co of companies ?? []) {
    if (co.description?.includes("[entity-repair]")) { clean++; continue; } // idempotent
    if (!isTitleLikeName(co.name)) { clean++; continue; }
    const res = resolveCanonicalCompanyFromSignal({ currentCompanyName: co.name, sourceDomain: co.domain });
    if (res.identity_suspect) { unresolved++; continue; } // human review will fix
    const { error } = await db.from("vault_companies").update({
      name: res.canonical_name,
      description: `[entity-repair] method=${res.method} confidence=${res.confidence} · original title: "${res.original_name}"${co.description ? ` · ${co.description}` : ""}`,
    }).eq("id", co.id);
    if (!error) {
      repaired++;
      if (samples.length < 5) samples.push(`"${res.original_name.slice(0, 50)}…" → "${res.canonical_name}" (${res.method})`);
    }
  }
  console.log(JSON.stringify({ total: companies?.length ?? 0, repaired, unresolved_suspect: unresolved, already_clean: clean, samples }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
