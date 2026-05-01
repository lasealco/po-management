import { NextResponse } from "next/server";

import { partnerRateLimitStubHeaders } from "./partner-rate-limit-stub";

/** JSON response with BF-45 advisory rate-limit headers (stub policy). */
export function partnerV1Json(data: unknown, status = 200): NextResponse {
  const headers = new Headers(partnerRateLimitStubHeaders());
  headers.set("Content-Type", "application/json");
  return new NextResponse(JSON.stringify(data), { status, headers });
}
