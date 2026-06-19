// ─── SaaS Foundation Storage Layer ───────────────────────────────────────────
// Reads/writes to Supabase when configured.
// Returns null/[] gracefully when Supabase is not configured.
// Never throws on missing config — callers handle the null case.

import type {
  Order, CreateOrderInput,
  CustomerIntake, CreateIntakeInput,
  SaasJob, CreateSaasJobInput, SaasJobStatus,
  SaasReport, CreateReportInput,
  JobEvent, CreateJobEventInput,
  AdminNote, CreateAdminNoteInput,
  OrderStatus, DeliveryStatus, IntakeStatus,
} from "@/types/saas";

// ─── Internal: get Supabase server client or null ─────────────────────────────

async function db() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

function notConfigured(fn: string) {
  console.warn(`[saas-store] Supabase not configured — ${fn} is a no-op`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createOrder(input: CreateOrderInput): Promise<Order | null> {
  const client = await db();
  if (!client) { notConfigured("createOrder"); return null; }

  const { data, error } = await client
    .from("orders")
    .insert({
      external_order_id: input.external_order_id,
      payment_provider:  input.payment_provider ?? "lemon_squeezy",
      provider_event_id: input.provider_event_id,
      customer_email:    input.customer_email,
      customer_name:     input.customer_name,
      plan:              input.plan,
      amount_cents:      input.amount_cents,
      currency:          input.currency ?? "USD",
      status:            input.status ?? "paid",
      intake_status:     input.intake_status ?? "pending",
      delivery_status:   input.delivery_status ?? "pending",
      checkout_id:       input.checkout_id,
      raw_payload:       input.raw_payload,
      notes:             input.notes,
    })
    .select()
    .single();

  if (error) {
    console.error("[saas-store] createOrder error:", error.message);
    return null;
  }
  return data as Order;
}

export async function getOrderById(id: string): Promise<Order | null> {
  const client = await db();
  if (!client) { notConfigured("getOrderById"); return null; }

  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Order;
}

export async function getOrderByExternalId(externalId: string): Promise<Order | null> {
  const client = await db();
  if (!client) { notConfigured("getOrderByExternalId"); return null; }

  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("external_order_id", externalId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Order;
}

export async function listOrders(opts?: {
  status?: string;
  delivery_status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ orders: Order[]; total: number }> {
  const client = await db();
  if (!client) { notConfigured("listOrders"); return { orders: [], total: 0 }; }

  let query = client.from("orders").select("*", { count: "exact" });
  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.delivery_status) query = query.eq("delivery_status", opts.delivery_status);

  const limit  = opts?.limit  ?? 50;
  const offset = opts?.offset ?? 0;
  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error("[saas-store] listOrders error:", error.message);
    return { orders: [], total: 0 };
  }
  return { orders: (data ?? []) as Order[], total: count ?? 0 };
}

export async function updateOrderStatus(
  id: string,
  updates: Partial<{
    status: OrderStatus;
    intake_status: IntakeStatus;
    delivery_status: DeliveryStatus;
    notes: string;
  }>
): Promise<Order | null> {
  const client = await db();
  if (!client) { notConfigured("updateOrderStatus"); return null; }

  const { data, error } = await client
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[saas-store] updateOrderStatus error:", error.message);
    return null;
  }
  return data as Order;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER INTAKES
// ═══════════════════════════════════════════════════════════════════════════════

export async function createCustomerIntake(input: CreateIntakeInput): Promise<CustomerIntake | null> {
  const client = await db();
  if (!client) { notConfigured("createCustomerIntake"); return null; }

  const od = input.onboarding_data;

  const { data, error } = await client
    .from("customer_intakes")
    .insert({
      order_id:                   input.order_id,
      customer_email:             input.customer_email,
      company_name:               od.company_name,
      target_industry:            null,
      target_geography:           od.target_market_region ?? null,
      preferred_tone:             od.tone,
      output_language:            od.output_language ?? "en",
      onboarding_data:            od,
      website:                    input.website ?? null,
      target_company_size:        input.target_company_size ?? null,
      buyer_titles:               input.buyer_titles ?? null,
      exclusions:                 input.exclusions ?? null,
      existing_customer_examples: input.existing_customer_examples ?? null,
      notes:                      input.notes ?? null,
      status:                     "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[saas-store] createCustomerIntake error:", error.message);
    return null;
  }
  return data as CustomerIntake;
}

export async function getIntakeByOrderId(orderId: string): Promise<CustomerIntake | null> {
  const client = await db();
  if (!client) { notConfigured("getIntakeByOrderId"); return null; }

  const { data, error } = await client
    .from("customer_intakes")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  return data as CustomerIntake;
}

export async function updateCustomerIntake(
  id: string,
  updates: Partial<Pick<CustomerIntake, "clarity_score" | "notes" | "status">>
): Promise<CustomerIntake | null> {
  const client = await db();
  if (!client) { notConfigured("updateCustomerIntake"); return null; }

  const { data, error } = await client
    .from("customer_intakes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[saas-store] updateCustomerIntake error:", error.message);
    return null;
  }
  return data as CustomerIntake;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOBS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createSaasJob(input: CreateSaasJobInput): Promise<SaasJob | null> {
  const client = await db();
  if (!client) { notConfigured("createSaasJob"); return null; }

  const { data, error } = await client
    .from("jobs")
    .insert({
      order_id:  input.order_id,
      intake_id: input.intake_id ?? null,
      plan:      input.plan,
      status:    input.status ?? "awaiting_intake",
      progress:  0,
    })
    .select()
    .single();

  if (error) {
    console.error("[saas-store] createSaasJob error:", error.message);
    return null;
  }
  return data as SaasJob;
}

export async function getSaasJobById(id: string): Promise<SaasJob | null> {
  const client = await db();
  if (!client) { notConfigured("getSaasJobById"); return null; }

  const { data, error } = await client
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as SaasJob;
}

export async function getSaasJobByOrderId(orderId: string): Promise<SaasJob | null> {
  const client = await db();
  if (!client) { notConfigured("getSaasJobByOrderId"); return null; }

  const { data, error } = await client
    .from("jobs")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SaasJob;
}

export async function listSaasJobs(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ jobs: SaasJob[]; total: number }> {
  const client = await db();
  if (!client) { notConfigured("listSaasJobs"); return { jobs: [], total: 0 }; }

  let query = client.from("jobs").select("*", { count: "exact" });
  if (opts?.status) query = query.eq("status", opts.status);

  const limit  = opts?.limit  ?? 50;
  const offset = opts?.offset ?? 0;
  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error("[saas-store] listSaasJobs error:", error.message);
    return { jobs: [], total: 0 };
  }
  return { jobs: (data ?? []) as SaasJob[], total: count ?? 0 };
}

export async function updateSaasJob(
  id: string,
  updates: Partial<Pick<
    SaasJob,
    "status" | "progress" | "intake_id" | "report_id" |
    "error_message" | "admin_approved" | "started_at" |
    "completed_at" | "delivered_at"
  >>
): Promise<SaasJob | null> {
  const client = await db();
  if (!client) { notConfigured("updateSaasJob"); return null; }

  const { data, error } = await client
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[saas-store] updateSaasJob error:", error.message);
    return null;
  }
  return data as SaasJob;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createReport(input: CreateReportInput): Promise<SaasReport | null> {
  const client = await db();
  if (!client) { notConfigured("createReport"); return null; }

  const { data, error } = await client
    .from("reports")
    .insert({
      job_id:           input.job_id,
      order_id:         input.order_id,
      plan:             input.plan,
      lead_count:       input.lead_count,
      report_json:      input.report_json,
      csv_content:      input.csv_content ?? null,
      markdown_content: input.markdown_content ?? null,
      status:           "ready",
    })
    .select()
    .single();

  if (error) {
    console.error("[saas-store] createReport error:", error.message);
    return null;
  }
  return data as SaasReport;
}

export async function getReportByJobId(jobId: string): Promise<SaasReport | null> {
  const client = await db();
  if (!client) { notConfigured("getReportByJobId"); return null; }

  const { data, error } = await client
    .from("reports")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SaasReport;
}

export async function getReportById(id: string): Promise<SaasReport | null> {
  const client = await db();
  if (!client) { notConfigured("getReportById"); return null; }

  const { data, error } = await client
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as SaasReport;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function addJobEvent(input: CreateJobEventInput): Promise<JobEvent | null> {
  const client = await db();
  if (!client) { notConfigured("addJobEvent"); return null; }

  const { data, error } = await client
    .from("job_events")
    .insert({
      job_id:     input.job_id,
      order_id:   input.order_id ?? null,
      event_type: input.event_type,
      message:    input.message ?? null,
      metadata:   input.metadata ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[saas-store] addJobEvent error:", error.message);
    return null;
  }
  return data as JobEvent;
}

export async function listJobEvents(jobId: string): Promise<JobEvent[]> {
  const client = await db();
  if (!client) { notConfigured("listJobEvents"); return []; }

  const { data, error } = await client
    .from("job_events")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as JobEvent[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN NOTES
// ═══════════════════════════════════════════════════════════════════════════════

export async function addAdminNote(input: CreateAdminNoteInput): Promise<AdminNote | null> {
  const client = await db();
  if (!client) { notConfigured("addAdminNote"); return null; }

  const { data, error } = await client
    .from("admin_notes")
    .insert({
      order_id:   input.order_id ?? null,
      job_id:     input.job_id ?? null,
      note:       input.note,
      created_by: input.created_by ?? "admin",
    })
    .select()
    .single();

  if (error) {
    console.error("[saas-store] addAdminNote error:", error.message);
    return null;
  }
  return data as AdminNote;
}

export async function listAdminNotes(opts: {
  order_id?: string;
  job_id?: string;
}): Promise<AdminNote[]> {
  const client = await db();
  if (!client) { notConfigured("listAdminNotes"); return []; }

  let query = client.from("admin_notes").select("*");
  if (opts.order_id) query = query.eq("order_id", opts.order_id);
  if (opts.job_id)   query = query.eq("job_id", opts.job_id);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as AdminNote[];
}
