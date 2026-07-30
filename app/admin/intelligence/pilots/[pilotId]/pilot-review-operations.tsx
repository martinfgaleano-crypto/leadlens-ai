"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin/admin-client";

export default function PilotReviewOperations({ pilotId, theses }: { pilotId: string; theses: any[] }) {
  const [intakeId, setIntakeId] = useState("");
  const [acceptedIds, setAcceptedIds] = useState("");
  const [message, setMessage] = useState("");

  async function operate(payload: object) {
    setMessage("Saving review…");
    const response = await adminFetch(`/api/admin/intelligence/pilots/${pilotId}/operations`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Saved · ${result.context_version_id ?? result.thesis_review_id ?? result.safety_review_id}` : `${result.error ?? "Review failed"}`);
  }

  return <div>
    <h3>Context acceptance</h3>
    <p>Submission never activates context. Paste a submitted intake ID and explicitly select question IDs for partial acceptance.</p>
    <input value={intakeId} onChange={event => setIntakeId(event.target.value)} placeholder="Submitted intake ID" />
    <input value={acceptedIds} onChange={event => setAcceptedIds(event.target.value)} placeholder="Accepted question IDs, comma separated" />
    <button onClick={() => operate({
      action: "accept_context",
      intake_id: intakeId,
      accepted_question_ids: acceptedIds.split(",").map(value => value.trim()).filter(Boolean),
      rejected_question_ids: [],
    })}>Accept selected answers</button>
    <p><small>Creates an immutable context version and a deterministic affected-thesis set; makes zero provider calls.</small></p>

    <h3>Thesis review</h3>
    {theses.map(thesis => <details key={thesis.thesis_id}>
      <summary>{thesis.account_name} · {thesis.review_state}</summary>
      <p>{thesis.opportunity_statement}</p>
      <button onClick={() => operate({ action: "review_thesis", thesis_id: thesis.thesis_id, decision: "approved_internal", correction_note: "" })}>Approve internal</button>{" "}
      <button onClick={() => operate({ action: "review_thesis", thesis_id: thesis.thesis_id, decision: "context_requested", correction_note: "Client context required before further review." })}>Request context</button>{" "}
      <button onClick={() => operate({ action: "review_thesis", thesis_id: thesis.thesis_id, decision: "evidence_requested", correction_note: "Additional account evidence required." })}>Request evidence</button>{" "}
      <button onClick={() => operate({ action: "review_thesis", thesis_id: thesis.thesis_id, decision: "rejected", correction_note: "Client fit rejected by human reviewer." })}>Reject fit</button>
      <p><small>Every action inserts a review version and preserves the original thesis. Internal approval never creates customer-safe status.</small></p>
    </details>)}
    {message && <p role="status">{message}</p>}
  </div>;
}
