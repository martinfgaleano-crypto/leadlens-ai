// ─── SaaS Foundation v1 types ─────────────────────────────────────────────────
// These types map 1:1 to Supabase tables in supabase/migrations/001_saas_foundation.sql

import type { PlanType, LeadLensReport, OnboardingData } from "./index";

// ─── Order ────────────────────────────────────────────────────────────────────

export type OrderStatus = "paid" | "refunded" | "disputed" | "cancelled";
export type DeliveryStatus = "pending" | "in_progress" | "delivered" | "failed";
export type IntakeStatus = "pending" | "received" | "complete";

export interface Order {
  id: string;
  external_order_id: string | null;   // Lemon Squeezy order ID
  payment_provider: string;            // "lemon_squeezy" | "stripe" | "manual"
  provider_event_id: string | null;    // LS event/webhook ID for dedup
  customer_email: string;
  customer_name: string | null;
  plan: PlanType;
  amount_cents: number;
  currency: string;
  status: OrderStatus;
  intake_status: IntakeStatus;
  delivery_status: DeliveryStatus;
  checkout_id: string | null;
  raw_payload: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateOrderInput = Omit<Order, "id" | "created_at" | "updated_at" | "status" | "intake_status" | "delivery_status" | "notes"> & {
  status?: OrderStatus;
  intake_status?: IntakeStatus;
  delivery_status?: DeliveryStatus;
  notes?: string | null;
};

// ─── Customer Intake ──────────────────────────────────────────────────────────

export type IntakeProcessingStatus = "pending" | "processing" | "ready" | "error";

export interface CustomerIntake {
  id: string;
  order_id: string;
  customer_email: string;
  // Denormalized key fields for querying
  company_name: string;
  target_industry: string | null;
  target_geography: string | null;
  preferred_tone: string;
  output_language: string;
  // Full OnboardingData stored as JSONB
  onboarding_data: OnboardingData;
  // Extra intake fields not in OnboardingData
  website: string | null;
  target_company_size: string | null;
  buyer_titles: string[] | null;
  exclusions: string | null;
  existing_customer_examples: string | null;
  notes: string | null;
  clarity_score: number | null;        // 1–10 admin assessment
  status: IntakeProcessingStatus;
  created_at: string;
  updated_at: string;
}

export type CreateIntakeInput = {
  order_id: string;
  customer_email: string;
  onboarding_data: OnboardingData;
  website?: string;
  target_company_size?: string;
  buyer_titles?: string[];
  exclusions?: string;
  existing_customer_examples?: string;
  notes?: string;
};

// ─── SaaS Job ─────────────────────────────────────────────────────────────────
// Separate from BatchJob (in-memory) — this is the persisted version.

export type SaasJobStatus =
  | "pending"
  | "awaiting_intake"
  | "intake_received"
  | "queued"
  | "processing"
  | "completed"
  | "error"
  | "delivered";

export interface SaasJob {
  id: string;
  order_id: string;
  intake_id: string | null;
  plan: PlanType;
  status: SaasJobStatus;
  progress: number;                  // 0–100
  report_id: string | null;
  error_message: string | null;
  admin_approved: boolean;
  started_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateSaasJobInput = {
  order_id: string;
  plan: PlanType;
  intake_id?: string;
  status?: SaasJobStatus;
};

// ─── Report ───────────────────────────────────────────────────────────────────

export type ReportStatus = "pending" | "ready" | "delivered";

export interface SaasReport {
  id: string;
  job_id: string;
  order_id: string;
  plan: PlanType;
  lead_count: number;
  report_json: LeadLensReport;
  csv_content: string | null;
  markdown_content: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export type CreateReportInput = {
  job_id: string;
  order_id: string;
  plan: PlanType;
  lead_count: number;
  report_json: LeadLensReport;
  csv_content?: string;
  markdown_content?: string;
};

// ─── Job Event ────────────────────────────────────────────────────────────────

export type JobEventType =
  | "created"
  | "intake_requested"
  | "intake_received"
  | "queued"
  | "pipeline_started"
  | "pipeline_completed"
  | "admin_approved"
  | "delivered"
  | "error"
  | "note_added"
  | "status_changed"
  | "refunded";

export interface JobEvent {
  id: string;
  job_id: string;
  order_id: string | null;
  event_type: JobEventType;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type CreateJobEventInput = {
  job_id: string;
  order_id?: string;
  event_type: JobEventType;
  message?: string;
  metadata?: Record<string, unknown>;
};

// ─── Admin Note ───────────────────────────────────────────────────────────────

export interface AdminNote {
  id: string;
  order_id: string | null;
  job_id: string | null;
  note: string;
  created_by: string;
  created_at: string;
}

export type CreateAdminNoteInput = {
  order_id?: string;
  job_id?: string;
  note: string;
  created_by?: string;
};
