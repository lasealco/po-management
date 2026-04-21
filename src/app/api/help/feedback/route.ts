import { NextResponse } from "next/server";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { isValidHelpEventId } from "@/lib/help-event-id";
import { logHelpFeedbackTelemetry } from "@/lib/help-telemetry";

type Body = {
  helpEventId?: string;
  helpful?: unknown;
};

export async function POST(request: Request) {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "You need an active session to send feedback." }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as Body;
  const rawId = typeof input.helpEventId === "string" ? input.helpEventId.trim() : "";
  if (!isValidHelpEventId(rawId)) {
    return NextResponse.json({ error: "helpEventId must be a valid UUID." }, { status: 400 });
  }
  if (typeof input.helpful !== "boolean") {
    return NextResponse.json({ error: "helpful must be a boolean." }, { status: 400 });
  }

  logHelpFeedbackTelemetry({
    kind: "help_feedback",
    tenantId: tenant.id,
    helpEventId: rawId,
    helpful: input.helpful,
  });

  return NextResponse.json({ ok: true });
}
