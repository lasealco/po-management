import { Buffer } from "node:buffer";

/** Guardrail for encoded cursor strings on the query line. */
export const APIHUB_INGESTION_RUN_LIST_CURSOR_MAX_CHARS = 512;

type CursorPayloadV1 = { v: 1; c: string; i: string };

export type ApiHubIngestionRunListCursor = {
  createdAt: Date;
  id: string;
};

export function encodeIngestionRunListCursor(createdAt: Date, id: string): string {
  const payload: CursorPayloadV1 = { v: 1, c: createdAt.toISOString(), i: id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeIngestionRunListCursor(raw: string): { ok: true; cursor: ApiHubIngestionRunListCursor } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "cursor cannot be empty." };
  }
  if (trimmed.length > APIHUB_INGESTION_RUN_LIST_CURSOR_MAX_CHARS) {
    return { ok: false, message: "cursor is too large." };
  }
  try {
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<CursorPayloadV1>;
    if (parsed.v !== 1 || typeof parsed.c !== "string" || typeof parsed.i !== "string") {
      return { ok: false, message: "cursor payload is invalid." };
    }
    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime())) {
      return { ok: false, message: "cursor createdAt is invalid." };
    }
    const id = parsed.i.trim();
    if (id.length < 12 || id.length > 64) {
      return { ok: false, message: "cursor id is invalid." };
    }
    if (!/^[a-z0-9]+$/i.test(id)) {
      return { ok: false, message: "cursor id is invalid." };
    }
    return { ok: true, cursor: { createdAt, id } };
  } catch {
    return { ok: false, message: "cursor could not be decoded." };
  }
}
