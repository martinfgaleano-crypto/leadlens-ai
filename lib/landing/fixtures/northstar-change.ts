import type { ChangeVM, DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";

export interface LandingWhatChangedFixture {
  account: string;
  before: { decision: DecisionState; timing: Strength };
  change: ChangeVM;
  after: { decision: DecisionState; timing: Strength };
  reason: string;
  provenance: "illustrative_fixture";
  illustrative: true;
}

export const NORTHSTAR_WHAT_CHANGED: LandingWhatChangedFixture = {
  account: "Northstar Logistics",
  before: { decision: "monitor", timing: "Moderate" },
  change: {
    event: "Signed a regional distribution agreement",
    date: null,
    age: "9d ago",
    source: "Illustrative company announcement",
    kind: "true_change",
  },
  after: { decision: "prioritize", timing: "Strong" },
  reason: "A recent, corroborated expansion strengthens the timing case; procurement ownership still needs validation.",
  provenance: "illustrative_fixture",
  illustrative: true,
};
