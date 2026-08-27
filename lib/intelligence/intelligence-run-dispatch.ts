import { internalProcessingHeaders } from "@/lib/auth/authorize-processing";

/** Best-effort wake-up only. The durable queued row is the source of truth and
 * can be safely re-dispatched after a lost invocation. Never embeds secrets in
 * the URL or customer response. */
export function dispatchIntelligenceRun(origin: string, runId: string, userId: string): boolean {
  const headers = internalProcessingHeaders();
  if (!headers) return false;
  void fetch(`${origin}/api/internal/intelligence-runs/${runId}/process`, {
    method: "POST", headers, body: JSON.stringify({ user_id: userId }),
  }).catch((error) => console.error("[intelligence-dispatch]", error instanceof Error ? error.message : "dispatch_failed"));
  return true;
}
