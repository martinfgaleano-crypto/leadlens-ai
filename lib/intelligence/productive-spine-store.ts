import type { LeadLensReport, PlanType } from "@/types";

export type IntelligenceRunStage = "lead_hunter" | "research" | "case_synthesis" | "report";
export type IntelligenceRunStatus = "processing" | "completed" | "failed";

export interface IntelligenceRunRecord {
  runId: string;
  userId: string;
  contextRef: { contextId: string; version: number };
  clientId: string | null;
  plan: PlanType;
  status: IntelligenceRunStatus;
  stage: IntelligenceRunStage;
  leadHunterRunId: string | null;
  report: LeadLensReport | null;
  failureCode: string | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceRunStore {
  load(runId: string, userId: string): Promise<IntelligenceRunRecord | null>;
  create(record: IntelligenceRunRecord): Promise<{ created: boolean }>;
  save(record: IntelligenceRunRecord): Promise<void>;
}

export class InMemoryIntelligenceRunStore implements IntelligenceRunStore {
  private rows = new Map<string, IntelligenceRunRecord>();
  async load(runId: string, userId: string) {
    const row = this.rows.get(runId);
    return row?.userId === userId ? structuredClone(row) : null;
  }
  async create(record: IntelligenceRunRecord) {
    if (this.rows.has(record.runId)) return { created: false };
    this.rows.set(record.runId, structuredClone(record));
    return { created: true };
  }
  async save(record: IntelligenceRunRecord) {
    const prior = this.rows.get(record.runId);
    if (!prior || prior.userId !== record.userId) throw new Error("intelligence_run_not_owned");
    this.rows.set(record.runId, structuredClone(record));
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class SupabaseIntelligenceRunStore implements IntelligenceRunStore {
  constructor(private readonly db: any) {}

  async load(runId: string, userId: string): Promise<IntelligenceRunRecord | null> {
    const { data, error } = await this.db.from("snapshot_reports")
      .select("job_id,user_id,plan,status,report_json,created_at")
      .eq("job_id", runId).eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    const payload = data.report_json?._intelligence_run;
    if (!payload) return null;
    return {
      runId: data.job_id, userId: data.user_id, plan: data.plan,
      contextRef: payload.contextRef, clientId: payload.clientId ?? null,
      status: data.status, stage: payload.stage, leadHunterRunId: payload.leadHunterRunId ?? null,
      report: data.status === "completed" && Array.isArray(data.report_json?.processed_leads) ? data.report_json : null,
      failureCode: payload.failureCode ?? null,
      attempt: payload.attempt ?? 1,
      createdAt: payload.createdAt ?? data.created_at,
      updatedAt: payload.updatedAt ?? data.created_at,
    };
  }

  async create(record: IntelligenceRunRecord): Promise<{ created: boolean }> {
    const { error } = await this.db.from("snapshot_reports").insert({
      job_id: record.runId, user_id: record.userId, plan: record.plan, status: record.status,
      report_json: serialize(record),
    });
    if (error) {
      if (error.code === "23505" || /duplicate key|already exists/i.test(error.message)) return { created: false };
      throw new Error(`create intelligence run failed: ${error.message}`);
    }
    return { created: true };
  }

  async save(record: IntelligenceRunRecord): Promise<void> {
    const payload = record.report ? { ...record.report, _intelligence_run: metadata(record) } : serialize(record);
    const counts = record.report ? {
      lead_count: record.report.total_leads, hot_count: record.report.hot_count,
      warm_count: record.report.warm_count, avg_score: record.report.avg_score,
    } : {};
    const { data, error } = await this.db.from("snapshot_reports")
      .update({ status: record.status, report_json: payload, ...counts })
      .eq("job_id", record.runId).eq("user_id", record.userId).select("job_id");
    if (error || !data?.length) throw new Error("save intelligence run failed or not owned");
  }
}

function metadata(record: IntelligenceRunRecord) {
  return {
    kind: "productive_intelligence_spine_v1", contextRef: record.contextRef,
    clientId: record.clientId, stage: record.stage, leadHunterRunId: record.leadHunterRunId,
    failureCode: record.failureCode, attempt: record.attempt, createdAt: record.createdAt, updatedAt: record.updatedAt,
  };
}

function serialize(record: IntelligenceRunRecord) {
  return { _status: record.status, job_id: record.runId, _intelligence_run: metadata(record) };
}
