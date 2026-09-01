import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireOwner } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  await requireOwner();
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase saknas." }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Ingen bild vald." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Välj en bildfil." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Bilden är för stor. Max 8 MB." }, { status: 400 });

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `items/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const bucket = getServerEnv().SUPABASE_STORAGE_BUCKET;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
