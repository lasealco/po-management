import { randomUUID } from "node:crypto";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { NextResponse } from "next/server";
import { actorIsSupplierPortalRestricted, getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildHelpAssistantGrantSnapshot } from "@/lib/help-assistant-grants";
import { HELP_PLAYBOOKS } from "@/lib/help-playbooks";
import { buildHelpReply } from "@/lib/help-llm";
import {
  helpTelemetryGrantBits,
  helpTelemetryPathPrefix,
  logHelpChatTelemetry,
} from "@/lib/help-telemetry";

type HelpChatBody = {
  message?: string;
  currentPath?: string;
};

export async function POST(request: Request) {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "You need an active session to use Help Assistant.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as HelpChatBody;
  const message = (input.message ?? "").trim();
  if (!message) {
    return toApiErrorResponse({ error: "message is required.", code: "BAD_INPUT", status: 400 });
  }

  const access = await getViewerGrantSet();
  const supplierPortalRestricted =
    access?.user != null ? await actorIsSupplierPortalRestricted(access.user.id) : false;
  const grantSnapshot = buildHelpAssistantGrantSnapshot(access, { supplierPortalRestricted });

  const reply = await buildHelpReply({
    message,
    currentPath: input.currentPath,
    grantSnapshot,
  });

  const helpEventId = randomUUID();

  logHelpChatTelemetry({
    kind: "help_chat",
    helpEventId,
    tenantId: tenant.id,
    messageLen: message.length,
    answerLen: reply.answer.length,
    playbookId: reply.playbook?.id ?? null,
    llmUsed: reply.llmUsed,
    pathPrefix: helpTelemetryPathPrefix(input.currentPath),
    doActionCount: reply.doActions.length,
    actionCount: reply.actions.length,
    suggestionCount: reply.suggestions.length,
    grantBits: helpTelemetryGrantBits(grantSnapshot),
    roleHint: grantSnapshot.roleHint,
    tenantSlug: grantSnapshot.tenantSlug,
  });

  return NextResponse.json({
    helpEventId,
    answer: reply.answer,
    playbook: reply.playbook,
    suggestions: reply.suggestions,
    actions: reply.actions,
    doActions: reply.doActions,
    llmUsed: reply.llmUsed,
    quickPlaybooks: HELP_PLAYBOOKS.map((p) => ({ id: p.id, title: p.title })),
  });
}
