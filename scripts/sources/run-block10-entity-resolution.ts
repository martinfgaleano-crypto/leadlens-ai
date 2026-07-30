import { loadEnvConfig } from "@next/env";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { braveProvider, tavilyProvider } from "@/lib/sources/access/providers";
import {
  attributeEvent, buildColombianIdentityProfile, enforceIdentityFirstCaps, identityAnchor,
  planProviderQueries, verifyOfficialProperty, type ProviderQuery,
} from "@/lib/intelligence/colombian-entity-resolution";

loadEnvConfig(process.cwd());
const root = process.cwd();
const rqDir = join(root, "ml/data/research-quality");
const sourceName = readdirSync(rqDir).filter(x => x.endsWith(".json")).sort().at(-1)!;
const source = JSON.parse(readFileSync(join(rqDir, sourceName), "utf8")) as {
  accounts: Array<{ account: string; domain: string; profile: { profile_id: string; city_or_region: string | null; business_type: string; known_products_or_services: string[] } }>;
};
const providers = { brave: braveProvider, tavily: tavilyProvider };

async function execute(q: ProviderQuery) {
  const provider = providers[q.provider as keyof typeof providers];
  if (!provider) return null;
  return provider.search({ query: q.query, language: "es", region: "co", max_results: 5, query_type: q.stage === "event" || q.stage === "counterevidence" ? "signal_specific" : "company_specific", freshness_days: q.stage === "event" ? 730 : undefined });
}

async function main() {
  const started = new Date().toISOString();
  const accounts = [];
  let searches = 0, results = 0, dated = 0, direct = 0;
  for (const item of source.accounts.slice(0, 6)) {
    const identityQueries = [
      ...planProviderQueries({ provider:"brave",stage:"identity",commercial_name:item.account,verified_domain:item.domain,city:item.profile.city_or_region,category:item.profile.business_type }),
      ...planProviderQueries({ provider:"tavily",stage:"identity",commercial_name:item.account,verified_domain:item.domain,city:item.profile.city_or_region,category:item.profile.business_type }),
    ].slice(0, 5);
    const identityResponses = (await Promise.all(identityQueries.map(execute))).filter(Boolean);
    searches += identityResponses.length;
    const exactDomainResults = identityResponses.flatMap(r => r!.results).filter(r => r.canonical_url.includes(item.domain));
    results += identityResponses.reduce((n,r)=>n+r!.results.length,0);
    const domainAnchor = identityAnchor({ kind:"verified_domain",value:item.domain,strength:"strong",supports_identity:true,confidence:.99,evidence:[],reason:"Persisted verified account domain." });
    const recoveredAnchor = exactDomainResults.length ? identityAnchor({ kind:"contact_page",value:exactDomainResults[0].canonical_url,strength:"moderate",supports_identity:true,confidence:.82,evidence:[],reason:"Provider recovered content on the persisted verified domain." }) : null;
    const website = verifyOfficialProperty({ type:"website",url:`https://${item.domain}`,verified_domain:item.domain,anchors:[domainAnchor],profile_only:false,verified_at:started });
    const profile = buildColombianIdentityProfile({
      account_id:item.profile.profile_id,client_id:"amor-de-gea",commercial_name:item.account,verified_domain:item.domain,
      city:item.profile.city_or_region,category:item.profile.business_type,products_services:item.profile.known_products_or_services,
      anchors:[domainAnchor,...(recoveredAnchor?[recoveredAnchor]:[])],properties:[website],verified_at:started,
    });
    const eventQueries = [
      ...planProviderQueries({provider:"brave",stage:"event",commercial_name:item.account,verified_domain:item.domain,city:item.profile.city_or_region,category:item.profile.business_type,event_term:"apertura expansión alianza lanzamiento"}),
      ...planProviderQueries({provider:"tavily",stage:"counterevidence",commercial_name:item.account,verified_domain:item.domain,city:item.profile.city_or_region,category:item.profile.business_type,negative_terms:["cierre","inactiva","cancelada"]}),
    ];
    const plan = enforceIdentityFirstCaps({account_id:item.profile.profile_id,identity_state:profile.identity_state,identity_queries:identityQueries,event_queries:eventQueries});
    const eventResponses = (await Promise.all(plan.event_queries.map(execute))).filter(Boolean);
    searches += eventResponses.length;
    results += eventResponses.reduce((n,r)=>n+r!.results.length,0);
    const attributions = eventResponses.flatMap(r => r!.results).map((r,i) => {
      if (r.published_date) dated++;
      const attr = attributeEvent({
        account_id:item.profile.profile_id,event_id:`${r.provider}:${i}:${r.canonical_url}`,identity_state:profile.identity_state,
        relationship:"same_company",event_subject:r.title ?? "External result",scope:r.canonical_url.includes(item.domain)?"account_wide":"unknown",
        event_date:r.published_date,event_status:"observed",source_owner:r.canonical_url,
      });
      if (attr.signal_eligible) direct++;
      return { ...attr, url:r.canonical_url, provider:r.provider, rejection:attr.signal_eligible?null:attr.limitations };
    });
    accounts.push({
      account:item.account,domain:item.domain,identity_profile:profile,identity_queries:identityQueries,
      identity_results:identityResponses.flatMap(r=>r!.results),execution_plan:plan,event_attributions:attributions,
      explanation:{verdict:profile.identity_state,confirmed_anchors:profile.confirmed_anchors.map(a=>a.kind),conflicting_anchors:[],missing_anchors:profile.unresolved_identity_questions,next_action:profile.identity_state==="confirmed"?"Review directly attributable dated events.":"Recover a company-controlled contact or social-property anchor."},
    });
  }
  const summary = {
    accounts:accounts.length,identity_queries:accounts.reduce((n,a)=>n+a.identity_queries.length,0),searches,extractions:0,results,
    confirmed:accounts.filter(a=>a.identity_profile.identity_state==="confirmed").length,
    high_confidence:accounts.filter(a=>a.identity_profile.identity_state==="high_confidence").length,
    probable:accounts.filter(a=>a.identity_profile.identity_state==="probable").length,
    unresolved:accounts.filter(a=>["unresolved","ambiguous"].includes(a.identity_profile.identity_state)).length,
    verified_domains:accounts.length,official_properties:accounts.reduce((n,a)=>n+a.identity_profile.official_properties.filter(p=>p.state==="verified").length,0),event_eligible:accounts.filter(a=>a.execution_plan.event_queries.length>0).length,
    dated_event_results:dated,directly_attributable_events:direct,valid_signals:direct,
    provider_health:{serper:{state:"disabled",reason:"HTTP 400 Not enough credits",automatic_fallback:false},brave:{state:"configured"},tavily:{state:"configured"}},
    cost:{state:"not_measured",reason:"Provider adapters returned no per-request cost."},
  };
  const artifact = { methodology_version:"colombian-entity-resolution-v1",generated_at:new Date().toISOString(),source_research_artifact:sourceName,limits:{accounts:6,max_identity_queries_per_account:5,max_identity_extractions_total:12,max_event_queries_per_eligible_account:3,max_event_extractions_total:8},summary,accounts,internal_only:true,ranking_impact:"off",report_impact:"off" };
  const outDir=join(root,"ml/data/entity-resolution"); mkdirSync(outDir,{recursive:true});
  const out=join(outDir,`amor-de-gea-block10-${artifact.generated_at.replace(/[:.]/g,"-")}.json`);
  writeFileSync(out,JSON.stringify(artifact,null,2));
  console.log(JSON.stringify({out,summary},null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
