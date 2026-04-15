import { NextResponse } from "next/server";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { HELP_PLAYBOOKS } from "@/lib/help-playbooks";
import { buildHelpReply } from "@/lib/help-llm";

type HelpChatBody = {
  message?: string;
  currentPath?: string;
};

export async function POST(request: Request) {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json(
      { error: "You need an active session to use Help Assistant." },
      { status: 403 },
    );
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
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const reply = await buildHelpReply({
    message,
    currentPath: input.currentPath,
  });

  return NextResponse.json({
    answer: reply.answer,
    playbook: reply.playbook,
    suggestions: reply.suggestions,
    actions: reply.actions,
    doActions: reply.doActions,
    llmUsed: reply.llmUsed,
    quickPlaybooks: HELP_PLAYBOOKS.map((p) => ({ id: p.id, title: p.title })),
  });
}
