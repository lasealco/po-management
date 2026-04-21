import { Buffer } from "node:buffer";

/** Guardrail for encoded cursor strings on the apply-conflicts query line. */
export const APIHUB_APPLY_CONFLICT_LIST_CURSOR_MAX_CHARS = 512;

type CursorPayloadV2 = { v: 2; c: string; i: string };

export type ApiHubApplyConflictListCursor = {
  createdAt: Date;
  id: string;
};

export function encodeApplyConflictListCursor(createdAt: Date, id: string): string {
  const payload: CursorPayloadV2 = { v: 2, c: createdAt.toISOString(), i: id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeApplyConflictListCursor(
  raw: string,
): { ok: true; cursor: ApiHubApplyConflictListCursor } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "cursor cannot be empty." };
  }
  if (trimmed.length > APIHUB_APPLY_CONFLICT_LIST_CURSOR_MAX_CHARS) {
    return { ok: false, message: "cursor is too large." };
  }
  try {
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<CursorPayloadV2>;
    if (parsed.v !== 2 || typeof parsed.c !== "string" || typeof parsed.i !== "string") {
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
