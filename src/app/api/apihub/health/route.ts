import { NextResponse } from "next/server";

import { getApiHubHealthJson } from "@/lib/apihub/health-body";

export function GET() {
  return NextResponse.json(getApiHubHealthJson());
}
