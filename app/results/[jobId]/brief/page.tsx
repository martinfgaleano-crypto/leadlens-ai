// Institutional Opportunity Brief — SERVER component.
// Assembles the curated institutional report server-side from the snapshot,
// so raw report_json (internal _versions, processed_leads, learning metadata)
// never reaches the browser. Same link-access model as /results/[jobId]
// (jobId is the capability; a missing/unknown job renders a neutral state that
// does not confirm existence). Does not replace /results/[jobId].

import { getSnapshot } from "@/lib/storage/snapshot-store";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import BriefView from "./BriefView";

export const dynamic = "force-dynamic";

function Neutral({ text }: { text: string }) {
  return (
    <div style={{ maxWidth: 640, margin: "80px auto", padding: "0 20px", fontFamily: "-apple-system,sans-serif", textAlign: "center", color: "#64748b" }}>
      <p style={{ fontSize: 15 }}>{text}</p>
    </div>
  );
}

export default async function BriefPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  if (!jobId || typeof jobId !== "string") return <Neutral text="This brief is not available." />;

  const snapshot = await getSnapshot(jobId);
  // 404-equivalent: neutral copy that never confirms whether a job exists.
  if (!snapshot) return <Neutral text="This brief is not available." />;
  if (snapshot.status === "processing") return <Neutral text="Your brief is being generated. This can take a few minutes — refresh shortly." />;
  if (snapshot.status !== "completed") return <Neutral text="This brief could not be completed." />;

  // Curated assembly server-side; customer_ref intentionally null (no email in
  // the customer view). Only the assembled structure is serialized to the client.
  const report = assembleInstitutionalReport(snapshot.report_json as Record<string, unknown>, {
    job_id: snapshot.job_id,
    plan: snapshot.plan ?? null,
    search_id: (snapshot as { search_id?: string | null }).search_id ?? null,
    customer_ref: null,
    created_at: snapshot.created_at,
  });

  return <BriefView report={report} />;
}
