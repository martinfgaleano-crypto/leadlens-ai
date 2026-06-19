import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listSaasJobs } from "@/lib/storage/saas-store";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const url    = req.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const limit  = Number(url.searchParams.get("limit")  ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const result = await listSaasJobs({ status, limit, offset });
  return NextResponse.json(result);
}
