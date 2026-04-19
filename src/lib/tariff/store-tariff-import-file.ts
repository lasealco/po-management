import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { put } from "@vercel/blob";

const MAX_BYTES = 30 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
};

/**
 * Persists tariff import files using the same pattern as Control Tower / product images:
 * Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, otherwise `public/uploads/tariffs` in development.
 */
export async function storeTariffImportFile(params: {
  bytes: Buffer;
  mimeType: string;
  originalFileName: string;
}): Promise<{ url: string; byteSize: number }> {
  if (params.bytes.length > MAX_BYTES) {
    throw new Error(`File must be at most ${MAX_BYTES / (1024 * 1024)} MB.`);
  }

  const ext = MIME_EXT[params.mimeType] ?? "bin";
  const basename = `tariff-import-${randomUUID()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(basename, params.bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: params.mimeType,
    });
    return { url: blob.url, byteSize: params.bytes.length };
  }

  if (process.env.NODE_ENV === "development") {
    const dir = join(process.cwd(), "public", "uploads", "tariffs");
    await mkdir(dir, { recursive: true });
    const path = join(dir, basename);
    await writeFile(path, params.bytes);
    return { url: `/uploads/tariffs/${basename}`, byteSize: params.bytes.length };
  }

  throw new Error(
    "Tariff file storage is not configured. Set BLOB_READ_WRITE_TOKEN (Vercel Blob) for production, or run in development to use public/uploads/tariffs.",
  );
}

export const TARIFF_IMPORT_ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export function assertTariffImportMime(mime: string): void {
  if (!TARIFF_IMPORT_ALLOWED_MIMES.has(mime)) {
    throw new Error("Only PDF or Excel (.xlsx, .xls) uploads are allowed.");
  }
}
