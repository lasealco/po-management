"use client";

import { useEffect, useMemo, useState } from "react";
import type { HelpDoAction } from "@/lib/help-actions";
import { HELP_PLAYBOOKS, type HelpPlaybook } from "@/lib/help-playbooks";

type ChatEntry = { role: "user" | "assistant"; text: string };
type HelpAction = { label: string; href: string };

export function HelpAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([
    {
      role: "assistant",
      text: "Hi, I can guide you through orders, suppliers, consolidation, and users. Ask me what you want to do.",
    },
  ]);
  const [playbook, setPlaybook] = useState<HelpPlaybook | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [actions, setActions] = useState<HelpAction[]>([]);
  const [doActions, setDoActions] = useState<HelpDoAction[]>([]);
  const [doBusyKey, setDoBusyKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [resumeHint, setResumeHint] = useState<{ playbookId: string; stepIdx: number } | null>(
    null,
  );
  const [llmUsed, setLlmUsed] = useState(false);

  const currentStep = useMemo(
    () => (playbook ? playbook.steps[Math.min(stepIdx, playbook.steps.length - 1)] : null),
    [playbook, stepIdx],
  );

  useEffect(() => {
    function onPaletteOpenHelp() {
      setOpen(true);
    }
    window.addEventListener("po-help:open", onPaletteOpenHelp);
    return () => window.removeEventListener("po-help:open", onPaletteOpenHelp);
  }, []);

  useEffect(() => {
    if (!open || progressLoaded) return;
    void (async () => {
      const res = await fetch("/api/help/progress", { method: "GET" });
      const payload = (await res.json().catch(() => null)) as
        | { progress?: { playbookId?: string; stepIdx?: number } | null }
        | null;
      if (res.ok && payload?.progress?.playbookId && Number.isFinite(payload.progress.stepIdx)) {
        setResumeHint({
          playbookId: payload.progress.playbookId,
          stepIdx: Math.max(0, Math.floor(payload.progress.stepIdx ?? 0)),
        });
      }
      setProgressLoaded(true);
    })();
  }, [open, progressLoaded]);

  useEffect(() => {
    if (!playbook) return;
    void fetch("/api/help/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playbookId: playbook.id, stepIdx }),
    });
  }, [playbook, stepIdx]);

  async function ask() {
    const message = input.trim();
    if (!message) return;
    setBusy(true);
    setError(null);
    setChat((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    const res = await fetch("/api/help/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, currentPath: window.location.pathname }),
    });
    const payload = (await res.json().catch(() => null)) as
      | {
          answer?: string;
          playbook?: HelpPlaybook | null;
          suggestions?: string[];
          actions?: HelpAction[];
          doActions?: HelpDoAction[];
          llmUsed?: boolean;
          error?: string;
        }
      | null;
    setBusy(false);
    if (!res.ok) {
      setError(payload?.error ?? "Help assistant failed.");
      return;
    }
    setLlmUsed(Boolean(payload?.llmUsed));
    if (payload?.answer) {
      setChat((prev) => [...prev, { role: "assistant", text: payload.answer! }]);
    }
    if (payload?.playbook) {
      setPlaybook(payload.playbook);
      setStepIdx(0);
      setResumeHint({ playbookId: payload.playbook.id, stepIdx: 0 });
    }
    setActions(payload?.actions ?? []);
    setDoActions(Array.isArray(payload?.doActions) ? payload!.doActions! : []);
    setSuggestions(payload?.suggestions ?? []);
  }

  async function runDoAction(action: HelpDoAction, keyPrefix = "") {
    const key = `${keyPrefix}${action.type}:${action.label}`;
    setDoBusyKey(key);
    setError(null);
    const res = await fetch("/api/help/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await res.json().catch(() => null)) as
      | { ok?: boolean; href?: string; message?: string; error?: string }
      | null;
    setDoBusyKey(null);
    if (!res.ok || !payload?.ok || !payload.href) {
      setError(payload?.error ?? "Could not run that action.");
      return;
    }
    setChat((prev) => [...prev, { role: "assistant", text: payload.message ?? "Done." }]);
    window.location.href = payload.href;
  }

  function runSuggestion(text: string) {
    setInput(text);
  }

  function resumeGuide() {
    if (!resumeHint) return;
    const matched = HELP_PLAYBOOKS.find((p) => p.id === resumeHint.playbookId) ?? null;
    if (!matched) return;
    setPlaybook(matched);
    setStepIdx(Math.min(Math.max(0, resumeHint.stepIdx), matched.steps.length - 1));
  }

  function startPlaybook(p: HelpPlaybook) {
    setPlaybook(p);
    setStepIdx(0);
    setResumeHint({ playbookId: p.id, stepIdx: 0 });
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
      >
        {open ? "Close help" : "Help"}
      </button>
      {open ? (
        <aside className="fixed bottom-20 right-5 z-40 w-[22rem] rounded-xl border border-zinc-200 bg-white shadow-2xl">
          <div className="border-b border-zinc-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">Guided Help Assistant</h3>
              {llmUsed ? (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-900">
                  AI answer
                </span>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                  Guided
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Ask what you want to do, follow guided steps, or get AI suggestions when your API key is enabled.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {resumeHint ? (
                <button
                  type="button"
                  onClick={resumeGuide}
                  className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-xs text-violet-900"
                >
                  Resume last guide
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Start a guide
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {HELP_PLAYBOOKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => startPlaybook(p)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    playbook?.id === p.id
                      ? "border-violet-500 bg-violet-100 text-violet-950"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto px-4 py-3 text-sm">
            {chat.map((row, idx) => (
              <div
                key={`${row.role}-${idx}`}
                className={`rounded-lg px-3 py-2 ${
                  row.role === "assistant"
                    ? "bg-zinc-100 text-zinc-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {row.text}
              </div>
            ))}
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {actions.map((action) => (
                  <button
                    key={`${action.label}-${action.href}`}
                    type="button"
                    onClick={() => (window.location.href = action.href)}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
            {doActions.length > 0 ? (
              <div className="space-y-1 border-t border-violet-100 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  Do it for me
                </p>
                <div className="flex flex-wrap gap-1">
                  {doActions.map((action) => {
                    const key = `${action.type}:${action.label}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={doBusyKey !== null}
                        onClick={() => void runDoAction(action)}
                        className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-950 disabled:opacity-50"
                      >
                        {doBusyKey === key ? "…" : action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {playbook ? (
            <div className="border-t border-zinc-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {playbook.title}
              </p>
              {currentStep ? (
                <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-medium text-zinc-900">
                    Step {stepIdx + 1}: {currentStep.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-700">{currentStep.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentStep.href ? (
                      <button
                        type="button"
                        onClick={() =>
                          (window.location.href = `${currentStep.href}?guide=${playbook.id}&step=${stepIdx}`)
                        }
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800"
                      >
                        Take me there
                      </button>
                    ) : null}
                    {currentStep.doAction ? (
                      <button
                        type="button"
                        disabled={doBusyKey !== null}
                        onClick={() => void runDoAction(currentStep.doAction!, "step:")}
                        className="rounded border border-violet-400 bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-950 disabled:opacity-50"
                      >
                        {doBusyKey ===
                        `step:${currentStep.doAction.type}:${currentStep.doAction.label}`
                          ? "…"
                          : "Do this step"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={stepIdx <= 0}
                  onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={stepIdx >= playbook.steps.length - 1}
                  onClick={() => setStepIdx((s) => Math.min(playbook.steps.length - 1, s + 1))}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          <div className="border-t border-zinc-100 p-3">
            {suggestions.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => runSuggestion(s)}
                    className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void ask();
                }}
                placeholder="Ask: I want to create an order..."
                className="h-9 flex-1 rounded border border-zinc-300 px-2 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void ask()}
                className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
