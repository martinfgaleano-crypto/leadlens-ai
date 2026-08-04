"use client";
import Link from "next/link";

export default function PilotError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  const code=error.digest?`PILOT-${error.digest.slice(0,8)}`:"PILOT-RENDER";
  return <main role="alert" style={{maxWidth:720,margin:"4rem auto",padding:"2rem",border:"1px solid #fecaca",borderRadius:16,background:"#fff7f7",fontFamily:"system-ui"}}>
    <h1 style={{marginTop:0,color:"#991b1b"}}>LeadLens could not load this pilot.</h1>
    <p>Retry the page or return to Pilots. The pilot data and delivery files were not modified.</p>
    <p><small>Diagnostic code: {code}</small></p>
    <div style={{display:"flex",gap:12}}><button onClick={reset} style={{padding:".7rem 1rem"}}>Retry</button><Link href="/admin/intelligence" style={{padding:".7rem 1rem"}}>Back to Pilots</Link></div>
  </main>;
}
