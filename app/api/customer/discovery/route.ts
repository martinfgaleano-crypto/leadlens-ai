import { NextRequest } from "next/server";
import { POST as startProductiveIntelligenceRun } from "@/app/api/customer/intelligence-runs/route";

/** Backward-compatible alias. There is no longer an independent customer
 * discovery path: execution converges on the durable productive spine and
 * requires an exact confirmed context version. */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  return startProductiveIntelligenceRun(req);
}
