// Delivery package generator. Server-side only.
// Fetches lead_results, generates CSV, uploads to Supabase Storage,
// inserts a delivery_packages row, and returns a signed URL.
// All errors surface as thrown exceptions — callers must wrap in try/catch.

import { generateLeadsCSV, type LeadResultRow } from "./generate-csv";

const BUCKET       = "deliveries";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBucket(client: any): Promise<void> {
  try {
    const { data: buckets } = await client.storage.listBuckets();
    const exists = (buckets ?? []).some((b: { name: string }) => b.name === BUCKET);
    if (!exists) {
      await client.storage.createBucket(BUCKET, { public: false });
    }
  } catch {
    // If bucket creation fails the upload will surface the real error
  }
}

export interface DeliveryPackageResult {
  packageId:  string;
  fileUrl:    string;   // internal storage path
  signedUrl:  string;   // time-limited download URL
  leadCount:  number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateDeliveryPackage(
  client:     any,
  searchId:   string,
  searchName: string,
): Promise<DeliveryPackageResult> {

  // ── 1. Fetch leads from DB ─────────────────────────────────────────────────
  const { data: leads, error: leadsErr } = await client
    .from("lead_results")
    .select([
      "company_name", "contact_name", "title", "email", "email_quality",
      "email_type", "linkedin_url", "website", "country", "seniority",
      "source", "lead_score", "confidence_score", "opportunity_score",
      "buyer_fit", "temperature", "ai_reasoning", "strengths", "weaknesses",
    ].join(", "))
    .eq("search_id", searchId)
    .order("lead_score", { ascending: false });

  if (leadsErr) throw new Error(`fetch leads: ${leadsErr.message}`);
  if (!leads || leads.length === 0) throw new Error("No leads to package");

  // ── 2. Generate CSV bytes ──────────────────────────────────────────────────
  const csv       = generateLeadsCSV(leads as LeadResultRow[]);
  const csvBytes  = new TextEncoder().encode(csv);
  const leadCount = leads.length;

  // ── 3. Ensure storage bucket exists ───────────────────────────────────────
  await ensureBucket(client);

  // ── 4. Upload to Supabase Storage ─────────────────────────────────────────
  const safeName  = searchName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const timestamp  = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filePath   = `${searchId}/${safeName}-${timestamp}.csv`;

  const { data: uploadData, error: uploadErr } = await client.storage
    .from(BUCKET)
    .upload(filePath, csvBytes, { contentType: "text/csv; charset=utf-8", upsert: true });

  if (uploadErr) throw new Error(`storage upload: ${uploadErr.message}`);

  // ── 5. Create signed URL (7 days) ─────────────────────────────────────────
  const { data: signedData, error: signedErr } = await client.storage
    .from(BUCKET)
    .createSignedUrl(uploadData.path, SIGNED_URL_TTL);

  if (signedErr || !signedData?.signedUrl) {
    throw new Error(`signed URL: ${signedErr?.message ?? "no URL returned"}`);
  }

  const signedUrl = signedData.signedUrl;
  const fileUrl   = uploadData.path;

  // ── 6. Insert delivery_packages row ───────────────────────────────────────
  const now = new Date().toISOString();

  const { data: pkg, error: pkgErr } = await client
    .from("delivery_packages")
    .insert({
      search_id:    searchId,
      status:       "ready",
      generated_at: now,
      lead_count:   leadCount,
      file_type:    "csv",
      file_url:     fileUrl,
      access_url:   signedUrl,
    })
    .select("id")
    .single();

  if (pkgErr) throw new Error(`delivery_packages insert: ${pkgErr.message}`);

  return {
    packageId: pkg.id as string,
    fileUrl,
    signedUrl,
    leadCount,
  };
}
