import assert from "node:assert/strict";
import { buildRetailLiveArtifact, classifyRetailResult, RETAIL_LIVE_BENCHMARK_ID } from "@/lib/discovery/source-intelligence/retail-live-execution";
const now="2026-08-09T00:00:00.000Z";
const result=(url:string,title:string,snippet:string)=>({url,canonical_url:url,title,snippet,published_date:null,retrieved_at:now,source_type:null,provider:"fixture",rank:1,locale:"es"});
const rows=[result("https://tiendauno.co/catalogo","Tienda Uno | Catálogo","Tienda multimarca con productos y marcas"),result("https://tiendauno.co/sedes/cali","Nuestras tiendas Cali","Punto de venta"),result("https://mercadolibre.com.co/vendedor/x","Vendedor X","Marketplace seller"),result("https://example.com/blog/mejores-tiendas","Las mejores tiendas","Artículo y guía")];
assert.equal(classifyRetailResult(rows[0]),"retailer"); assert.equal(classifyRetailResult(rows[2]),"marketplace_seller"); assert.equal(classifyRetailResult(rows[3]),"article");
const artifact=buildRetailLiveArtifact([{provider:"fixture",source_id:"fixture",cohort:"search_first",query:"q",purpose:"test",response:{ok:true,latency_ms:1,cost_estimate_usd:null,error:null,results:rows}}],[{provider:"fixture",purpose:"test",query:"q",timestamp:now,success:true,latency_ms:1,result_count:4,estimated_cost_usd:null,safe_error:null}],now);
assert.equal(artifact.id,RETAIL_LIVE_BENCHMARK_ID); assert.equal(artifact.live_execution,true); assert.equal(artifact.data_basis,"live_provider"); assert.equal(artifact.metrics.buying_intent_inferred,0); assert.ok(artifact.metrics.location_inflation_ratio>1); assert.equal(artifact.budget.within_budget,true); assert.equal(artifact.source_performance_snapshots[0].outcome_state,"awaiting_real_outcomes");
console.log("discovery-engine-v2-5-retail-live: 10/10 passed");
