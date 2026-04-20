export type ParsePromoteImportBodyResult =
  | { ok: true; contractHeaderId: string }
  | { ok: false; error: string };

export function parsePromoteImportRequestBody(body: unknown): ParsePromoteImportBodyResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Expected object body." };
  }
  const contractHeaderId =
    typeof (body as { contractHeaderId?: unknown }).contractHeaderId === "string"
      ? (body as { contractHeaderId: string }).contractHeaderId.trim()
      : "";
  if (!contractHeaderId) {
    return { ok: false, error: "contractHeaderId is required." };
  }
  return { ok: true, contractHeaderId };
}
