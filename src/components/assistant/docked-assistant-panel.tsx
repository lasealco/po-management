"use client";

import Link from "next/link";
import { useState } from "react";

type AnswerResult =
  | { kind: "defer" }
  | { kind: "not_found"; message: string }
  | { kind: "no_hint"; message: string }
  | { kind: "clarify"; message: string; options: Array<{ id: string; name: string; productCode?: string | null; sku?: string | null }> }
  | { kind: "answer"; message: string; evidence: { label: string; href: string }[] };

async function postAssistantAnswer(url: string, text: string): Promise<AnswerResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const parsed = (await res.json().catch(() => ({}))) as Partial<AnswerResult> & { error?: string };
  if (!res.ok) {
    throw new Error(parsed.error || "Assistant could not answer.");
  }
  if (
    parsed.kind === "defer" ||
    parsed.kind === "not_found" ||
    parsed.kind === "no_hint" ||
    parsed.kind === "clarify" ||
    parsed.kind === "answer"
  ) {
    return parsed as AnswerResult;
  }
  throw new Error("Assistant returned an unexpected response.");
}

export function DockedAssistantPanel({
  title,
  prompt,
  assistantHref,
}: {
  title: string;
  prompt: string;
  assistantHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const askHere = async () => {
    setOpen(true);
    setBusy(true);
    setErr(null);
    setAnswer(null);
    try {
      const context = await postAssistantAnswer("/api/assistant/answer-context", prompt);
      if (context.kind !== "defer") {
        setAnswer(context);
        return;
      }
      const operations = await postAssistantAnswer("/api/assistant/answer-operations", prompt);
      setAnswer(operations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Assistant failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void askHere()}
        className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Ask here
      </button>
      <Link
        href={assistantHref}
        className="rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-950 hover:bg-sky-50"
      >
        Open full assistant
      </Link>

      {open ? (
        <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl">
          <div className="border-b border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">Docked assistant</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900">{title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              {prompt}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {busy ? (
              <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">Working on it...</p>
            ) : null}
            {err ? (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{err}</p>
            ) : null}
            {answer?.kind === "answer" ? (
              <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
                <p className="whitespace-pre-wrap text-zinc-800">{answer.message}</p>
                {answer.evidence.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidence</p>
                    <ul className="mt-2 space-y-1">
                      {answer.evidence.map((e) => (
                        <li key={e.label + e.href}>
                          <Link className="font-medium text-[var(--arscmp-primary)] hover:underline" href={e.href}>
                            {e.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {answer && answer.kind !== "answer" && answer.kind !== "defer" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p>{answer.message}</p>
                {answer.kind === "clarify" ? (
                  <ul className="mt-2 list-inside list-disc">
                    {answer.options.slice(0, 6).map((option) => (
                      <li key={option.id}>
                        {option.name}
                        {option.productCode ? ` (${option.productCode})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {!busy && !err && !answer ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
                Ask from this page to get a grounded summary without leaving your workflow.
              </p>
            ) : null}
          </div>

          <div className="border-t border-zinc-200 p-4">
            <Link
              href={assistantHref}
              className="inline-flex w-full justify-center rounded-xl bg-[var(--arscmp-primary)] px-4 py-3 text-sm font-semibold text-white"
            >
              Continue in full assistant
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
