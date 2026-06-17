import type { BatchJob, PlanType, OnboardingData } from "@/types";

// ─── In-memory fallback (works without Supabase) ──────────────────────────────
// Uses globalThis so the Map is shared across Next.js route modules in the same process.

const g = globalThis as typeof globalThis & { __leadlens_jobs?: Map<string, BatchJob> };
if (!g.__leadlens_jobs) g.__leadlens_jobs = new Map<string, BatchJob>();
const memoryStore = g.__leadlens_jobs;

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface CreateJobInput {
  plan: PlanType;
  onboarding: OnboardingData;
  customer_email: string;
  stripe_session_id?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createJob(input: CreateJobInput): Promise<BatchJob> {
  const db = await getServerClient();

  const job: BatchJob = {
    id: generateId(),
    status: "pending",
    plan: input.plan,
    onboarding: input.onboarding,
    customer_email: input.customer_email,
    stripe_session_id: input.stripe_session_id,
    created_at: new Date().toISOString(),
  };

  if (db) {
    const { data, error } = await db
      .from("batch_jobs")
      .insert({
        status: job.status,
        plan: job.plan,
        onboarding: job.onboarding,
        customer_email: job.customer_email,
        stripe_session_id: job.stripe_session_id,
        created_at: job.created_at,
      })
      .select()
      .single();

    if (!error && data) {
      const persisted = { ...job, id: data.id };
      memoryStore.set(persisted.id, persisted);
      return persisted;
    }
    // Fall through to in-memory on DB error
  }

  memoryStore.set(job.id, job);
  return job;
}

export async function getJob(jobId: string): Promise<BatchJob | null> {
  // Check memory first (fast path)
  const cached = memoryStore.get(jobId);
  if (cached) return cached;

  const db = await getServerClient();
  if (!db) return null;

  const { data, error } = await db
    .from("batch_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !data) return null;

  const job = data as BatchJob;
  memoryStore.set(job.id, job);
  return job;
}

export async function updateJob(
  jobId: string,
  updates: Partial<Pick<BatchJob, "status" | "report" | "completed_at" | "stripe_session_id" | "payment_status">>
): Promise<BatchJob | null> {
  const existing = memoryStore.get(jobId) ?? (await getJob(jobId));
  if (!existing) return null;

  const updated: BatchJob = { ...existing, ...updates };
  memoryStore.set(jobId, updated);

  const db = await getServerClient();
  if (db) {
    await db.from("batch_jobs").update(updates).eq("id", jobId);
  }

  return updated;
}

export async function listRecentJobs(limit = 20): Promise<BatchJob[]> {
  const db = await getServerClient();
  if (db) {
    const { data } = await db
      .from("batch_jobs")
      .select("id, status, plan, customer_email, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data) return data as BatchJob[];
  }

  // Fallback: in-memory, sorted by created_at desc
  return Array.from(memoryStore.values())
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, limit);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function getServerClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}
