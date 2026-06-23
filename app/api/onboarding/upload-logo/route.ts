import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const MAX_BYTES     = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large. Max 5 MB." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use PNG, JPG, WebP, or SVG." }, { status: 400 });
    }

    const client = createServerClient();
    if (!client) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const ext      = file.name.split(".").pop() ?? "png";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer   = new Uint8Array(await file.arrayBuffer());

    const { data, error } = await client.storage
      .from("logos")
      .upload(fileName, buffer, { contentType: file.type, upsert: false });

    if (error) {
      console.error("[upload-logo]", error.message);
      return NextResponse.json({ error: "Upload failed. Please provide a logo URL instead." }, { status: 500 });
    }

    const { data: { publicUrl } } = client.storage.from("logos").getPublicUrl(data.path);
    return NextResponse.json({ url: publicUrl });
  } catch (err: unknown) {
    console.error("[upload-logo]", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
