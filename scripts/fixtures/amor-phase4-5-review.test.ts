import assert from "node:assert/strict";
import { AMOR_PHASE4_PORTFOLIO } from "../../lib/intelligence/amor-de-gea-phase4-intelligence";
import { AMOR_PHASE45_ACCOUNT_REVIEWS as reviews, AMOR_PHASE45_PACKET as packet, AMOR_PHASE45_REVIEW_VERSION as version, AMOR_PHASE45_ROUTE_REVIEW as routes } from "../../lib/intelligence/amor-de-gea-phase4-5-review";
import { buildPilotWorkspace } from "../../lib/intelligence/pilot-workspace";
const tests:Array<[string,()=>void]>=[
 ["all 15 reviewed",()=>assert.equal(reviews.length,15)],
 ["V3 preserved",()=>assert.equal(AMOR_PHASE4_PORTFOLIO.length,15)],
 ["V3R separate",()=>assert.equal(version.version,"V3R")],
 ["one verdict each",()=>assert.equal(new Set(reviews.map(x=>x.review_id)).size,15)],
 ["reasons",()=>assert.ok(reviews.every(x=>x.reason.length>20))],
 ["evidence retained",()=>assert.ok(reviews.every(x=>x.evidence.facts.length>0))],
 ["counterevidence",()=>assert.ok(reviews.every(x=>x.counterevidence.length>0))],
 ["uncertainty",()=>assert.ok(reviews.every(x=>x.uncertainty.length>0))],
 ["next validation",()=>assert.ok(reviews.every(x=>x.next_validation.length>0))],
 ["work first gate",()=>assert.ok(reviews.filter(x=>x.final_group==="work_first").every(x=>x.identity_state==="active_official_site"))],
 ["no ACT NOW",()=>assert.ok(reviews.every(x=>!x.verdict.includes("ACT NOW")))],
 ["brief readiness",()=>assert.equal(packet.action_briefs_ready.length,4)],
 ["route conclusions",()=>assert.equal(routes.length,4)],
 ["redundancy assessed",()=>assert.ok(packet.redundancy.length>20)],
 ["portfolio shrinks",()=>assert.equal(packet.final_recommended_portfolio_size,11)],
 ["no route quotas",()=>assert.ok(packet.final_recommended_portfolio_size<15)],
 ["conflict visible",()=>assert.ok(reviews.every(x=>x.conflict_check.confirmation_state==="founder_confirmation_required"))],
 ["internal only",()=>assert.equal(packet.customer_safe,false)],
 ["no final report",()=>assert.equal(packet.final_report_created,false)],
 ["no outreach",()=>assert.equal(packet.outreach_started,false)],
 ["no broad search",()=>assert.equal(packet.provider_calls_consumed,0)],
 ["no provider calls",()=>assert.equal(version.provider_calls,0)],
 ["no CRM",()=>assert.equal(packet.crm_created,false)],
 ["no facilitation",()=>assert.equal(packet.phase5_authorized,false)],
 ["workspace exposes V3R",()=>assert.equal(buildPilotWorkspace().phase45.AMOR_PHASE45_REVIEW_VERSION.version,"V3R")],
 ["internal workspace",()=>assert.equal(buildPilotWorkspace().internal_only,true)],
];
let passed=0;for(const [name,test] of tests){try{test();console.log(`✅ ${name}`);passed++}catch(error){console.error(`❌ ${name}`,error);process.exitCode=1}}console.log(`\n${passed} passed, ${tests.length-passed} failed`);
