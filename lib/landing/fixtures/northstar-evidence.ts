// ─── Landing Evidence fixture (illustrative) ──────────────────────────────────
// Projects the SAME Northstar opportunity used by the What-Changed fixture and the
// Client Canvas sample — one coherent illustrative account, not a new universe
// (§18). Types are the canonical deliverable models (EvidenceRelation, Strength,
// EvidenceSummaryVM shape) so the marketing UI PROJECTS domain truth and never
// reinvents it (§1/§5). No score math, no confidence calculation: the read is the
// canonical Evidence strength + summary, nothing more (§6/§8).
import type { EvidenceRelation, Strength } from "@/lib/deliverable/deliverable-view-model";

export interface LandingEvidenceItem {
  relation: EvidenceRelation;   // direct | corroborating | context (canonical)
  sourceType: string;           // what kind of public source
  observation: string;          // what it shows (not a claim of live research)
  age: string;                  // freshness as surfaced by the canonical SourceVM
}

export interface LandingEvidenceFixture {
  account: string;
  thesis: string;               // AccountBriefVM.thesis
  claim: string;                // the material change the evidence supports
  items: LandingEvidenceItem[]; // ordered direct → corroborating → context
  // Canonical EvidenceSummaryVM projection — never a blended score.
  summary: { strength: Strength; corroborated: boolean; sourceCount: number; datedCount: number; latestAge: string };
  // Counterevidence / limitation is a first-class part of the read (§7).
  weakness: string;             // what weakens the case (limitation / open counter)
  validate: string;             // decision-critical validation that would resolve it
  provenance: "illustrative_fixture";
  illustrative: true;
}

export const NORTHSTAR_EVIDENCE: LandingEvidenceFixture = {
  account: "Northstar Logistics",
  thesis: "Northstar is building out regional distribution — plausibly widening its supplier and tooling needs before it formalizes procurement.",
  claim: "Signed a regional distribution agreement",
  items: [
    { relation: "direct", sourceType: "Company announcement", observation: "the distribution agreement itself", age: "9d" },
    { relation: "corroborating", sourceType: "Industry publication", observation: "new distribution sites reported independently", age: "12d" },
    { relation: "context", sourceType: "Careers page", observation: "4 operations roles opened", age: "15d" },
  ],
  summary: { strength: "Strong", corroborated: true, sourceCount: 3, datedCount: 3, latestAge: "9d" },
  weakness: "Procurement ownership is not confirmed — the buying decision may sit at group level.",
  validate: "Confirm whether regional purchasing is centralized before outreach.",
  provenance: "illustrative_fixture",
  illustrative: true,
};
