import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { identityAnchor, verifyOfficialProperty } from "@/lib/intelligence/colombian-entity-resolution";
const dir=join(process.cwd(),"ml/data/entity-resolution");
const name=readdirSync(dir).filter(x=>x.startsWith("amor-de-gea-block10-")).sort().at(-1)!;
const file=join(dir,name);
const artifact=JSON.parse(readFileSync(file,"utf8"));
for(const account of artifact.accounts){
  const anchor=identityAnchor({kind:"verified_domain",value:account.domain,strength:"strong",supports_identity:true,confidence:.99,evidence:[],reason:"Persisted verified account domain."});
  account.identity_profile.official_properties=[verifyOfficialProperty({type:"website",url:`https://${account.domain}`,verified_domain:account.domain,anchors:[anchor],profile_only:false,verified_at:artifact.generated_at})];
}
artifact.summary.official_properties=artifact.accounts.length;
artifact.reprocessed_at=new Date().toISOString();
artifact.reprocess_reason="Attach deterministic official website properties from persisted verified domains; zero provider calls.";
writeFileSync(file,JSON.stringify(artifact,null,2));
console.log(JSON.stringify({file,official_properties:artifact.summary.official_properties,provider_calls:0},null,2));
