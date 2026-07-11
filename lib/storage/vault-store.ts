// ─── Vault Foundation store v0 ────────────────────────────────────────────────
// Server-side only (service role). All functions degrade gracefully when
// Supabase is not configured: reads return null/[], writes return null with a
// console warning. Nothing here scrapes, fetches externally, or touches
// customer-facing routes — admin/internal use only.

import type {
  VaultCompany,
  VaultContact,
  VaultSource,
  VaultSignal,
  VaultUsageHistory,
  VaultReservation,
  VaultSuppressionEntry,
  VaultReviewStatus,
  VaultStatus,
} from "@/lib/vault/vault-types";

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

function warnNoDb(fn: string): void {
  console.warn(`[vault-store] ${fn}: Supabase not configured — no-op`);
}

const LIST_LIMIT = 100;

// ─── Companies ────────────────────────────────────────────────────────────────

export async function createVaultCompany(input: Partial<VaultCompany> & { name: string }): Promise<VaultCompany | null> {
  const db = await getDb();
  if (!db) { warnNoDb("createVaultCompany"); return null; }
  const { data, error } = await db.from("vault_companies").insert({
    name: input.name,
    domain: input.domain ?? null,
    website_url: input.website_url ?? null,
    linkedin_company_url: input.linkedin_company_url ?? null,
    industry: input.industry ?? null,
    region: input.region ?? null,
    country: input.country ?? null,
    company_size: input.company_size ?? null,
    description: input.description ?? null,
    source_status: input.source_status ?? null,
  }).select("*").single();
  if (error) { console.error("[vault-store] createVaultCompany:", error.message); return null; }
  return data as VaultCompany;
}

export async function getVaultCompanyById(id: string): Promise<VaultCompany | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("vault_companies").select("*").eq("id", id).maybeSingle();
  return (data as VaultCompany) ?? null;
}

export async function findVaultCompanyByDomain(domain: string): Promise<VaultCompany | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("vault_companies").select("*").eq("domain", domain).limit(1).maybeSingle();
  return (data as VaultCompany) ?? null;
}

export async function listVaultCompanies(filters: { region?: string; vault_status?: string } = {}): Promise<VaultCompany[]> {
  const db = await getDb();
  if (!db) return [];
  let q = db.from("vault_companies").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (filters.region) q = q.eq("region", filters.region);
  if (filters.vault_status) q = q.eq("vault_status", filters.vault_status);
  const { data } = await q;
  return (data ?? []) as VaultCompany[];
}

export async function updateVaultCompanyStatus(id: string, vaultStatus: VaultStatus): Promise<boolean> {
  const db = await getDb();
  if (!db) { warnNoDb("updateVaultCompanyStatus"); return false; }
  const { error } = await db.from("vault_companies").update({ vault_status: vaultStatus, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function createVaultContact(input: Partial<VaultContact>): Promise<VaultContact | null> {
  const db = await getDb();
  if (!db) { warnNoDb("createVaultContact"); return null; }
  const { data, error } = await db.from("vault_contacts").insert({
    company_id: input.company_id ?? null,
    full_name: input.full_name ?? null,
    title: input.title ?? null,
    seniority: input.seniority ?? null,
    department: input.department ?? null,
    email: input.email ?? null,
    email_status: input.email_status ?? null,
    linkedin_url: input.linkedin_url ?? null,
    region: input.region ?? null,
    country: input.country ?? null,
    source_status: input.source_status ?? null,
    usage_rights_status: input.usage_rights_status ?? "unverified",
  }).select("*").single();
  if (error) { console.error("[vault-store] createVaultContact:", error.message); return null; }
  return data as VaultContact;
}

export async function getVaultContactById(id: string): Promise<VaultContact | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("vault_contacts").select("*").eq("id", id).maybeSingle();
  return (data as VaultContact) ?? null;
}

export async function findVaultContactByEmail(email: string): Promise<VaultContact | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("vault_contacts").select("*").eq("email", email).limit(1).maybeSingle();
  return (data as VaultContact) ?? null;
}

export async function listVaultContacts(filters: { review_status?: string; vault_status?: string; region?: string } = {}): Promise<VaultContact[]> {
  const db = await getDb();
  if (!db) return [];
  let q = db.from("vault_contacts").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (filters.review_status) q = q.eq("review_status", filters.review_status);
  if (filters.vault_status) q = q.eq("vault_status", filters.vault_status);
  if (filters.region) q = q.eq("region", filters.region);
  const { data } = await q;
  return (data ?? []) as VaultContact[];
}

export async function updateVaultContactReviewStatus(id: string, reviewStatus: VaultReviewStatus): Promise<boolean> {
  const db = await getDb();
  if (!db) { warnNoDb("updateVaultContactReviewStatus"); return false; }
  const { error } = await db.from("vault_contacts").update({ review_status: reviewStatus, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

// ─── Sources ──────────────────────────────────────────────────────────────────

export async function createVaultSource(input: Partial<VaultSource> & { source_type: string }): Promise<VaultSource | null> {
  const db = await getDb();
  if (!db) { warnNoDb("createVaultSource"); return null; }
  const { data, error } = await db.from("vault_sources").insert({
    provider_id: input.provider_id ?? null,
    source_type: input.source_type,
    source_url: input.source_url ?? null,
    source_title: input.source_title ?? null,
    retrieved_at: input.retrieved_at ?? new Date().toISOString(),
    published_at: input.published_at ?? null,
    freshness_status: input.freshness_status ?? null,
    confidence_score: input.confidence_score ?? null,
    usage_rights_status: input.usage_rights_status ?? "unverified",
    notes: input.notes ?? null,
    raw_metadata: input.raw_metadata ?? null,
  }).select("*").single();
  if (error) { console.error("[vault-store] createVaultSource:", error.message); return null; }
  return data as VaultSource;
}

export async function getVaultSourceById(id: string): Promise<VaultSource | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("vault_sources").select("*").eq("id", id).maybeSingle();
  return (data as VaultSource) ?? null;
}

export async function listVaultSources(): Promise<VaultSource[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("vault_sources").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as VaultSource[];
}

// ─── Signals ──────────────────────────────────────────────────────────────────

export async function createVaultSignal(input: Partial<VaultSignal> & { signal_type: string }): Promise<VaultSignal | null> {
  const db = await getDb();
  if (!db) { warnNoDb("createVaultSignal"); return null; }
  const { data, error } = await db.from("vault_signals").insert({
    company_id: input.company_id ?? null,
    contact_id: input.contact_id ?? null,
    source_id: input.source_id ?? null,
    signal_type: input.signal_type,
    signal_summary: input.signal_summary ?? null,
    signal_date: input.signal_date ?? null,
    expires_at: input.expires_at ?? null,
    strength_score: input.strength_score ?? null,
    confidence_score: input.confidence_score ?? null,
    review_status: input.review_status ?? "pending_review",
  }).select("*").single();
  if (error) { console.error("[vault-store] createVaultSignal:", error.message); return null; }
  return data as VaultSignal;
}

export async function listVaultSignals(filters: { review_status?: string; signal_type?: string } = {}): Promise<VaultSignal[]> {
  const db = await getDb();
  if (!db) return [];
  let q = db.from("vault_signals").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (filters.review_status) q = q.eq("review_status", filters.review_status);
  if (filters.signal_type) q = q.eq("signal_type", filters.signal_type);
  const { data } = await q;
  return (data ?? []) as VaultSignal[];
}

export async function listSignalsByCompany(companyId: string): Promise<VaultSignal[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("vault_signals").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as VaultSignal[];
}

export async function updateVaultSignalReviewStatus(id: string, reviewStatus: VaultReviewStatus): Promise<boolean> {
  const db = await getDb();
  if (!db) { warnNoDb("updateVaultSignalReviewStatus"); return false; }
  const { error } = await db.from("vault_signals").update({ review_status: reviewStatus, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

// ─── Usage history ────────────────────────────────────────────────────────────

export async function recordVaultUsage(input: Partial<VaultUsageHistory> & { usage_type: string }): Promise<VaultUsageHistory | null> {
  const db = await getDb();
  if (!db) { warnNoDb("recordVaultUsage"); return null; }
  const { data, error } = await db.from("vault_usage_history").insert({
    company_id: input.company_id ?? null,
    contact_id: input.contact_id ?? null,
    order_id: input.order_id ?? null,
    job_id: input.job_id ?? null,
    customer_email: input.customer_email ?? null,
    usage_type: input.usage_type,
    delivered_at: input.delivered_at ?? null,
    fit_score: input.fit_score ?? null,
    notes: input.notes ?? null,
  }).select("*").single();
  if (error) { console.error("[vault-store] recordVaultUsage:", error.message); return null; }
  return data as VaultUsageHistory;
}

export async function listUsageByContact(contactId: string): Promise<VaultUsageHistory[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("vault_usage_history").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as VaultUsageHistory[];
}

export async function listUsageByCompany(companyId: string): Promise<VaultUsageHistory[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("vault_usage_history").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as VaultUsageHistory[];
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function createVaultReservation(input: Partial<VaultReservation>): Promise<VaultReservation | null> {
  const db = await getDb();
  if (!db) { warnNoDb("createVaultReservation"); return null; }
  const { data, error } = await db.from("vault_reservations").insert({
    company_id: input.company_id ?? null,
    contact_id: input.contact_id ?? null,
    reserved_for_customer_email: input.reserved_for_customer_email ?? null,
    reserved_for_order_id: input.reserved_for_order_id ?? null,
    reservation_reason: input.reservation_reason ?? null,
    expires_at: input.expires_at ?? null,
  }).select("*").single();
  if (error) { console.error("[vault-store] createVaultReservation:", error.message); return null; }
  return data as VaultReservation;
}

export async function listActiveReservations(): Promise<VaultReservation[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("vault_reservations").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as VaultReservation[];
}

export async function releaseVaultReservation(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) { warnNoDb("releaseVaultReservation"); return false; }
  const { error } = await db.from("vault_reservations").update({ status: "released", updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

// ─── Suppression ──────────────────────────────────────────────────────────────

export async function addSuppressionEntry(input: { suppression_type: string; value: string; reason: string; source?: string }): Promise<VaultSuppressionEntry | null> {
  const db = await getDb();
  if (!db) { warnNoDb("addSuppressionEntry"); return null; }
  const { data, error } = await db.from("vault_suppression_list").insert({
    suppression_type: input.suppression_type,
    value: input.value.toLowerCase().trim(),
    reason: input.reason,
    source: input.source ?? null,
  }).select("*").single();
  if (error) { console.error("[vault-store] addSuppressionEntry:", error.message); return null; }
  return data as VaultSuppressionEntry;
}

export async function isSuppressed(type: string, value: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { data } = await db.from("vault_suppression_list")
    .select("id")
    .eq("suppression_type", type)
    .eq("value", value.toLowerCase().trim())
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function listSuppressionEntries(): Promise<VaultSuppressionEntry[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("vault_suppression_list").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  return (data ?? []) as VaultSuppressionEntry[];
}

// ─── Vault → Report bridge helpers ────────────────────────────────────────────
// Higher-level usage/reservation operations for the Vault → report pipeline
// bridge. Preview and dry-run NEVER call these — usage is recorded only when a
// real customer deliverable is generated. See LEADLENS_VAULT_REPORT_BRIDGE.md.

export interface VaultRunContext {
  customer_email?: string | null;
  order_id?: string | null;
  job_id?: string | null;
}

/** Reserve a set of companies for an in-flight run (default 24h TTL). */
export async function reserveVaultOpportunitiesForRun(
  companyIds: string[],
  context: VaultRunContext,
  ttlHours = 24,
): Promise<VaultReservation[]> {
  const created: VaultReservation[] = [];
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000).toISOString();
  for (const companyId of companyIds) {
    const reservation = await createVaultReservation({
      company_id: companyId,
      reserved_for_customer_email: context.customer_email ?? null,
      reserved_for_order_id: context.order_id ?? null,
      reservation_reason: context.job_id ? `report run ${context.job_id}` : "report run",
      expires_at: expiresAt,
    });
    if (reservation) created.push(reservation);
  }
  return created;
}

/** Record delivered usage AFTER a report is successfully generated. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordVaultOpportunitiesUsed(
  companyIds: string[],
  context: VaultRunContext,
): Promise<number> {
  let recorded = 0;
  // vault_usage_history.job_id is UUID; pipeline jobIds like "vault-<ts>-<rand>"
  // are text — those travel in notes so the row still traces back to the run.
  const jobIsUuid = !!context.job_id && UUID_RE.test(context.job_id);
  for (const companyId of companyIds) {
    const row = await recordVaultUsage({
      company_id: companyId,
      customer_email: context.customer_email ?? null,
      order_id: context.order_id ?? null,
      job_id: jobIsUuid ? context.job_id! : null,
      usage_type: "report_delivery",
      delivered_at: new Date().toISOString(),
      notes: jobIsUuid || !context.job_id ? null : `job ${context.job_id}`,
    });
    if (row) recorded++;
  }
  return recorded;
}

/** Release every active reservation tied to a failed run's context. */
export async function releaseVaultReservationsForFailedRun(context: VaultRunContext): Promise<number> {
  const active = await listActiveReservations();
  let released = 0;
  for (const r of active) {
    const matches =
      (context.order_id && r.reserved_for_order_id === context.order_id) ||
      (context.job_id && r.reservation_reason === `report run ${context.job_id}`) ||
      (!context.order_id && !context.job_id && context.customer_email &&
        r.reserved_for_customer_email?.toLowerCase() === context.customer_email.toLowerCase());
    if (matches && (await releaseVaultReservation(r.id))) released++;
  }
  return released;
}

/** All recorded Vault usage for one customer (for "already used" explanations). */
export async function listVaultUsageForCustomer(customerEmail: string): Promise<VaultUsageHistory[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("vault_usage_history")
    .select("*")
    .eq("customer_email", customerEmail.toLowerCase().trim())
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  return (data ?? []) as VaultUsageHistory[];
}
