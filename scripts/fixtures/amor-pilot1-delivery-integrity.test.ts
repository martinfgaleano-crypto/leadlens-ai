import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {NextRequest} from "next/server";
import {AMOR_V3R3} from "../../lib/intelligence/amor-de-gea-blueprint-v2-replay";
import {AMOR_PILOT1_FINAL,AMOR_PILOT1_FOUNDER_CHECKLIST} from "../../lib/intelligence/amor-de-gea-pilot1-finalization";
import {AMOR_PILOT1_DELIVERABLES,AMOR_PILOT1_DELIVERY_MANIFEST,AMOR_PILOT1_DELIVERY_STATES,AMOR_PILOT1_HISTORICAL_ARTIFACTS,pilot1ArtifactIdForFilename,resolvePilot1Artifact} from "../../lib/intelligence/amor-de-gea-pilot1-delivery";
import {GET as downloadArtifact} from "../../app/api/admin/intelligence/pilots/[pilotId]/artifacts/[filename]/route";

const active=["Éteka","Celestino Hotel Boutique & Spa","Sinergy On","Vitálica","Ser Saludable","Masaya Collection","Natural + Mente","Hotel Charleston Santa Teresa Spa","Habibi Plantitas","Funat"];
const obsolete=["BioPlaza","Distribuidora DAM","Hotel Spa La Colina","Tu Tienda Saludable","Somos Consiente"];
assert.equal(AMOR_V3R3.active_portfolio_size,10);
assert.deepEqual(AMOR_PILOT1_FINAL.accounts.map(account=>account.name),active);
for(const account of obsolete)assert(!AMOR_PILOT1_FINAL.accounts.some(candidate=>candidate.name===account));
assert.equal(AMOR_PILOT1_FINAL.provider_calls,0);
assert.equal(AMOR_PILOT1_FINAL.pilot2.state,"PLANNED — NOT AUTHORIZED");

assert.equal(Object.keys(AMOR_PILOT1_DELIVERABLES).length,4);
assert.equal(AMOR_PILOT1_DELIVERY_MANIFEST.length,4);
assert.equal(AMOR_PILOT1_DELIVERY_MANIFEST.filter(item=>item.artifactId==="pilot1-final-report").length,1);
assert.equal(resolvePilot1Artifact("pilot1-final-report")?.filename,"Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf");
assert.equal(pilot1ArtifactIdForFilename("Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf"),"pilot1-final-report");
assert.equal(resolvePilot1Artifact("amor-de-gea-internal-pilot-brief-v3"),null);
assert.equal(AMOR_PILOT1_HISTORICAL_ARTIFACTS[0].type,"internal_historical_brief");
assert.equal(AMOR_PILOT1_HISTORICAL_ARTIFACTS[0].customerSafe,false);
assert.equal(AMOR_PILOT1_HISTORICAL_ARTIFACTS[0].accountCount,6);
assert.equal(AMOR_PILOT1_DELIVERY_STATES.pilot,"founder_review_required");
assert.equal(AMOR_PILOT1_DELIVERY_STATES.feedbackDocument,"ready_for_delivery");
assert.equal(AMOR_PILOT1_FOUNDER_CHECKLIST.length,17);

for(const item of AMOR_PILOT1_DELIVERY_MANIFEST){
  const bytes=readFileSync(`public/pilot-deliverables/${item.filename}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),item.sha256);
  assert(!item.filename.includes("/Users/"));
}

const ui=readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot1-finalization.tsx","utf8");
for(const value of ["PILOT 1 DELIVERY CENTER","ENVIAR A AMOR DE GEA","10","4","17","pilot1-final-report"])assert(ui.includes(value));
assert.equal(AMOR_PILOT1_HISTORICAL_ARTIFACTS[0].warning,"OBSOLETO - NO ENVIAR");
assert(!ui.includes('href="/api/admin/intelligence/pilots/amor-de-gea/pdf">Descargar informe interno'));

async function main(){
  process.env.ADMIN_SECRET_TOKEN="delivery-integrity-test";
  const headers={"x-admin-token":"delivery-integrity-test"};
  for(const [id,artifact] of Object.entries(AMOR_PILOT1_DELIVERABLES)){
    const response=await downloadArtifact(new NextRequest(`http://localhost/api/admin/intelligence/pilots/amor-de-gea/artifacts/${id}`,{headers}),{params:{pilotId:"amor-de-gea",filename:id}});
    assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),artifact.mime);assert.match(response.headers.get("content-disposition")??"",new RegExp(artifact.filename));assert.equal(response.headers.get("x-leadlens-artifact-integrity"),"verified");
  }
  const preview=await downloadArtifact(new NextRequest("http://localhost/api/admin/intelligence/pilots/amor-de-gea/artifacts/pilot1-final-report?preview=1",{headers}),{params:{pilotId:"amor-de-gea",filename:"pilot1-final-report"}});assert.match(preview.headers.get("content-disposition")??"",/^inline/);
  const old=await downloadArtifact(new NextRequest("http://localhost/api/admin/intelligence/pilots/amor-de-gea/artifacts/amor-de-gea-internal-pilot-brief-v3",{headers}),{params:{pilotId:"amor-de-gea",filename:"amor-de-gea-internal-pilot-brief-v3"}});assert.equal(old.status,404);assert.match(await old.text(),/regeneration required/);
  const wrongPilot=await downloadArtifact(new NextRequest("http://localhost/api/admin/intelligence/pilots/other/artifacts/pilot1-final-report",{headers}),{params:{pilotId:"other",filename:"pilot1-final-report"}});assert.equal(wrongPilot.status,404);
  console.log("amor pilot1 delivery integrity: ok");
}
void main();
