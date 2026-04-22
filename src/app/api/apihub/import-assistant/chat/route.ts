import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import {
  parseImportAssistantChatBody,
  type ImportAssistantChatRequestBody,
} from "@/lib/apihub/import-assistant-chat-body";
import {
  APIHUB_IMPORT_ASSISTANT_CHAT_PROMPT_VERSION,
  runImportAssistantChatTurn,
} from "@/lib/apihub/import-assistant-chat-llm";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }

  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "standard", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const parsed = parseImportAssistantChatBody(parsedBody.value as ImportAssistantChatRequestBody);
  if (!parsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Import assistant chat validation failed.", parsed.issues, requestId);
  }

  const result = await runImportAssistantChatTurn({
    messages: parsed.value.messages,
    context: parsed.value.context,
  });

  if (!result.ok) {
    return apiHubError(
      502,
      "CHAT_MODEL_ERROR",
      "The assistant could not complete this turn. Try again, or continue without chat.",
      requestId,
    );
  }

  return apiHubJson(
    {
      ok: true,
      assistantMessage: result.assistantMessage,
      model: result.model,
      fallback: "fallback" in result ? result.fallback : false,
      promptVersion: APIHUB_IMPORT_ASSISTANT_CHAT_PROMPT_VERSION,
    },
    requestId,
  );
}
