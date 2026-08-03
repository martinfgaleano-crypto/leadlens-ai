import {readFileSync} from "fs";
import {buildAmorRealContextReview, AMOR_QUESTIONNAIRE_FINGERPRINT} from "@/lib/intelligence/amor-de-gea-real-context-review";
import {buildPilotWorkspace} from "@/lib/intelligence/pilot-workspace";

let passed=0,failed=0;
const test=(name:string,ok:boolean)=>{console.log(`${ok?"✅":"❌"} ${name}`);ok?passed++:failed++};
const review=buildAmorRealContextReview();
const by=(id:string)=>review.answers.find(answer=>answer.question_id===id)!;

test("1 all 17 client questions represented",review.answers.length===17&&new Set(review.answers.map(x=>x.question_id)).size===17);
test("2 source fingerprint preserved",review.answers.every(x=>x.source_fingerprint===AMOR_QUESTIONNAIRE_FINGERPRINT));
test("3 verbatim responses preserved",by("minimum_order").original_answer==="Mínimo 50 unidades para iniciar piloto, se espera crecer a 300 unidades mensuales en los siguientes 5 meses");
test("4 four missing remain missing",review.summary.missing===4&&["private_label","current_models","preferred_models","existing_partners"].every(id=>by(id).completion==="missing"));
test("5 ambiguous content remains unaccepted",review.summary.clarification_recommended===6&&review.invariants.context_accepted===false);
test("6 client statement is not independent evidence",review.answers.filter(x=>x.evidence_state==="client_statement").every(x=>x.evidence_state!=="independently_verified"));
test("7 marketing images remain unverified",review.marketing_materials.count===3&&review.marketing_materials.evidence_state==="client_marketing_material");
test("8 wholesale economics are preliminary",by("wholesale_price").customer_safe_impact.includes("No derivar")&&by("margin").operational_classification==="pending_non_blocking");
test("9 missing margin does not block discovery globally",by("margin").affected_routes.length===2&&by("margin").operational_classification==="pending_non_blocking");
test("10 route blocker is scoped",by("private_label").operational_classification==="route_specific_blocker"&&by("private_label").affected_routes.join()==="private_label");
test("11 customer-safe blocker is distinct",by("certifications").operational_classification==="customer_safe_blocker");
test("12 clarifications separated",review.clarification.before_acceptance.length===4&&review.clarification.later.length===4);
test("13 preview explicitly not applied",review.state==="preview_not_applied");
test("14 six-account preview complete",review.account_preview.length===6&&new Set(review.account_preview.map(x=>x.account)).size===6);
test("15 success contract represented",review.success_contract.value_dimensions.length===5&&review.success_contract.indicators.outcomes.includes("Ventas cuando existan"));
test("16 no context accepted",review.invariants.context_accepted===false);
test("17 no thesis recalculation",review.invariants.theses_recalculated===false);
test("18 no ranking change",review.invariants.ranking_changed===false);
test("19 no provider calls",review.invariants.provider_calls===false);
test("20 no customer-safe promotion",review.invariants.customer_safe_promoted===false);
test("21 workspace exposes review but keeps active context null",buildPilotWorkspace().contextReview.answers.length===17&&buildPilotWorkspace().pilot.active_context_version===null);
const core=readFileSync("lib/intelligence/amor-de-gea-real-context-review.ts","utf8");
test("22 review module makes no provider call",!/fetch\(|\.search\(|Serper|Tavily/.test(core));
const plan=readFileSync("LEADLENS_NEXT_90_DAYS_EXECUTION_PLAN.md","utf8");
test("23 Opportunity Facilitation remains documentation-only",plan.includes("LEADLENS OPPORTUNITY FACILITATION — PARKED STRATEGIC IDEA"));

console.log(`\n${passed} passed, ${failed} failed`);if(failed)process.exit(1);
