export type ParseRelationshipNoteCreateResult =
  | { ok: true; data: { body: string } }
  | { ok: false; message: string };

export function parseRelationshipNoteCreateBody(
  o: Record<string, unknown>,
): ParseRelationshipNoteCreateResult {
  if (typeof o.body !== "string" || !o.body.trim()) {
    return { ok: false, message: "body is required." };
  }
  return { ok: true, data: { body: o.body.trim().slice(0, 16000) } };
}

export type ParseRelationshipNotePatchResult =
  | { ok: true; data: { body: string } }
  | { ok: false; message: string };

export function parseRelationshipNotePatchBody(
  o: Record<string, unknown>,
): ParseRelationshipNotePatchResult {
  if (typeof o.body !== "string" || !o.body.trim()) {
    return { ok: false, message: "body cannot be empty." };
  }
  return { ok: true, data: { body: o.body.trim().slice(0, 16000) } };
}
