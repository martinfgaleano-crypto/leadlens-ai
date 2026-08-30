// SELF-SERVE VALIDATION V1 — Stage A: bounded materiality-recall patch (§3/§4/§5).
// A verb-formed teaming agreement / joint venture / strategic partnership is a MATERIAL
// commercial event; generic legal/contract/"partners with customers" language is NOT —
// vocabulary alone never makes an event.

import assert from "node:assert/strict";
import { classifyMateriality } from "@/lib/discovery/materiality";
import { isMaterialEventClaim } from "@/lib/intelligence/evidence-materiality";

let passed = 0;
const t = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`ok - ${passed} ${name}`); };

// ── Positives (§5 A/B/C/F): real commercial-partnership changes are material events ──
const POSITIVE = [
  "Kamatics Corporation entered into an exclusive teaming agreement with Rotorcraft",
  "The company announced a strategic partnership with a major logistics provider",
  "Acme and Globex formed a joint venture to build a new plant",
  "Signed a multi-year distribution partnership agreement",
  "Established a strategic alliance with a regional distributor",
];
t("A/B/C teaming agreement / strategic partnership / joint venture are material", POSITIVE.every((c) => isMaterialEventClaim(c)));
t("A/B/C the same claims are non-low materiality", POSITIVE.every((c) => classifyMateriality(c).level !== "low"));
// F — an OLD teaming agreement is still a material event (recency is a separate concern).
t("F old teaming agreement remains a material event (historical)", isMaterialEventClaim("In 2019 the company entered into an exclusive teaming agreement"));

// ── Negatives (§4/§5 D/E): generic legal/partnership language is NOT material ──
const NEGATIVE = [
  "The customer agrees to the terms of the privacy policy",
  "By using the site you agree to our terms of service",
  "The existing supplier agreement remains in place",
  "This is a standard supplier agreement",
  "The company works in close partnership with its customers",
  "Delivered in partnership with our clients",
];
t("D/E generic agreement / privacy / partners-with-customers language is NOT material", NEGATIVE.every((c) => !isMaterialEventClaim(c)));
t("D/E the same negatives classify as low materiality", NEGATIVE.every((c) => classifyMateriality(c).level === "low"));

// ── Precision guard: static facts + non-events still rejected (no regression) ──
t("static facts still rejected", ["Company operates 25 facilities", "Serves 11 million customers daily", "Is the world's leading provider"].every((c) => !isMaterialEventClaim(c)));
t("genuine facility events still material (no regression)", ["Opened a new plant in Ohio", "Acquired a rival supplier", "Invested $50M in a new warehouse"].every((c) => isMaterialEventClaim(c)));

console.log(`\n${passed} passed, 0 failed`);
