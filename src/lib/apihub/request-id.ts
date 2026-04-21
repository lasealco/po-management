import { randomUUID } from "node:crypto";

/** Response + inbound echo header for API Hub tracing. */
export const APIHUB_REQUEST_ID_HEADER = "x-request-id";

const INBOUND_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,200}$/;

function pickIncomingRequestId(request: Request): string | null {
  const raw =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim() ||
    "";
  if (!raw) {
    return null;
  }
  if (!INBOUND_REQUEST_ID_PATTERN.test(raw)) {
    return null;
  }
  return raw.slice(0, 200);
}

/** Prefer a valid client-supplied id; otherwise generate a UUID. */
export function resolveApiHubRequestId(request: Request): string {
  return pickIncomingRequestId(request) ?? randomUUID();
}
