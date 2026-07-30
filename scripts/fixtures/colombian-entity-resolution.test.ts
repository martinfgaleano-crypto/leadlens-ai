import { readFileSync } from "fs";
import {
  assessEntityCandidate, assessIdentity, attributeEvent, buildColombianIdentityProfile,
  classifyProviderHealth, enforceIdentityFirstCaps, entityResolutionOutput, identityAnchor,
  normalizeColombianCompanyName, planProviderQueries, sourceOwnerKey, verifyOfficialProperty,
} from "@/lib/intelligence/colombian-entity-resolution";

let pass = 0, fail = 0;
const t = (name: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${name}`); ok ? pass++ : fail++; };
const a = (kind: Parameters<typeof identityAnchor>[0]["kind"], strength: Parameters<typeof identityAnchor>[0]["strength"], supports = true) =>
  identityAnchor({ kind, strength, supports_identity: supports, value: kind, confidence: .9, evidence: [], reason: "fixture" });
const verified = a("verified_domain", "strong");
const moderate = a("city_category", "moderate");
const weak = a("name_similarity", "weak");
const conflict = a("conflicting_domain", "conflict", false);
const now = "2026-07-30T14:00:00.000Z";

const normalized = normalizeColombianCompanyName("Distribuidora Café Ágil S.A.S.");
t("1 suffix normalization preserves raw", normalized.raw_name.includes("S.A.S.") && normalized.comparison_name === "distribuidora cafe agil");
t("2 similar names never auto merge", assessEntityCandidate({ raw_name: "DAM", anchors: [weak] }).decision === "ambiguous");
t("3 domain is strong anchor", assessIdentity([verified]).state === "high_confidence");
t("4 conflicting domain blocks confirmation", assessIdentity([verified, moderate, conflict]).state === "ambiguous");
t("5 city plus category strengthens only", assessIdentity([moderate]).state === "ambiguous");
t("6 one weak cannot confirm", assessIdentity([weak]).state === "ambiguous");
t("7 many weak cannot equal strong", assessIdentity([weak, weak, weak]).state === "ambiguous");
const instagram = verifyOfficialProperty({ type: "instagram", url: "https://instagram.com/acme", verified_domain: "acme.co", anchors: [verified], verified_at: now });
t("8 official site and Instagram strengthen identity", instagram.state === "verified");
const profile = buildColombianIdentityProfile({ account_id: "a", commercial_name: "Acme", verified_domain: "acme.co", anchors: [verified, moderate], properties: [instagram], verified_at: now });
t("9 controlled properties share owner", sourceOwnerKey(profile, instagram) === "acme.co");
t("10 parent stays separate", assessEntityCandidate({ raw_name: "Acme Parent", relationship: "parent", anchors: [verified, moderate] }).decision === "high_confidence");
t("11 branch event not account wide", !attributeEvent({ account_id:"a",event_id:"e",identity_state:"confirmed",relationship:"branch",event_subject:"open",scope:"branch_level",event_date:now,event_status:"observed",source_owner:"x" }).signal_eligible);
t("12 distributor is relationship only", attributeEvent({ account_id:"a",event_id:"e",identity_state:"confirmed",relationship:"distributor",event_subject:"lists",scope:"relationship_only",event_date:now,event_status:"observed",source_owner:"x" }).state === "relationship_attributed");
t("13 marketplace does not confirm ownership", assessEntityCandidate({ raw_name:"Acme", relationship:"marketplace_seller", anchors:[weak] }).decision === "ambiguous");
t("14 wrong geography lowers identity", assessEntityCandidate({ raw_name:"Acme",location:"Lima",expected_city:"Bogotá" }).decision === "wrong_entity");
t("15 wrong category blocks identity", assessEntityCandidate({ raw_name:"Acme",category:"minería",expected_category:"bienestar" }).decision === "wrong_entity");
t("16 social ownership evidence required", verifyOfficialProperty({type:"instagram",url:"https://instagram.com/a",verified_domain:"a.co",anchors:[weak],verified_at:now}).state === "unresolved");
t("17 undated bio cannot create dated event", !attributeEvent({account_id:"a",event_id:"bio",identity_state:"confirmed",relationship:"same_company",event_subject:"bio",scope:"account_wide",event_status:"profile",source_owner:"a"}).signal_eligible);
t("18 dated official event may signal", attributeEvent({account_id:"a",event_id:"post",identity_state:"confirmed",relationship:"same_company",event_subject:"opening",scope:"account_wide",event_date:now,event_status:"observed",source_owner:"a"}).signal_eligible);
t("19 adversarial similar company rejected", assessEntityCandidate({raw_name:"Bio Plaza Chile",domain:"bioplaza.cl",verified_domain:"bioplaza.com.co"}).decision === "wrong_entity");
const iq = planProviderQueries({provider:"brave",stage:"identity",commercial_name:"Acme",verified_domain:"acme.co",city:"Bogotá",category:"bienestar"});
const eq = planProviderQueries({provider:"brave",stage:"event",commercial_name:"Acme",verified_domain:"acme.co",city:"Bogotá",category:"bienestar",event_term:"apertura"});
t("20 identity stage precedes event stage", iq.every(x=>x.stage==="identity") && eq.every(x=>x.stage==="event"));
t("21 unresolved gets no event budget", enforceIdentityFirstCaps({account_id:"a",identity_state:"unresolved",identity_queries:iq,event_queries:eq}).event_queries.length === 0);
t("22 provider query plans differ", planProviderQueries({provider:"tavily",stage:"identity",commercial_name:"Acme",verified_domain:null,city:"Bogotá",category:"bienestar"})[0].query !== iq[0].query);
t("23 HTTP400 classified bad request", classifyProviderHealth({provider:"serper",configured:true,status:400,error:"malformed",successes:0,attempts:1,probed_at:now,supported_tasks:[]}).state==="bad_request");
t("24 unhealthy Serper leaves fallback", !classifyProviderHealth({provider:"serper",configured:true,status:400,error:"malformed",successes:0,attempts:1,probed_at:now,supported_tasks:[]}).automatic_fallback);
t("25 quota Serper safely disabled", classifyProviderHealth({provider:"serper",configured:true,status:400,error:"Not enough credits",successes:0,attempts:1,probed_at:now,supported_tasks:[]}).state==="disabled");
t("26 provider health contains no key", !JSON.stringify(classifyProviderHealth({provider:"serper",configured:true,status:400,error:"malformed",successes:0,attempts:1,probed_at:now,supported_tasks:[]})).includes("API_KEY"));
t("27 attribution requires identity decision", !attributeEvent({account_id:"a",event_id:"e",identity_state:"unresolved",relationship:"same_company",event_subject:"x",scope:"account_wide",event_date:now,event_status:"observed",source_owner:"x"}).signal_eligible);
t("28 parent attribution labeled", attributeEvent({account_id:"a",event_id:"e",identity_state:"confirmed",relationship:"parent",event_subject:"x",scope:"parent_level",event_date:now,event_status:"observed",source_owner:"x"}).state==="parent_attributed");
t("29 relationship event not direct", !attributeEvent({account_id:"a",event_id:"e",identity_state:"confirmed",relationship:"retailer",event_subject:"x",scope:"relationship_only",event_date:now,event_status:"observed",source_owner:"x"}).signal_eligible);
t("30 direct requires scope and date", !attributeEvent({account_id:"a",event_id:"e",identity_state:"confirmed",relationship:"same_company",event_subject:"x",scope:"unknown",event_status:"observed",source_owner:"x"}).signal_eligible);
t("31 profile identity is deterministic", buildColombianIdentityProfile({account_id:"a",commercial_name:"Acme",anchors:[verified],verified_at:now}).profile_id === buildColombianIdentityProfile({account_id:"a",commercial_name:"Acme",anchors:[verified],verified_at:now}).profile_id);
t("32 output retains history refs", entityResolutionOutput({type:"identity_confirmation",account_id:"a",refs:["old","new"]}).refs.length===2);
t("33 ambiguity remains explicit", assessIdentity([moderate, moderate]).state==="probable");
t("34 tenant/client scope retained", buildColombianIdentityProfile({account_id:"a",client_id:"tenant",commercial_name:"Acme",verified_at:now}).client_id==="tenant");
t("35 internal output", entityResolutionOutput({type:"identity_ambiguity",account_id:"a",refs:[]}).internal_only);
const core = readFileSync("lib/intelligence/colombian-entity-resolution.ts","utf8");
t("36 ranking unchanged", entityResolutionOutput({type:"identity_confirmation",account_id:"a",refs:[]}).ranking_impact==="off");
t("37 outputs internal-only", /internal_only: true/.test(core));
t("38 no provider calls in resolution core", !/fetch\(|\.search\(/.test(core));
t("39 same-six caps enforced", enforceIdentityFirstCaps({account_id:"a",identity_state:"confirmed",identity_queries:[...iq,...iq,...iq],event_queries:[...eq,...eq,...eq],extraction_urls:Array(20).fill("u"),event_extraction_urls:Array(20).fill("e")}).identity_queries.length===5);
console.log(`\n${pass} passed, ${fail} failed`); if (fail) process.exit(1);
