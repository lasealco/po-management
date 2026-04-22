import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { requireApiGrant } from "@/lib/authz";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.products", "edit");
  if (gate) return gate;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return toApiErrorResponse({ error: "Expected multipart form data.", code: "BAD_INPUT", status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return toApiErrorResponse({ error: "Missing file field.", code: "BAD_INPUT", status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return toApiErrorResponse({ error: "Use JPEG, PNG, WebP, or GIF.", code: "BAD_INPUT", status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return toApiErrorResponse({ error: "Image must be at most 5 MB.", code: "BAD_INPUT", status: 400 });
  }

  const ext = MIME_EXT[file.type] ?? "bin";
  const basename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(basename, bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  }

  if (process.env.NODE_ENV === "development") {
    const dir = join(process.cwd(), "public", "uploads", "products");
    await mkdir(dir, { recursive: true });
    const path = join(dir, basename);
    await writeFile(path, bytes);
    return NextResponse.json({ url: `/uploads/products/${basename}` });
  }

  return toApiErrorResponse({ error: "Upload is not configured. Add BLOB_READ_WRITE_TOKEN (Vercel Blob) for production, or run locally to store under public/uploads.", code: "UNAVAILABLE", status: 503 });
}
