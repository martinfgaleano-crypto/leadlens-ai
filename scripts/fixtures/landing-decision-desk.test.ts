// Landing Decision Desk (Sprint 4.5) — composition + contract guards.
import { readFileSync } from "node:fs";
let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const src = readFileSync("app/demo-pipeline/page.tsx", "utf8");

// §7 one persistent stage with question-based modes
t("§3 DecisionDesk component exists", /function DecisionDesk\(/.test(src));
t("§7 renders the three intelligence lenses as tabs (Why now / Evidence / Why this one)", /modeWhy/.test(src) && /modeEvidence/.test(src) && /modeCompare/.test(src));
t("§5 modes use user-language questions, localized", (src.match(/modeWhy: "/g) || []).length === 4);
t("§4 modes are a proper tablist (role=tab + aria-selected + keyboard)", /role="tablist"/.test(src) && /role="tab"/.test(src) && /aria-selected=\{on\}/.test(src) && /onTabKey/.test(src));

// §5/§7 the three previously-separate demos are now embedded in one surface
t("§7 the stacked WhatChanged/Evidence/Compare renders are replaced by <DecisionDesk />", /<DecisionDesk lang=\{lang\} \/>/.test(src) && !/<WhatChangedV2 lang=\{lang\} \/>\s*<EvidenceReasoning/.test(src));
t("§7 modes reuse the canonical components, embedded (no duplication)", /<WhatChangedV2 lang=\{lang\} embedded \/>/.test(src) && /<EvidenceReasoning lang=\{lang\} embedded \/>/.test(src) && /<CompareLens lang=\{lang\} embedded \/>/.test(src));
t("§7 embedded mode trims the component's own eyebrow/title (context is shared)", /embedded \? \{\} :/.test(src) && /\{!embedded &&/.test(src));

// §6/§16 persistent account context comes from the canonical comparison fixture (Northstar), not a new model
t("§16 persistent header uses canonical LANDING_COMPARISON account + DecisionPill + Strength", /LANDING_COMPARISON\.accounts\[0\]/.test(src) && /<DecisionPill state=\{acct\.decision\}/.test(src) && /STRENGTH\[val\]/.test(src));
t("§16 no new domain/score model introduced for the desk", !/deskScore|deskRank|computeDecision|recomputeRank/.test(src));

// §18/§17 isolation preserved
t("§18 no Account Memory import on landing", !/account-memory/.test(src));
t("§17 no provider/LLM import on landing", !/from "[^"]*(lib\/sources\/access|providers|anthropic|tavily|firecrawl|serper)/.test(src));

// §10 no aggregate score
t("§16 no NN/100 aggregate score anywhere", !/\d\s*\/\s*100/.test(src));

// reveal robustness (fast-scroll can't leave content hidden)
t("reveal observer also reveals elements already scrolled past (no stuck-hidden sections)", /boundingClientRect\.top < window\.innerHeight/.test(src));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
