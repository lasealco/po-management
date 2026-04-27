"use client";

import Link from "next/link";
import { useState } from "react";

type AnswerResult =
  | { kind: "defer" }
  | { kind: "not_found"; message: string }
  | { kind: "no_hint"; message: string }
  | { kind: "clarify"; message: string; options: Array<{ id: string; name: string; productCode?: string | null; sku?: string | null }> }
  | {
      kind: "answer";
      message: string;
      evidence: { label: string; href: string }[];
      quality?: AnswerQuality;
      playbook?: AssistantPlaybook;
      actions?: ProposedAction[];
    };

type AnswerQuality = {
  mode: "deterministic";
  groundedBy: string[];
  limitations: string[];
  generatedAt: string;
};

type AssistantPlaybook = {
  id: string;
  title: string;
  description: string;
  steps: Array<{
    id: string;
    label: string;
    description: string;
    status: "done" | "available" | "needs_review";
    actionIds?: string[];
  }>;
};

type ProposedAction =
  | {
      id: string;
      kind: "navigate";
      label: string;
      description: string;
      href: string;
    }
  | {
      id: string;
      kind: "copy_text";
      label: string;
      description: string;
      text: string;
    };

type AuditEventState = {
  id: string;
  objectType: string | null;
  objectId: string | null;
};

type MemoryEvent = {
  id: string;
  answerKind: string;
  message: string | null;
  feedback: string | null;
  createdAt: string;
  actorName: string;
};

type PlaybookRunState = {
  id: string;
  status: string;
};

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

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(parsed.error || "Assistant request failed.");
  return parsed;
}

async function patchJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(parsed.error || "Assistant request failed.");
  return parsed;
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
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);
  const [auditEvent, setAuditEvent] = useState<AuditEventState | null>(null);
  const [memoryEvents, setMemoryEvents] = useState<MemoryEvent[]>([]);
  const [queuedActionIds, setQueuedActionIds] = useState<Record<string, string>>({});
  const [playbookRun, setPlaybookRun] = useState<PlaybookRunState | null>(null);
  const [stepOverrides, setStepOverrides] = useState<Record<string, string>>({});
  const actionById =
    answer?.kind === "answer" && answer.actions
      ? new Map(answer.actions.map((action) => [action.id, action]))
      : new Map<string, ProposedAction>();

  const askHere = async () => {
    setOpen(true);
    setBusy(true);
    setErr(null);
    setAnswer(null);
    setCopiedActionId(null);
    setFeedback(null);
    setAuditEvent(null);
    setMemoryEvents([]);
    setQueuedActionIds({});
    setPlaybookRun(null);
    setStepOverrides({});
    try {
      const context = await postAssistantAnswer("/api/assistant/answer-context", prompt);
      if (context.kind !== "defer") {
        setAnswer(context);
        await persistAnswer(context);
        return;
      }
      const impact = await postAssistantAnswer("/api/assistant/answer-impact", prompt);
      if (impact.kind !== "defer") {
        setAnswer(impact);
        await persistAnswer(impact);
        return;
      }
      const operations = await postAssistantAnswer("/api/assistant/answer-operations", prompt);
      setAnswer(operations);
      await persistAnswer(operations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Assistant failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyActionText = async (action: Extract<ProposedAction, { kind: "copy_text" }>) => {
    try {
      await navigator.clipboard.writeText(action.text);
      setCopiedActionId(action.id);
    } catch {
      setErr("Could not copy text. Select and copy it manually from the draft.");
    }
  };

  const persistAnswer = async (result: AnswerResult) => {
    if (result.kind !== "answer") return;
    const saved = await postJson<{
      auditEvent: { id: string; objectType: string | null; objectId: string | null; createdAt: string };
    }>("/api/assistant/audit-events", {
      surface: "dock",
      prompt,
      answerKind: result.kind,
      message: result.message,
      evidence: result.evidence,
      quality: result.quality,
      actions: result.actions,
      playbook: result.playbook,
    });
    setAuditEvent(saved.auditEvent);
    if (saved.auditEvent.objectType && saved.auditEvent.objectId) {
      const params = new URLSearchParams({
        objectType: saved.auditEvent.objectType,
        objectId: saved.auditEvent.objectId,
      });
      const res = await fetch(`/api/assistant/audit-events?${params.toString()}`);
      if (res.ok) {
        const payload = (await res.json()) as { events?: MemoryEvent[] };
        setMemoryEvents(Array.isArray(payload.events) ? payload.events : []);
      }
    }
    if (result.playbook) {
      const playbook = await postJson<{ run: { id: string; status: string } }>("/api/assistant/playbook-runs", {
        prompt,
        auditEventId: saved.auditEvent.id,
        objectType: saved.auditEvent.objectType,
        objectId: saved.auditEvent.objectId,
        playbook: result.playbook,
      });
      setPlaybookRun(playbook.run);
    }
  };

  const submitFeedback = async (next: "helpful" | "not_helpful") => {
    setFeedback(next);
    if (!auditEvent) return;
    try {
      await patchJson(`/api/assistant/audit-events/${auditEvent.id}/feedback`, { feedback: next });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save feedback.");
    }
  };

  const queueAction = async (action: ProposedAction) => {
    try {
      const payload = await postJson<{ item: { id: string } }>("/api/assistant/action-queue", {
        prompt,
        auditEventId: auditEvent?.id ?? null,
        objectType: auditEvent?.objectType ?? null,
        objectId: auditEvent?.objectId ?? null,
        action,
      });
      setQueuedActionIds((current) => ({ ...current, [action.id]: payload.item.id }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not queue action.");
    }
  };

  const markQueuedActionDone = async (actionId: string) => {
    const queueId = queuedActionIds[actionId];
    if (!queueId) return;
    try {
      await patchJson(`/api/assistant/action-queue/${queueId}`, { status: "DONE" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update queued action.");
    }
  };

  const updatePlaybookStep = async (stepId: string, stepStatus: "done" | "needs_review" | "skipped") => {
    setStepOverrides((current) => ({ ...current, [stepId]: stepStatus }));
    if (!playbookRun) return;
    try {
      await patchJson(`/api/assistant/playbook-runs/${playbookRun.id}`, { stepId, stepStatus });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update playbook step.");
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
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-950">
                  <p className="font-semibold uppercase tracking-wide">Quality & grounding</p>
                  <p className="mt-1">
                    Mode: {answer.quality?.mode ?? "deterministic"} · Generated:{" "}
                    {answer.quality?.generatedAt
                      ? new Date(answer.quality.generatedAt).toLocaleString()
                      : "just now"}
                  </p>
                  <p className="mt-1">
                    Grounded by:{" "}
                    {(answer.quality?.groundedBy && answer.quality.groundedBy.length > 0
                      ? answer.quality.groundedBy
                      : ["evidence links"]
                    ).join(", ")}
                  </p>
                  {answer.quality?.limitations && answer.quality.limitations.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc space-y-0.5 text-amber-950">
                      {answer.quality.limitations.map((limitation) => (
                        <li key={limitation}>{limitation}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-emerald-900">No known data limitations were reported by this answer.</p>
                  )}
                </div>
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
                {answer.playbook ? (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Playbook</p>
                    <h3 className="mt-1 text-sm font-semibold text-zinc-900">{answer.playbook.title}</h3>
                    <p className="mt-1 text-xs text-zinc-600">{answer.playbook.description}</p>
                    <ol className="mt-3 space-y-2">
                      {answer.playbook.steps.map((step, idx) => (
                        <li key={step.id} className="rounded-xl border border-white/80 bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-zinc-500">Step {idx + 1}</p>
                              <p className="mt-0.5 text-sm font-semibold text-zinc-900">{step.label}</p>
                              <p className="mt-1 text-xs text-zinc-600">{step.description}</p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                (stepOverrides[step.id] ?? step.status) === "done"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : (stepOverrides[step.id] ?? step.status) === "needs_review"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {(stepOverrides[step.id] ?? step.status).replace("_", " ")}
                            </span>
                          </div>
                          {playbookRun ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => void updatePlaybookStep(step.id, "done")}
                                className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                              >
                                Mark done
                              </button>
                              <button
                                type="button"
                                onClick={() => void updatePlaybookStep(step.id, "needs_review")}
                                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50"
                              >
                                Needs review
                              </button>
                            </div>
                          ) : null}
                          {step.actionIds && step.actionIds.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {step.actionIds.map((id) => {
                                const action = actionById.get(id);
                                if (!action) return null;
                                if (action.kind === "navigate") {
                                  return (
                                    <Link
                                      key={id}
                                      href={action.href}
                                      className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                    >
                                      {action.label}
                                    </Link>
                                  );
                                }
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => void copyActionText(action)}
                                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                  >
                                    {copiedActionId === action.id ? "Copied" : action.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {answer.actions && answer.actions.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Proposed actions</p>
                    <div className="mt-2 space-y-2">
                      {answer.actions.map((action) => (
                        <div key={action.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-sm font-semibold text-zinc-900">{action.label}</p>
                          <p className="mt-1 text-xs text-zinc-600">{action.description}</p>
                          {action.kind === "navigate" ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void queueAction(action)}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                              >
                                {queuedActionIds[action.id] ? "Queued" : "Queue for approval"}
                              </button>
                              <Link
                                href={action.href}
                                onClick={() => void markQueuedActionDone(action.id)}
                                className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                              >
                                Open
                              </Link>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => void queueAction(action)}
                                className="mr-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                              >
                                {queuedActionIds[action.id] ? "Queued" : "Queue for approval"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void copyActionText(action);
                                  void markQueuedActionDone(action.id);
                                }}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                              >
                                {copiedActionId === action.id ? "Copied" : "Copy draft"}
                              </button>
                              <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-700">
                                {action.text}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Feedback</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Feedback is saved to the assistant audit log for this answer.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void submitFeedback("helpful")}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        feedback === "helpful"
                          ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                          : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      Helpful
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitFeedback("not_helpful")}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        feedback === "not_helpful"
                          ? "border-amber-300 bg-amber-100 text-amber-950"
                          : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      Needs review
                    </button>
                  </div>
                  {feedback ? (
                    <p className="mt-2 text-xs text-zinc-600">
                      Feedback marked: {feedback === "helpful" ? "Helpful" : "Needs review"}.
                    </p>
                  ) : null}
                </div>
                {memoryEvents.length > 1 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Assistant memory</p>
                    <ul className="mt-2 space-y-2 text-xs text-zinc-600">
                      {memoryEvents.slice(1, 5).map((event) => (
                        <li key={event.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-2">
                          <p className="font-medium text-zinc-800">
                            {new Date(event.createdAt).toLocaleString()} · {event.actorName}
                          </p>
                          <p className="mt-1 line-clamp-2">{event.message ?? event.answerKind}</p>
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
