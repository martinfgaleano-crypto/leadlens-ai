import { intelligenceScoreComponents, type IntelligenceControlPlane } from "./capability-control-plane";
import type { ControlPlaneMemoryRecord } from "./control-plane-store";
import { isMeasured } from "./os-contracts";

export const INTELLIGENCE_SCORE_VERSION = "intelligence-score-v1";

export interface IntelligenceScoreView {
  version: string;
  score: number | null;
  confidence: "high" | "medium" | "low";
  sample_size: number;
  previous: number | null;
  delta: number | null;
  trend: "up" | "down" | "stable" | "insufficient_history";
  last_material_movement_at: string | null;
  movement_reasons: string[];
  strongest: string[];
  weakest: string[];
  blockers: string[];
  components: Array<{
    id: string;
    label: string;
    score: number | null;
    confidence: number | null;
    sample_size: number;
    state: string;
    evidence: string[];
    main_blocker: string | null;
  }>;
}

const numeric = (plane: IntelligenceControlPlane) => isMeasured(plane.overall) ? plane.overall.score : null;

export function buildIntelligenceScoreView(
  plane: IntelligenceControlPlane,
  history: ControlPlaneMemoryRecord[] = [],
): IntelligenceScoreView {
  const current = numeric(plane);
  const priorRecord = history.find((row) => row.snapshot.control_plane.generated_at !== plane.generated_at && row.capability_score !== null) ?? null;
  const previousPlane = priorRecord?.snapshot.control_plane ?? null;
  const previous = previousPlane ? numeric(previousPlane) : null;
  const delta = current === null || previous === null ? null : current - previous;
  const components = intelligenceScoreComponents(plane.capabilities);
  const priorComponents = previousPlane ? new Map(intelligenceScoreComponents(previousPlane.capabilities).map((item) => [item.id, item])) : new Map();
  const movement = components.flatMap((component) => {
    const before = priorComponents.get(component.id);
    if (!before || !isMeasured(component.score) || !isMeasured(before.score)) return [];
    const change = component.score.score - before.score.score;
    return change === 0 ? [] : [{ label: component.label, change }];
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const measuredComponents = components.filter((item) => isMeasured(item.score)).sort((a, b) => (b.score as { score: number }).score - (a.score as { score: number }).score);
  const blockers = Array.from(new Set(components.flatMap((item) => item.blockers))).slice(0, 5);
  return {
    version: INTELLIGENCE_SCORE_VERSION,
    score: current,
    confidence: plane.overall_confidence,
    sample_size: isMeasured(plane.overall) ? plane.overall.sample_size : 0,
    previous,
    delta,
    trend: delta === null ? "insufficient_history" : delta > 0 ? "up" : delta < 0 ? "down" : "stable",
    last_material_movement_at: delta !== null && delta !== 0 ? plane.generated_at : priorRecord?.observed_at ?? null,
    movement_reasons: movement.slice(0, 4).map((item) => `${item.change > 0 ? "+" : ""}${item.change} ${item.label}`),
    strongest: measuredComponents.slice(0, 3).map((item) => item.label),
    weakest: [...measuredComponents].reverse().slice(0, 3).map((item) => item.label),
    blockers,
    components: components.map((item) => ({
      id: item.id,
      label: item.label,
      score: isMeasured(item.score) ? item.score.score : null,
      confidence: isMeasured(item.score) ? item.score.confidence : null,
      sample_size: isMeasured(item.score) ? item.score.sample_size : item.score.sample_size ?? 0,
      state: item.score.state,
      evidence: item.evidence_refs,
      main_blocker: item.blockers[0] ?? (isMeasured(item.score) ? null : item.score.reason),
    })),
  };
}
