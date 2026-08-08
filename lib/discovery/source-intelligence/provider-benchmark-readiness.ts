export const PROVIDER_BENCHMARK_READINESS = {
  id: "provider-incremental-yield-co-us-v1",
  execute_now: false,
  cohorts: ["current_stack", "current_stack_plus_exa"],
  markets: ["CO", "US"],
  next_cell: "USA Manufacturing",
  metrics: ["incremental_novel_qualified_yield", "domain_yield", "evidence_quality", "overlap", "latency_ms", "cost_per_incremental_usable_account"],
  sam_role: "structured entity/procurement context",
  rule: "No source-confidence update until observed benchmark evidence exists.",
} as const;
