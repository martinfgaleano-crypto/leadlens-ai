import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {NextRequest} from "next/server";
import {buildPilotOverviewWorkspace,buildSerializablePilotWorkspace,canonicalPilotId} from "../../lib/intelligence/pilot-workspace";
import {AMOR_PILOT1_FINAL,AMOR_PILOT1_FOUNDER_CHECKLIST} from "../../lib/intelligence/amor-de-gea-pilot1-finalization";
import {AMOR_V3R3} from "../../lib/intelligence/amor-de-gea-blueprint-v2-replay";
import {GET as downloadArtifact} from "../../app/api/admin/intelligence/pilots/[pilotId]/artifacts/[filename]/route";

assert.equal(canonicalPilotId("amor-de-gea"),"amor-de-gea");
assert.equal(canonicalPilotId("amor_de_gea"),"amor-de-gea");
assert.equal(canonicalPilotId("AMOR-DE-GEA"),null);
assert.equal(canonicalPilotId("missing"),null);
assert.equal(AMOR_V3R3.active_portfolio_size,10);
assert.equal(AMOR_PILOT1_FINAL.accounts.length,10);
assert.equal(AMOR_PILOT1_FINAL.provider_calls,0);
assert.equal(AMOR_PILOT1_FOUNDER_CHECKLIST.length,17);
const serializableWorkspace=buildSerializablePilotWorkspace();
const walk=(value:unknown):boolean=>typeof value==="function"?false:value&&typeof value==="object"?Object.values(value).every(walk):true;
assert(walk(serializableWorkspace));
assert.equal(serializableWorkspace.pilot.pilot_id,"amor-de-gea");
const overviewWorkspace=buildPilotOverviewWorkspace() as unknown as Record<string,unknown>;
assert(!("phase4" in overviewWorkspace));assert("accounts" in overviewWorkspace);assert("portfolio" in overviewWorkspace);

const layout=readFileSync("app/admin/_components/AdminLayout.tsx","utf8");
assert(!layout.includes('fetch("/api/admin/session"'));
assert(!layout.includes('return <div style={S.loading}>Loading...</div>'));
const page=readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot-experience.tsx","utf8");
assert(page.includes('activeSection === "overview" && <><Pilot1Finalization/>'));
const errorBoundary=readFileSync("app/admin/intelligence/pilots/[pilotId]/error.tsx","utf8");
assert(errorBoundary.includes("LeadLens could not load this pilot."));
assert(errorBoundary.includes("Retry"));
const finalization=readFileSync("app/admin/intelligence/pilots/[pilotId]/pilot1-finalization.tsx","utf8");
assert(!finalization.includes("/Users/"));
assert(finalization.includes("/api/admin/intelligence/pilots/amor-de-gea/artifacts/"));

async function main(){
  process.env.ADMIN_SECRET_TOKEN="pilot-loading-test-secret";
  const filename="Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf";
  const unauthorized=await downloadArtifact(new NextRequest(`http://localhost/api/admin/intelligence/pilots/amor-de-gea/artifacts/${filename}`),{params:{pilotId:"amor-de-gea",filename}});
  assert.equal(unauthorized.status,401);
  const authorized=await downloadArtifact(new NextRequest(`http://localhost/api/admin/intelligence/pilots/amor-de-gea/artifacts/${filename}`,{headers:{"x-admin-token":"pilot-loading-test-secret"}}),{params:{pilotId:"amor-de-gea",filename}});
  assert.equal(authorized.status,200);assert.equal(authorized.headers.get("content-type"),"application/pdf");
  const traversal=await downloadArtifact(new NextRequest("http://localhost/api/admin/intelligence/pilots/amor-de-gea/artifacts/bad",{headers:{"x-admin-token":"pilot-loading-test-secret"}}),{params:{pilotId:"amor-de-gea",filename:"../.env"}});
  assert.equal(traversal.status,404);
  console.log("amor pilot loading regression: ok");
}
void main();
