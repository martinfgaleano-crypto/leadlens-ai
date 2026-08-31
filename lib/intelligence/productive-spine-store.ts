import type { LeadLensReport, PlanType } from "@/types";

export type IntelligenceRunStage = "queued" | "lead_hunter" | "research" | "case_synthesis" | "report";
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
  /** Execution generation (migration 058, top-level column). The atomic claim bumps it;
   *  every authoritative save/finalize fences on it so a stale (superseded) executor cannot
   *  overwrite a newer attempt's result. Distinct from `attempt` (logical retry count). */
  executionGeneration: number;
  /** Run-level coverage honesty: sufficient | partial | insufficient. Lets the durable
   *  commercialOutcome distinguish an insufficient-coverage run from a healthy abstention. */
  coverageState?: "sufficient" | "partial" | "insufficient";
  deliveryLimit: number;
  researchLimit: number;
  researchAudit?: Array<{
    company: string; domain: string | null; country: string | null; category: string;
    fitScore: number; signalDate: string | null; sourceUrl: string | null;
    signalType: string | null; researchConfidence: number | null;
    evidenceClaims: Array<{ type: string; claim: string; date: string | null; source_url: string | null; source_id?: string | null; supporting_sources?: Array<{ source_id: string; url: string; origin: string; support_role: string }> }>;
    actionability?: import("@/lib/intelligence/actionability-funnel").AccountActionabilityFunnel;
    risks: string[]; nextQuestion: string | null; qcStatus: string | null;
    canonicalDecision: string; reasons: string[];
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceRunStore {
  load(runId: string, userId: string): Promise<IntelligenceRunRecord | null>;
  create(record: IntelligenceRunRecord): Promise<{ created: boolean }>;
  /** Fenced authoritative write. Returns true if written; FALSE (no throw) when the row's
   *  execution_generation no longer matches record.executionGeneration — i.e. a stale
   *  (superseded) executor whose write must be a no-op. Throws only on a genuine DB error. */
  save(record: IntelligenceRunRecord): Promise<boolean>;
  /** Atomic claim: advances execution_generation and returns the NEW generation the caller
   *  must carry (and fence all its writes on). Returns null when the run is not claimable
   *  (already completed, wrong owner, mid-flight without force, or lost the generation CAS). */
  claim(runId: string, userId: string, allowed: IntelligenceRunStatus[], forceProcessing?: boolean): Promise<number | null>;
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
  async save(record: IntelligenceRunRecord): Promise<boolean> {
    const prior = this.rows.get(record.runId);
    if (!prior || prior.userId !== record.userId) throw new Error("intelligence_run_not_owned");
    // Fence: a stale executor (older generation) cannot overwrite a newer attempt.
    if ((prior.executionGeneration ?? 0) !== (record.executionGeneration ?? 0)) return false;
    this.rows.set(record.runId, structuredClone(record));
    return true;
  }
  async claim(runId: string, userId: string, allowed: IntelligenceRunStatus[], forceProcessing = false): Promise<number | null> {
    const row = this.rows.get(runId);
    if (!row || row.userId !== userId || !allowed.includes(row.status) || (row.status === "processing" && row.stage !== "queued" && !forceProcessing)) return null;
    const nextGen = (row.executionGeneration ?? 0) + 1;
    this.rows.set(runId, { ...row, status: "processing", stage: "lead_hunter", executionGeneration: nextGen, updatedAt: new Date().toISOString() });
    return nextGen;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class SupabaseIntelligenceRunStore implements IntelligenceRunStore {
  constructor(private readonly db: any) {}

  async load(runId: string, userId: string): Promise<IntelligenceRunRecord | null> {
    const { data, error } = await this.db.from("snapshot_reports")
      .select("job_id,user_id,plan,status,report_json,created_at,execution_generation")
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
      executionGeneration: data.execution_generation ?? 0,
      deliveryLimit: payload.deliveryLimit ?? 2,
      researchLimit: payload.researchLimit ?? 5,
      researchAudit: payload.researchAudit ?? [],
      createdAt: payload.createdAt ?? data.created_at,
      updatedAt: payload.updatedAt ?? data.created_at,
    };
  }

  async create(record: IntelligenceRunRecord): Promise<{ created: boolean }> {
    const { error } = await this.db.from("snapshot_reports").insert({
      job_id: record.runId, user_id: record.userId, plan: record.plan, status: record.status,
      report_json: serialize(record), execution_generation: record.executionGeneration ?? 0,
    });
    if (error) {
      if (error.code === "23505" || /duplicate key|already exists/i.test(error.message)) return { created: false };
      throw new Error(`create intelligence run failed: ${error.message}`);
    }
    return { created: true };
  }

  async save(record: IntelligenceRunRecord): Promise<boolean> {
    const payload = record.report ? { ...record.report, _intelligence_run: metadata(record) } : serialize(record);
    const counts = record.report ? {
      lead_count: record.report.total_leads, hot_count: record.report.hot_count,
      warm_count: record.report.warm_count, avg_score: record.report.avg_score,
    } : {};
    // FENCE (migration 058): only the current execution generation may mutate authoritative
    // run state. save() never changes execution_generation (the claim owns it) and requires
    // it to still equal this executor's generation. A stale/superseded executor matches 0
    // rows → returns false (a clean no-op), so it can never overwrite a newer attempt.
    const { data, error } = await this.db.from("snapshot_reports")
      .update({ status: record.status, report_json: payload, ...counts })
      .eq("job_id", record.runId).eq("user_id", record.userId)
      .eq("execution_generation", record.executionGeneration ?? 0)
      .select("job_id");
    if (error) throw new Error(`save intelligence run failed: ${error.message}`);
    return Boolean(data?.length); // false = fenced out (stale executor), not an error
  }

  async claim(runId: string, userId: string, allowed: IntelligenceRunStatus[], forceProcessing = false): Promise<number | null> {
    // Atomic claim via execution_generation CAS (migration 058). The claim advances the
    // generation and returns it; the executor fences every authoritative write on it. The
    // .eq("execution_generation", currentGen) predicate is the exclusivity primitive for
    // ALL paths — initial queued claim, failed-retry, and stale reclaim: two concurrent
    // claimants both read gen=N and both UPDATE …WHERE execution_generation=N SET =N+1;
    // Postgres serializes the row so exactly one matches (→N+1) and the other matches 0.
    const rec = await this.load(runId, userId);
    if (!rec || !allowed.includes(rec.status)) return null;
    const isQueued = rec.status === "processing" && rec.stage === "queued";
    // A mid-flight processing run is not claimable unless it is the initial queued state or
    // a forced (stale) reclaim.
    if (rec.status === "processing" && !isQueued && !forceProcessing) return null;
    const currentGen = rec.executionGeneration ?? 0;
    const nextGen = currentGen + 1;
    const upd: Record<string, unknown> = { status: "processing", execution_generation: nextGen };
    // For the initial queued claim, also advance stage out of "queued" so a later GET does
    // not redundantly redispatch a run that is already being executed.
    if (isQueued) upd.report_json = serialize({ ...rec, stage: "lead_hunter", executionGeneration: nextGen, updatedAt: new Date().toISOString() });
    const { data, error } = await this.db.from("snapshot_reports")
      .update(upd)
      .eq("job_id", runId).eq("user_id", userId)
      .eq("execution_generation", currentGen).in("status", allowed)
      .select("job_id");
    return (!error && Boolean(data?.length)) ? nextGen : null;
  }
}

function metadata(record: IntelligenceRunRecord) {
  const authoritativeOutcome = record.report
    ? (record.report as LeadLensReport & { _intelligence_run?: { commercialOutcome?: string } })._intelligence_run?.commercialOutcome
    : null;
  return {
    kind: "productive_intelligence_spine_v1", contextRef: record.contextRef,
    clientId: record.clientId, stage: record.stage, leadHunterRunId: record.leadHunterRunId,
    failureCode: record.failureCode, attempt: record.attempt, createdAt: record.createdAt, updatedAt: record.updatedAt,
    deliveryLimit: record.deliveryLimit, researchLimit: record.researchLimit,
    researchAudit: record.researchAudit ?? [],
    coverageState: record.coverageState ?? null,
    // Failure honesty: a run with no delivered opportunities is only a genuine commercial
    // abstention when coverage was NOT insufficient; degraded coverage is reported as such
    // rather than masquerading as "no strong opportunity".
    commercialOutcome: record.report
      ? (authoritativeOutcome ?? (record.coverageState === "insufficient" ? "completed_insufficient_coverage" : "completed_no_strong_opportunity"))
      : record.status === "failed" ? "insufficient_research" : null,
  };
}

function serialize(record: IntelligenceRunRecord) {
  return { _status: record.status, job_id: record.runId, _intelligence_run: metadata(record) };
}
