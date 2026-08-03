import { readFileSync } from "fs";
import * as p from "@/lib/intelligence/amor-de-gea-phase4-intelligence";
import { AMOR_SEARCH_BLUEPRINT as b } from "@/lib/intelligence/amor-de-gea-search-blueprint";
import { buildPilotWorkspace } from "@/lib/intelligence/pilot-workspace";
let ok = 0,
  bad = 0;
const t = (n: string, v: boolean) => {
  console.log(`${v ? "✅" : "❌"} ${n}`);
  v ? ok++ : bad++;
};
const w = buildPilotWorkspace(),
  checkpoint = JSON.parse(
    readFileSync(
      "ml/data/opportunity-intelligence/amor_phase4_recovery_v1.checkpoint.json",
      "utf8",
    ),
  );
t(
  "exact blueprint approved only",
  b.blueprint_id === "blueprint_57b88651984aaee555dc23be" &&
    b.approval_state === "approved",
);
t(
  "run links context and blueprint",
  p.AMOR_PHASE4_RUN.context_id === "context_28bbc2b447323da3e387c964" &&
    p.AMOR_PHASE4_RUN.blueprint_id === b.blueprint_id,
);
t(
  "15 queries and calls",
  checkpoint.queries.length === 15 &&
    checkpoint.recovery.calls === 15 &&
    checkpoint.queries.every(
      (q: any) => q.status === "completed" && q.attempts === 1,
    ),
);
t(
  "candidate ceilings",
  p.AMOR_PHASE4_FUNNEL.raw <= 100 &&
    p.AMOR_PHASE4_FUNNEL.identity_verified <= 30 &&
    p.AMOR_PHASE4_FUNNEL.qualified <= 18 &&
    p.AMOR_PHASE4_FUNNEL.deep_research <= 12,
);
t(
  "dedupe",
  p.AMOR_PHASE4_FUNNEL.deduplicated === 56 &&
    new Set(p.AMOR_PHASE4_CANDIDATE_UNIVERSE.map((x) => x.domain)).size ===
      p.AMOR_PHASE4_CANDIDATE_UNIVERSE.length,
);
t(
  "baseline and prior recognized",
  p.AMOR_PHASE4_PORTFOLIO.filter((x) => x.baseline).length === 6,
);
t(
  "no prohibited routes",
  p.AMOR_PHASE4_PORTFOLIO.every(
    (x) => !["private_label", "mass_distribution"].includes(x.route),
  ),
);
t(
  "unknown margin does not exclude",
  b.exclusion_boundary.includes("margin alone never excludes"),
);
t("map four routes", p.AMOR_MARKET_OPPORTUNITY_MAP.length === 4);
t(
  "experiments remain hypotheses",
  p.AMOR_STRATEGIC_EXPERIMENTS.length === 4 &&
    p.AMOR_STRATEGIC_EXPERIMENTS.every((x) => x.hypothesis),
);
t(
  "every portfolio mechanism",
  p.AMOR_PHASE4_PORTFOLIO.every(
    (x) => Object.keys(x.opportunity_mechanism).length === 10,
  ),
);
t(
  "evidence separated",
  p.AMOR_PHASE4_DEEP_RESEARCH.every(
    (x) =>
      x.evidence.facts &&
      x.evidence.signals &&
      x.evidence.inferences &&
      x.evidence.counterevidence &&
      x.evidence.uncertainties &&
      x.evidence.validation_needs,
  ),
);
t(
  "official evidence core",
  p.AMOR_PHASE4_DEEP_RESEARCH.every((x) =>
    x.evidence.facts[0].source_url.startsWith("https://"),
  ),
);
t(
  "buyer paths",
  p.AMOR_PHASE4_PORTFOLIO.every(
    (x) =>
      x.buyer_entry.function && x.buyer_entry.conflict_check === "required",
  ),
);
t(
  "timing separate no intent",
  p.AMOR_PHASE4_PORTFOLIO.every(
    (x) =>
      x.timing.state === "no timing evidence" && x.actionability !== "ACT NOW",
  ),
);
t(
  "exclusions reasoned",
  p.AMOR_PHASE4_CANDIDATE_UNIVERSE.filter(
    (x) => x.qualification_state === "excluded",
  ).every((x) => !!x.exclusion_reason),
);
t(
  "no hard blocked portfolio",
  p.AMOR_PHASE4_PORTFOLIO.every((x) => !x.qualification.hard_blocker),
);
t(
  "portfolio size and buckets",
  p.AMOR_PHASE4_PORTFOLIO.length === 15 &&
    p.AMOR_PHASE4_PORTFOLIO.filter((x) => x.bucket === "work_first").length ===
      5,
);
t(
  "action briefs internal",
  p.AMOR_ACTION_BRIEF_CANDIDATES.length === 5 &&
    p.AMOR_ACTION_BRIEF_CANDIDATES.every((x) => !x.customer_safe),
);
t(
  "learning no outcomes",
  p.AMOR_LEARNING_AGENDA.every((x) => !x.answered) &&
    p.AMOR_PRELIMINARY_STRUCTURAL_CONCLUSIONS.outcomes_observed === 0,
);
t(
  "human review pending",
  p.AMOR_HUMAN_REVIEW_QUEUE.length === 15 &&
    p.AMOR_WHAT_CHANGED_V3.state === "internal_pending_human_review",
);
t(
  "accounting honest",
  p.AMOR_PHASE4_ACCOUNTING.original_tavily_calls === 15 &&
    p.AMOR_PHASE4_ACCOUNTING.recovery_tavily_calls === 15 &&
    p.AMOR_PHASE4_ACCOUNTING.exact_provider_cost.includes("unavailable"),
);
t(
  "workspace preserves phase4 during V3R review",
  w.phase4.AMOR_PHASE4_RUN.state === "completed" &&
    w.phase4.AMOR_PHASE4_PORTFOLIO.length === 15 &&
      w.pilot.readiness === "phase4_5_founder_decision_pending",
);
t(
  "no forbidden product expansion",
  w.final_report_generation === "disabled" &&
    w.internal_only &&
    w.ranking_impact === "off",
);
console.log(`\n${ok} passed, ${bad} failed`);
if (bad) process.exit(1);
