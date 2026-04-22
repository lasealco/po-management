"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import { collectImportAssistantSamplePaths } from "@/lib/apihub/import-assistant-sample-paths";

import type { ImportAssistantStep } from "./import-assistant-types";

export type ImportAssistantChatContextPayload = {
  step: ImportAssistantStep;
  statedDomainId: string | null;
  statedDomainTitle: string | null;
  recordCount: number | null;
  fileName: string | null;
  fileKind: "json" | "csv" | "xml" | null;
  sampleFieldPaths: string[];
  documentationExcerpt: string;
  keywordGuessDomainId: string | null;
  keywordGuessDomainTitle: string | null;
  jobStatus: string | null;
  proposedRuleCount: number | null;
  mappingEngine: string | null;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  flowEpoch: number;
  contextPayload: ImportAssistantChatContextPayload;
};

const WELCOME =
  "Hi — I can walk you through this in plain language. Use the checklist on the left first: say what the import is for, upload a redacted sample, confirm the quick check, then run analysis. Ask me about the steps, what a mapping means, or what to tell your forwarder — I will not guess your business purpose for you.";

function fileKindFromName(name: string | null): "json" | "csv" | "xml" | null {
  if (!name) return null;
  const l = name.toLowerCase();
  if (l.endsWith(".json")) return "json";
  if (l.endsWith(".csv")) return "csv";
  if (l.endsWith(".xml")) return "xml";
  return null;
}

export function buildImportAssistantChatContextPayload(input: {
  step: ImportAssistantStep;
  domainId: string | null;
  domainTitle: string | null;
  records: unknown[] | null;
  fileName: string | null;
  userDoc: string;
  guessDomainId: string | null;
  guessDomainTitle: string | null;
  jobStatus: string | null;
  proposedRuleCount: number | null;
  mappingEngine: string | null;
}): ImportAssistantChatContextPayload {
  const sample = input.records?.[0];
  const paths =
    sample !== undefined && sample !== null ? collectImportAssistantSamplePaths(sample, 48) : [];
  return {
    step: input.step,
    statedDomainId: input.domainId,
    statedDomainTitle: input.domainTitle,
    recordCount: input.records?.length ?? null,
    fileName: input.fileName,
    fileKind: fileKindFromName(input.fileName),
    sampleFieldPaths: paths,
    documentationExcerpt: input.userDoc.trim().slice(0, 500),
    keywordGuessDomainId: input.guessDomainId,
    keywordGuessDomainTitle: input.guessDomainTitle,
    jobStatus: input.jobStatus,
    proposedRuleCount: input.proposedRuleCount,
    mappingEngine: input.mappingEngine,
  };
}

export function ImportAssistantChatPanel({ flowEpoch, contextPayload }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: WELCOME }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([{ role: "assistant", content: WELCOME }]);
    setDraft("");
    setError(null);
  }, [flowEpoch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const apiContext = useMemo(
    () => ({
      step: contextPayload.step,
      statedDomainId: contextPayload.statedDomainId ?? undefined,
      statedDomainTitle: contextPayload.statedDomainTitle ?? undefined,
      recordCount: contextPayload.recordCount ?? undefined,
      fileName: contextPayload.fileName,
      fileKind: contextPayload.fileKind,
      sampleFieldPaths:
        contextPayload.sampleFieldPaths.length > 0 ? contextPayload.sampleFieldPaths : undefined,
      documentationExcerpt: contextPayload.documentationExcerpt || undefined,
      keywordGuessDomainId: contextPayload.keywordGuessDomainId,
      keywordGuessDomainTitle: contextPayload.keywordGuessDomainTitle,
      jobStatus: contextPayload.jobStatus,
      proposedRuleCount: contextPayload.proposedRuleCount,
      mappingEngine: contextPayload.mappingEngine,
    }),
    [contextPayload],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    const nextThread: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextThread);
    setDraft("");
    try {
      const res = await fetch("/api/apihub/import-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextThread,
          context: apiContext,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not reach the assistant."));
        setMessages((m) => m.slice(0, -1));
        return;
      }
      const body = data as { ok?: boolean; assistantMessage?: string };
      if (!body.ok || typeof body.assistantMessage !== "string") {
        setError("Unexpected response from assistant.");
        setMessages((m) => m.slice(0, -1));
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: body.assistantMessage! }]);
    } finally {
      setBusy(false);
    }
  }, [apiContext, busy, draft, messages]);

  return (
    <aside className="mt-8 flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm lg:mt-0 lg:max-h-[calc(100vh-6rem)] lg:sticky lg:top-6">
      <div className="border-b border-zinc-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Assistant</p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">Ask in plain language</p>
        <p className="mt-1 text-xs text-zinc-600">
          Guidance only — the left column is what actually saves mappings. No passwords or full files here.
        </p>
      </div>
      <div className="flex min-h-[14rem] flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
          {messages.map((msg, i) => (
            <div
              key={`${flowEpoch}-${i}`}
              className={`rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "ml-4 border border-zinc-200 bg-zinc-50 text-zinc-900"
                  : "mr-4 border border-emerald-100 bg-emerald-50/60 text-zinc-800"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {msg.role === "user" ? "You" : "Guide"}
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {error ? (
          <p className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        ) : null}
        <div className="border-t border-zinc-200 p-3">
          <textarea
            className="h-20 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            placeholder="e.g. What does ‘confirm with you’ mean on the mapping list?"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => void send()}
            className="mt-2 w-full rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {busy ? "Thinking…" : "Send"}
          </button>
        </div>
      </div>
    </aside>
  );
}
