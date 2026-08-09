import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {POST} from "../../app/api/admin/operations/providers/route";
import {probeAll,probeOne} from "../../lib/ops/provider-health";
import {getUsage} from "../../lib/ops/usage-ledger";
import {signAdminSession} from "../../lib/auth/admin-session";

let passed=0,failed=0;
const test=async(name:string,fn:()=>unknown|Promise<unknown>)=>{try{await fn();console.log(`✅ ${name}`);passed++;}catch(error){console.error(`❌ ${name}`,error);failed++;}};
const original={fetch:global.fetch,anthropic:process.env.ANTHROPIC_API_KEY,admin:process.env.ADMIN_SESSION_SECRET};
const calls:string[]=[];
process.env.ANTHROPIC_API_KEY="test-anthropic-secret";
process.env.ADMIN_SESSION_SECRET="test-admin-session-secret";
global.fetch=async(input)=>{calls.push(String(input));return new Response(JSON.stringify({content:[{type:"text",text:"ok"}]}),{status:200,headers:{"content-type":"application/json"}});};

async function main(){
  await test("cold provider health is network-free",async()=>{calls.length=0;const statuses=await probeAll(false);assert.equal(calls.length,0);assert.equal(statuses.find(status=>status.id==="anthropic")?.state,"not_tested");});
  await test("invalid provider target rejected without network",async()=>{calls.length=0;assert.equal(await probeOne("not-a-provider",true),null);assert.equal(calls.length,0);});
  await test("unauthorized single probe blocked",async()=>{calls.length=0;const response=await POST(new NextRequest("http://localhost/api/admin/operations/providers",{method:"POST",body:JSON.stringify({provider:"anthropic"}),headers:{"content-type":"application/json"}}));assert.equal(response.status,401);assert.equal(calls.length,0);});
  await test("invalid route target returns 400 without network",async()=>{calls.length=0;const cookie=signAdminSession({sub:"admin-test",role:"admin"},process.env.ADMIN_SESSION_SECRET!);const response=await POST(new NextRequest("http://localhost/api/admin/operations/providers",{method:"POST",body:JSON.stringify({provider:"not-a-provider"}),headers:{"content-type":"application/json",cookie:`ll_admin_session=${cookie}`}}));assert.equal(response.status,400);assert.equal(calls.length,0);});
  await test("authenticated Anthropic probe is isolated and normalized",async()=>{calls.length=0;const cookie=signAdminSession({sub:"admin-test",role:"admin"},process.env.ADMIN_SESSION_SECRET!);const response=await POST(new NextRequest("http://localhost/api/admin/operations/providers",{method:"POST",body:JSON.stringify({provider:"anthropic"}),headers:{"content-type":"application/json",cookie:`ll_admin_session=${cookie}`}}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.status.id,"anthropic");assert.equal(body.status.state,"ok");assert.equal(calls.length,1);assert.match(calls[0],/api\.anthropic\.com/);assert(!calls.some(url=>/exa|sam\.gov|sec\.gov|tavily|brave|firecrawl|serper/i.test(url)));});
  await test("Anthropic probe records ledger",()=>{const usage=getUsage().anthropic;assert(usage&&usage.calls_today>=1&&usage.last_success);});
  await test("response and failures never leak credential",async()=>{assert(!JSON.stringify(await probeOne("anthropic",false)).includes("test-anthropic-secret"));});
  await test("failed probe is nonfatal and redacted",async()=>{global.fetch=async(input)=>{calls.push(String(input));return new Response(JSON.stringify({error:"test-anthropic-secret"}),{status:401});};const status=await probeOne("anthropic",true);assert.equal(status?.state,"invalid");assert(!JSON.stringify(status).includes("test-anthropic-secret"));});
  console.log(`\n${passed} passed, ${failed} failed`);
  if(failed)process.exit(1);
}

main().catch(error=>{console.error(error);process.exit(1);}).finally(()=>{
  global.fetch=original.fetch;
  if(original.anthropic===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=original.anthropic;
  if(original.admin===undefined)delete process.env.ADMIN_SESSION_SECRET;else process.env.ADMIN_SESSION_SECRET=original.admin;
});
