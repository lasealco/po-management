import { NextResponse } from "next/server";

import { isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";

export const dynamic = "force-dynamic";

/** Public capability probe for client (no auth) — only exposes a boolean. */
export async function GET() {
  return NextResponse.json({ enabled: isAssistantEmailPilotEnabled() });
}
