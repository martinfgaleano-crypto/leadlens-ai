import{readFileSync}from"fs";import{AMOR_PILOT_ID,buildPilotWorkspace,canonicalPilotId,dryRunPilotBackfill}from"@/lib/intelligence/pilot-workspace";
let p=0,f=0;const t=(n:string,o:boolean)=>{console.log(`${o?"✅":"❌"} ${n}`);o?p++:f++};const w=buildPilotWorkspace(),dry=dryRunPilotBackfill(w);
const pilotPage=readFileSync("app/admin/pilot/page.tsx","utf8"),workspacePage=readFileSync("app/admin/intelligence/pilots/[pilotId]/page.tsx","utf8"),api=readFileSync("app/api/admin/intelligence/pilots/[pilotId]/intake/route.ts","utf8"),core=readFileSync("lib/intelligence/pilot-workspace.ts","utf8");
[
 ["1 Admin link canonical",pilotPage.includes("/admin/intelligence/pilots/amor-de-gea")],
 ["2 stable pilot id",AMOR_PILOT_ID==="amor-de-gea"],["3 legacy maps",canonicalPilotId("pilot-amor-de-gea")==="amor-de-gea"],
 ["4 missing not found",canonicalPilotId("missing")===null&&workspacePage.includes("notFound")],
 ["5 partial not blank",!!w.availability.message&&!!w.overview.diagnosis],["6 DB explicit",w.availability.database==="unverified"],
 ["7 no runtime dependency",!core.includes(".leadlens")],["8 dry no writes",dry.writes===0],["9 idempotent",dryRunPilotBackfill(w).idempotency_key===dry.idempotency_key],
 ["10 no synthetic",dry.synthetic_answers===0],["11 six accounts",w.accounts.length===6],["12 six theses",w.theses.length===6],
 ["13 questions",w.questions.length===17],["14 blockers",w.overview.critical_blockers===10],["15 draft inactive",api.includes("context_activated:false")],
 ["16 submit review",api.includes("review_required")],["17 baseline explicit",core.includes("active_context_version:null")],["18 history preserved",!api.includes('.from("intelligence_client_intakes").update(')],
 ["19 no provider recalc",!api.includes("provider")],["20 no provider render",!core.includes("fetch(")&&!core.includes(".search(")],
 ["21 thesis versions",w.theses.every((x:any)=>x.thesis_id)],["22 originals",w.theses.every((x:any)=>x.review_state==="unreviewed")],
 ["23 internal approval not safe",w.overview.customer_safe===0],["24 safety visible",w.safety.length===6],["25 no timing",w.accounts.every((x:any)=>x.why_now.state==="no_current_timing")],
 ["26 unknown not zero",workspacePage.includes("insufficient_context")],["27 feasibility resolves",w.feasibility.every((x:any)=>x.dimensions.every((d:any)=>d.next_verification))],
 ["28 section independent",new Set(w.sections.map((x:any)=>x.state)).size>1],["29 report disabled",w.final_report_generation==="disabled"&&workspacePage.includes("Final report generation remains disabled")],
 ["30 activity",w.activity.some(x=>x.event_type==="pilot_reconciled")],["31 tenant derived",!api.includes("tenant_id:z")],["32 reviewer derived",api.includes('supplied_by:"active_admin_session"')],
 ["33 Admin required",api.includes("requireAdmin(req)")],["34 no customer route",!workspacePage.includes("/dashboard")],["35 service key server only",!workspacePage.includes("SUPABASE_SERVICE")],
 ["36 no providers",!/tavilyProvider|braveProvider|serperProvider/.test(core+workspacePage)],["37 no hidden reasoning",!JSON.stringify(w).includes("chain-of-thought")],
 ["38 Block12 truth",w.questions.length===17&&w.overview.context_completeness===0],["39 decisions",w.overview.decisions.prioritize===4&&w.overview.decisions.monitor===2],
 ["40 entities",w.accounts.every((x:any)=>x.identity)],["41 zero signals",w.overview.signals===0],["42 evidence honest",w.overview.evidence_coverage.includes("incomplete")],
 ["43 shortlist",w.shortlist.length===6],["44 fail closed",api.includes("if(denied)return denied")],["45 ranking off",w.ranking_impact==="off"],
 ["46 final checklist later",w.checklist.at(-1)?.status==="pending"],["47 artifacts bundled",w.availability.canonical_artifacts==="available"],
 ["48 sections",["context","accounts","theses","feasibility","readiness","activity"].every(x=>workspacePage.includes(`id="${x}"`))],
].forEach(([n,o])=>t(String(n),Boolean(o)));console.log(`\n${p} passed, ${f} failed`);if(f)process.exit(1);
