/**
 * Conversational layer for the guided import assistant (plain-language guidance only).
 * Does not emit mapping rules — those come from the mapping-analysis job pipeline.
 */

export const APIHUB_IMPORT_ASSISTANT_CHAT_PROMPT_VERSION = "2026-04-22-chat-v1" as const;

export type ImportAssistantChatTurnContext = {
  promptVersion: typeof APIHUB_IMPORT_ASSISTANT_CHAT_PROMPT_VERSION;
  step: string;
  statedDomainId?: string;
  statedDomainTitle?: string;
  recordCount?: number;
  fileName?: string | null;
  fileKind?: "json" | "csv" | "xml" | null;
  sampleFieldPaths?: string[];
  documentationExcerpt?: string | null;
  keywordGuessDomainId?: string | null;
  keywordGuessDomainTitle?: string | null;
  jobStatus?: string | null;
  proposedRuleCount?: number | null;
  mappingEngine?: string | null;
};

export type ImportAssistantChatRequestMessage = {
  role: "user" | "assistant";
  content: string;
};

function openAiApiKey(): string | null {
  const k = process.env.APIHUB_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

function openAiModel(): string {
  return process.env.APIHUB_OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

const SYSTEM_STATIC = `You are a calm logistics onboarding guide inside an "Integration hub" web app.

Rules:
- Explain in plain language. Avoid jargon unless the user uses it first.
- The app controls the workflow: the user must pick an import purpose, upload a sample file, confirm a quick check, run server analysis, then review mappings. Do not claim mappings, templates, or connectors are saved unless context says the user completed those steps.
- Never override the user's stated import purpose. If the file might fit a different category, ask them to confirm using the buttons on the page — do not silently reclassify.
- Ask 1–2 focused clarifying questions when something is ambiguous. Do not invent CargoWise or partner-specific field meanings.
- Never ask for or repeat secrets: passwords, API keys, tokens, or full production files. Short redacted excerpts only.
- Keep replies concise (under ~180 words unless the user asks for detail).`;

export function importAssistantChatFallbackMessageNoKey(): string {
  return "Live chat needs an OpenAI API key on the server (APIHUB_OPENAI_API_KEY or OPENAI_API_KEY). You can still complete every step on the left without chat.";
}

export async function runImportAssistantChatTurn(input: {
  messages: ImportAssistantChatRequestMessage[];
  context: ImportAssistantChatTurnContext;
}): Promise<
  | { ok: true; assistantMessage: string; model: string; fallback?: false }
  | { ok: true; assistantMessage: string; model: null; fallback: true }
  | { ok: false; error: string; model: string }
> {
  const apiKey = openAiApiKey();
  const model = openAiModel();

  if (!apiKey) {
    return {
      ok: true,
      assistantMessage: importAssistantChatFallbackMessageNoKey(),
      model: null,
      fallback: true,
    };
  }

  const ctxJson = JSON.stringify(input.context);
  if (ctxJson.length > 8000) {
    return { ok: false, error: "context_too_large", model };
  }

  const openAiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `${SYSTEM_STATIC}\n\nCurrent UI context (authoritative; do not contradict):\n${ctxJson}`,
    },
    ...input.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 700,
        messages: openAiMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: `openai_http_${res.status}:${errText.slice(0, 200)}`,
        model,
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) {
      return { ok: false, error: "empty_completion", model };
    }

    return { ok: true, assistantMessage: raw.trim(), model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "llm_error";
    return { ok: false, error: msg.slice(0, 300), model };
  }
}
