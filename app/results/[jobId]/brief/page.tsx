"use client";
// Institutional Brief loader. Reads the viewer's session token client-side and
// hands it to the server action, which performs ownership + assembly. Assembly
// and raw report_json stay server-side; this component only receives the
// curated report or an access decision.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getBriefForViewer, type BriefResult } from "./actions";
import BriefView from "./BriefView";

function Neutral({ text }: { text: string }) {
  return (
    <div style={{ maxWidth: 640, margin: "80px auto", padding: "0 20px", fontFamily: "-apple-system,sans-serif", textAlign: "center", color: "#64748b" }}>
      <p style={{ fontSize: 15 }}>{text}</p>
    </div>
  );
}

export default function BriefPage() {
  const jobId = useParams()?.jobId as string;
  const [result, setResult] = useState<BriefResult | null>(null);

  useEffect(() => {
    (async () => {
      let token: string | null = null;
      try {
        const supabase = getSupabaseClient();
        if (supabase) token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
      } catch { /* anonymous viewer */ }
      try {
        setResult(await getBriefForViewer(jobId, token));
      } catch {
        setResult({ state: "unavailable" });
      }
    })();
  }, [jobId]);

  if (!result) return <Neutral text="Preparing your brief…" />;
  switch (result.state) {
    case "ok": return <BriefView report={result.report} />;
    case "processing": return <Neutral text="Your brief is being generated. This can take a few minutes — refresh shortly." />;
    case "signin_required": return <Neutral text="Please sign in to view this brief." />;
    case "forbidden": return <Neutral text="This brief is not available." />;
    default: return <Neutral text="This brief is not available." />;
  }
}
