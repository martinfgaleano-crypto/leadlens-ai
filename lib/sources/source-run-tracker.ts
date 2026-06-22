// Tracks source_run lifecycle inside the processing pipeline.
// All functions are best-effort: failures are swallowed so the pipeline is never blocked.
// Server-side only.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startSourceRun(
  client:     any,
  searchId:   string,
  sourceName: string,
): Promise<string | null> {
  try {
    const { data } = await client
      .from("source_runs")
      .insert({
        search_id:   searchId,
        source_name: sourceName,
        status:      "processing",
        started_at:  new Date().toISOString(),
      })
      .select("id")
      .single();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function completeSourceRun(
  client:       any,
  runId:        string | null,
  status:       "completed" | "failed" | "skipped",
  durationMs:   number,
  resultsFound: number,
  notes?:       string,
): Promise<void> {
  if (!runId) return;
  try {
    await client
      .from("source_runs")
      .update({
        status:        status,
        completed_at:  new Date().toISOString(),
        duration_ms:   durationMs,
        results_found: resultsFound,
        notes:         notes ?? null,
      })
      .eq("id", runId);
  } catch {
    // never block the pipeline
  }
}
