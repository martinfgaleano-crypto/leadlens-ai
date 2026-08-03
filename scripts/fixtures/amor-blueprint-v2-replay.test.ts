import assert from "node:assert/strict";
import * as v from "../../lib/intelligence/amor-de-gea-blueprint-v2-replay";
import { AMOR_SEARCH_BLUEPRINT } from "../../lib/intelligence/amor-de-gea-search-blueprint";
const tests:[string,()=>void][]=[
 ["V2 approved only for replay",()=>{assert.equal(v.AMOR_BLUEPRINT_V2_APPROVAL.status,"APPROVED FOR DETERMINISTIC REPLAY");assert.equal(v.AMOR_BLUEPRINT_V2_APPROVAL.provider_search_approved,false)}],
 ["context and V1 preserved",()=>{assert.equal(v.AMOR_BLUEPRINT_V2_APPROVAL.accepted_context_id,"context_28bbc2b447323da3e387c964");assert.equal(v.AMOR_BLUEPRINT_V2_APPROVAL.preserves_blueprint_v1,AMOR_SEARCH_BLUEPRINT.blueprint_id)}],
 ["30 fields covered",()=>{assert.equal(v.AMOR_V2_FIELD_COVERAGE.length,30);assert.ok(v.AMOR_V2_FIELD_COVERAGE.every(x=>x.state!=="unused"&&x.rule_ids.length))}],
 ["active executable rules",()=>{assert.ok(v.AMOR_V2_RULES.length>=20);assert.ok(v.AMOR_V2_RULES.every(x=>x.active&&x.logic&&x.fields.length&&x.evidence))}],
 ["15 queries traced",()=>{assert.equal(v.AMOR_V2_QUERY_TRACE.length,15);assert.ok(v.AMOR_V2_QUERY_TRACE.every(x=>x.rule_ids.length&&x.expected_mechanism))}],
 ["generic queries revised",()=>assert.ok(v.AMOR_V2_QUERY_TRACE.filter(x=>x.revised_or_removed).length>=5)],
 ["all checkpoint and enriched candidates replayed",()=>{assert.ok(v.AMOR_V2_REPLAY.length>=56);assert.ok(v.AMOR_V2_REPLAY.every(x=>x.decision&&x.rationale&&x.counterfactual.A&&x.not_applicable))}],
 ["rule states",()=>assert.ok(v.AMOR_V2_REPLAY.every(x=>x.passed&&x.failed&&x.conditioned&&x.not_applicable))],
 ["BioPlaza independently removed",()=>assert.equal(v.AMOR_V2_REPLAY.find(x=>x.account==="BioPlaza")?.decision,"insufficient evidence")],
 ["DAM independently monitored",()=>assert.equal(v.AMOR_V2_REPLAY.find(x=>x.account==="Distribuidora DAM")?.decision,"monitor")],
 ["V3R3 separate and V3R2 preserved",()=>{assert.equal(v.AMOR_V3R3.preserves_v3r2,true);assert.equal(v.AMOR_V3R3.status,"INTERNAL FOUNDER REVIEW")}],
 ["buyer path changes action",()=>assert.ok(v.AMOR_V2_REPLAY.filter(x=>x.route!=="unknown").every(x=>x.buyer_path.includes("validate")&&x.buyer_path.includes("before offering")))],
 ["no invented timing",()=>assert.ok(v.AMOR_V2_REPLAY.every(x=>["likely shorter-cycle","medium-cycle","long-cycle","unknown"].includes(x.commercial_cycle)))],
 ["provider calls zero by scope",()=>assert.equal(v.AMOR_BLUEPRINT_V2_APPROVAL.provider_search_approved,false)],
 ["customer safe and client delivery blocked",()=>{assert.equal(v.AMOR_V3R3.customer_safe,false);assert.equal(v.AMOR_V3R3.approved,false)}],
 ["rule impact complete",()=>assert.equal(v.AMOR_V2_RULE_IMPACT.length,v.AMOR_V2_RULES.length)],
];
for(const [name,test] of tests){try{test()}catch(error){throw new Error(`${name}: ${error instanceof Error?error.message:String(error)}`)}}
