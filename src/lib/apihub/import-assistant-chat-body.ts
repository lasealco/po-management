import type { ApiHubValidationIssue } from "@/lib/apihub/api-error";

import type { ImportAssistantChatTurnContext } from "./import-assistant-chat-llm";
import { APIHUB_IMPORT_ASSISTANT_CHAT_PROMPT_VERSION } from "./import-assistant-chat-llm";

export type ImportAssistantChatRequestMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ImportAssistantChatRequestBody = {
  messages?: unknown;
  context?: unknown;
};

const MAX_MESSAGES = 18;
const MAX_CONTENT_LEN = 3600;
const MAX_CONTEXT_DOC = 600;
const MAX_CONTEXT_PATHS = 64;

function isChatRole(r: unknown): r is "user" | "assistant" {
  return r === "user" || r === "assistant";
}

export function parseImportAssistantChatBody(body: ImportAssistantChatRequestBody):
  | { ok: true; value: { messages: ImportAssistantChatRequestMessage[]; context: ImportAssistantChatTurnContext } }
  | { ok: false; issues: ApiHubValidationIssue[] } {
  const issues: ApiHubValidationIssue[] = [];
  const messages: ImportAssistantChatRequestMessage[] = [];

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages)) {
    issues.push({
      field: "messages",
      code: "INVALID_TYPE",
      message: "messages must be an array of { role, content }.",
      severity: "error",
    });
  } else if (rawMessages.length === 0) {
    issues.push({
      field: "messages",
      code: "OUT_OF_RANGE",
      message: "messages must not be empty.",
      severity: "error",
    });
  } else if (rawMessages.length > MAX_MESSAGES) {
    issues.push({
      field: "messages",
      code: "OUT_OF_RANGE",
      message: `At most ${MAX_MESSAGES} chat messages per request.`,
      severity: "error",
    });
  } else {
    for (let i = 0; i < rawMessages.length; i++) {
      const m = rawMessages[i];
      if (!m || typeof m !== "object" || Array.isArray(m)) {
        issues.push({
          field: `messages[${i}]`,
          code: "INVALID_TYPE",
          message: "Each message must be an object.",
          severity: "error",
        });
        break;
      }
      const o = m as Record<string, unknown>;
      if (!isChatRole(o.role)) {
        issues.push({
          field: `messages[${i}].role`,
          code: "INVALID_VALUE",
          message: "role must be user or assistant.",
          severity: "error",
        });
        break;
      }
      if (typeof o.content !== "string") {
        issues.push({
          field: `messages[${i}].content`,
          code: "INVALID_TYPE",
          message: "content must be a string.",
          severity: "error",
        });
        break;
      }
      if (o.content.length > MAX_CONTENT_LEN) {
        issues.push({
          field: `messages[${i}].content`,
          code: "OUT_OF_RANGE",
          message: `Each message must be at most ${MAX_CONTENT_LEN} characters.`,
          severity: "error",
        });
        break;
      }
      messages.push({ role: o.role, content: o.content });
    }
  }

  const rawCtx = body.context;
  if (!rawCtx || typeof rawCtx !== "object" || Array.isArray(rawCtx)) {
    issues.push({
      field: "context",
      code: "INVALID_TYPE",
      message: "context must be an object.",
      severity: "error",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const c = rawCtx as Record<string, unknown>;
  const step = typeof c.step === "string" ? c.step.trim().slice(0, 64) : "";
  if (!step) {
    return {
      ok: false,
      issues: [
        {
          field: "context.step",
          code: "INVALID_VALUE",
          message: "context.step is required.",
          severity: "error",
        },
      ],
    };
  }

  let sampleFieldPaths: string[] | undefined;
  if (c.sampleFieldPaths !== undefined && c.sampleFieldPaths !== null) {
    if (!Array.isArray(c.sampleFieldPaths)) {
      return {
        ok: false,
        issues: [
          {
            field: "context.sampleFieldPaths",
            code: "INVALID_TYPE",
            message: "sampleFieldPaths must be an array of strings when provided.",
            severity: "error",
          },
        ],
      };
    }
    const paths = c.sampleFieldPaths
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_CONTEXT_PATHS);
    sampleFieldPaths = paths.length ? paths : undefined;
  }

  let documentationExcerpt: string | null = null;
  if (typeof c.documentationExcerpt === "string" && c.documentationExcerpt.trim()) {
    documentationExcerpt = c.documentationExcerpt.trim().slice(0, MAX_CONTEXT_DOC);
  }

  let fileKind: "json" | "csv" | "xml" | null = null;
  if (c.fileKind === "json" || c.fileKind === "csv" || c.fileKind === "xml") {
    fileKind = c.fileKind;
  } else if (c.fileKind != null && c.fileKind !== undefined) {
    return {
      ok: false,
      issues: [
        {
          field: "context.fileKind",
          code: "INVALID_VALUE",
          message: "fileKind must be json, csv, xml, or omitted.",
          severity: "error",
        },
      ],
    };
  }

  const context: ImportAssistantChatTurnContext = {
    promptVersion: APIHUB_IMPORT_ASSISTANT_CHAT_PROMPT_VERSION,
    step,
    statedDomainId: typeof c.statedDomainId === "string" ? c.statedDomainId.trim().slice(0, 64) : undefined,
    statedDomainTitle: typeof c.statedDomainTitle === "string" ? c.statedDomainTitle.trim().slice(0, 120) : undefined,
    recordCount:
      typeof c.recordCount === "number" && Number.isFinite(c.recordCount)
        ? Math.max(0, Math.floor(c.recordCount))
        : undefined,
    fileName: typeof c.fileName === "string" ? c.fileName.trim().slice(0, 240) : null,
    fileKind,
    sampleFieldPaths,
    documentationExcerpt,
    keywordGuessDomainId:
      typeof c.keywordGuessDomainId === "string" ? c.keywordGuessDomainId.trim().slice(0, 64) : null,
    keywordGuessDomainTitle:
      typeof c.keywordGuessDomainTitle === "string" ? c.keywordGuessDomainTitle.trim().slice(0, 120) : null,
    jobStatus: typeof c.jobStatus === "string" ? c.jobStatus.trim().slice(0, 32) : null,
    proposedRuleCount:
      typeof c.proposedRuleCount === "number" && Number.isFinite(c.proposedRuleCount)
        ? Math.max(0, Math.floor(c.proposedRuleCount))
        : null,
    mappingEngine: typeof c.mappingEngine === "string" ? c.mappingEngine.trim().slice(0, 80) : null,
  };

  return { ok: true, value: { messages, context } };
}
