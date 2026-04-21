import { Buffer } from "node:buffer";

const MAX_CHARS = 256;
const MAX_OFFSET = 50_000;

type CursorPayloadV1 = { v: 1; o: number };

export function encodeIngestionRunTimelineCursor(offset: number): string {
  const payload: CursorPayloadV1 = { v: 1, o: offset };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeIngestionRunTimelineCursor(raw: string): { ok: true; offset: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "cursor cannot be empty." };
  }
  if (trimmed.length > MAX_CHARS) {
    return { ok: false, message: "cursor is too large." };
  }
  try {
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<CursorPayloadV1>;
    if (parsed.v !== 1 || typeof parsed.o !== "number" || !Number.isFinite(parsed.o)) {
      return { ok: false, message: "cursor payload is invalid." };
    }
    const o = Math.trunc(parsed.o);
    if (o < 0 || o > MAX_OFFSET) {
      return { ok: false, message: "cursor offset is out of range." };
    }
    return { ok: true, offset: o };
  } catch {
    return { ok: false, message: "cursor could not be decoded." };
  }
}
