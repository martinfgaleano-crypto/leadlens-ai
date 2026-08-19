import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { requireAdmin } from "@/lib/auth/require-admin";
import { resolveDeliverableFile } from "@/lib/deliverable/portable/deliverable-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/deliverables/file?slug=&date=&file=&mode=preview|download
 * Serves one generated artifact. Admin-only. Path segments are strictly
 * validated and re-checked to stay inside output/deliverables (no traversal).
 * The portable HTML is already sanitized at generation time.
 */
export function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const file = url.searchParams.get("file") ?? "";
  const mode = url.searchParams.get("mode") === "download" ? "download" : "preview";

  const resolved = resolveDeliverableFile(slug, date, file);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Buffer;
  try { body = readFileSync(resolved.absPath); } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }

  const headers: Record<string, string> = {
    "Content-Type": resolved.mime,
    "Content-Length": String(body.byteLength),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox allow-downloads allow-popups allow-same-origin",
  };
  // HTML previews render inline; everything else (and any download) attaches.
  headers["Content-Disposition"] = `${mode === "download" || !resolved.name.endsWith(".html") ? "attachment" : "inline"}; filename="${resolved.name.replace(/[^A-Za-z0-9._-]/g, "_")}"`;

  return new NextResponse(new Uint8Array(body), { status: 200, headers });
}
