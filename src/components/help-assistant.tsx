"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { HelpDoAction } from "@/lib/help-actions";
import { HELP_PLAYBOOKS, type HelpPlaybook } from "@/lib/help-playbooks";

type ChatEntry = { role: "user" | "assistant"; text: string };
type HelpAction = { label: string; href: string };

function contextFromPath(pathname: string): { title: string; hint: string } {
  if (pathname.startsWith("/control-tower")) {
    return {
      title: "Control Tower",
      hint: "Shipments, workbench, reports, and digests — ask in plain language.",
    };
  }
  if (pathname.startsWith("/orders")) {
    return { title: "Orders", hint: "Workflow, splits, and queues — I can jump you to the right screen." };
  }
  if (pathname.startsWith("/consolidation")) {
    return { title: "Consolidation", hint: "Load plans and freight — ask how to plan or review." };
  }
  if (pathname.startsWith("/suppliers") || pathname.startsWith("/srm")) {
    return { title: "Suppliers", hint: "SRM, onboarding, and approvals — guided steps available." };
  }
  if (pathname.startsWith("/settings")) {
    return { title: "Settings", hint: "Users, roles, warehouses, and org options." };
  }
  if (pathname.startsWith("/wms")) {
    return { title: "WMS", hint: "Warehouse operations and stock — ask for the right area." };
  }
  if (pathname.startsWith("/crm")) {
    return { title: "CRM", hint: "Accounts, pipeline, and quotes — I can open the right view." };
  }
  if (pathname.startsWith("/reporting") || pathname.startsWith("/reports")) {
    return { title: "Reporting", hint: "Cross-module reporting hub — Control Tower has its own reports too." };
  }
  if (pathname.startsWith("/product-trace")) {
    return { title: "Product trace", hint: "SKU and shipment lineage — ask how to search or drill in." };
  }
  return {
    title: "Platform",
    hint: "Orders, logistics, CRM, and Control Tower — tell me what you want to accomplish.",
  };
}

function quickPromptsForPath(pathname: string): string[] {
  if (pathname.startsWith("/control-tower")) {
    return [
      "Open the shipment workbench",
      "How do I run a Control Tower report?",
      "Where is the customer digest?",
      "Explain exception codes",
    ];
  }
  if (pathname.startsWith("/orders")) {
    return [
      "Show orders that need my action",
      "How do I create a new purchase order?",
      "Where can I see order workflow?",
    ];
  }
  if (pathname.startsWith("/reporting")) {
    return ["Open Control Tower in the reporting hub", "What can I do on this page?"];
  }
  return [
    "Walk me through creating an order",
    "How does consolidation work?",
    "Open Control Tower home",
    "Where do I manage users?",
  ];
}

function GuideIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 18V5" />
      <path d="M8 8h8a4 4 0 0 1 4 4v1a3 3 0 0 1-3 3h-6l-3 3v-3H5a3 3 0 0 1-3-3V9a4 4 0 0 1 4-4z" />
    </svg>
  );
}

export function HelpAssistant() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
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

  const context = useMemo(() => contextFromPath(pathname), [pathname]);
  const quickPrompts = useMemo(() => quickPromptsForPath(pathname), [pathname]);

  const welcomeText = useMemo(
    () =>
      `Hi — I’m your **Guide**. You’re in **${context.title}**. ${context.hint} Try a quick prompt below, pick a playbook, or type your own question.`,
    [context],
  );

  const currentStep = useMemo(
    () => (playbook ? playbook.steps[Math.min(stepIdx, playbook.steps.length - 1)] : null),
    [playbook, stepIdx],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat, error, busy, actions, doActions, open]);

  useEffect(() => {
    function onPaletteOpenHelp() {
      setOpen(true);
    }
    window.addEventListener("po-help:open", onPaletteOpenHelp);
    return () => window.removeEventListener("po-help:open", onPaletteOpenHelp);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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

  const ask = useCallback(
    async (override?: string) => {
      const message = (override ?? input).trim();
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
        setError(payload?.error ?? "Guide could not respond. Try again in a moment.");
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
    },
    [input],
  );

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
      setError(payload?.error ?? "That action isn’t available for your account or page.");
      return;
    }
    setChat((prev) => [...prev, { role: "assistant", text: payload.message ?? "Done — taking you there now." }]);
    router.push(payload.href);
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

  /** Renders **bold** segments in assistant copy as <strong>. */
  function renderAssistantText(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-zinc-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close guide and backdrop"
          className="fixed inset-0 z-[68] bg-zinc-900/25 backdrop-blur-[2px] transition-opacity"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`fixed bottom-5 right-5 z-[72] flex items-center gap-2 rounded-full border border-white/30 bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_40px_-8px_rgba(22,91,103,0.55)] transition hover:brightness-[1.05] active:scale-[0.98] ${
          open ? "ring-2 ring-white/50" : "motion-safe:animate-[guide-pulse_3s_ease-in-out_infinite] motion-reduce:animate-none"
        }`}
      >
        <GuideIcon className="opacity-95" />
        {open ? "Close" : "Guide"}
      </button>

      {open ? (
        <aside
          role="dialog"
          aria-label="Guide — in-app help"
          className="fixed bottom-[4.5rem] right-4 z-[70] flex max-h-[min(85vh,40rem)] w-[min(100vw-2rem,26rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.35)] sm:right-5 sm:w-[26rem]"
        >
          <header className="relative shrink-0 border-b border-zinc-100 bg-gradient-to-br from-[var(--arscmp-primary-50)] via-white to-white px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-zinc-900">Guide</h2>
                  {llmUsed ? (
                    <span className="rounded-full bg-[var(--arscmp-primary-50)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/20">
                      AI assist
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/15">
                      Guided
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Guided paths, smart links, and optional AI — you stay in control.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close guide panel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-2 rounded-lg border border-[var(--arscmp-primary)]/15 bg-white/70 px-2.5 py-1.5 text-[11px] leading-snug text-zinc-700">
              <span className="font-semibold text-[var(--arscmp-primary)]">Now:</span> {context.title} —{" "}
              {context.hint}{" "}
              <span className="text-zinc-500">
                Nothing runs until you tap an action. Press Esc to close.
              </span>
            </p>
            {resumeHint ? (
              <button
                type="button"
                onClick={resumeGuide}
                className="mt-2 w-full rounded-lg border border-[var(--arscmp-primary)]/25 bg-[var(--arscmp-primary-50)] px-3 py-2 text-left text-xs font-medium text-[var(--arscmp-primary)] transition hover:bg-[var(--arscmp-primary)]/10"
              >
                Resume your last guide →
              </button>
            ) : null}
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Playbooks</p>
            <div className="mt-1.5 flex max-h-[5.5rem] flex-wrap gap-1 overflow-y-auto pr-0.5">
              {HELP_PLAYBOOKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => startPlaybook(p)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    playbook?.id === p.id
                      ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] text-white shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </header>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 py-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Guide
              </span>
              <div className="max-w-[95%] rounded-2xl border border-[var(--arscmp-primary)]/20 bg-gradient-to-br from-[var(--arscmp-primary-50)] to-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800 shadow-sm">
                {renderAssistantText(welcomeText)}
              </div>
            </div>
            {chat.map((row, idx) => (
              <div
                key={`${row.role}-${idx}`}
                className={`flex flex-col gap-0.5 ${row.role === "assistant" ? "items-start" : "items-end"}`}
              >
                <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {row.role === "assistant" ? "Guide" : "You"}
                </span>
                <div
                  className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    row.role === "assistant"
                      ? "border border-zinc-100 bg-zinc-50 text-zinc-800 shadow-sm"
                      : "bg-[var(--arscmp-primary)] text-white shadow-sm"
                  }`}
                >
                  {row.role === "assistant" ? renderAssistantText(row.text) : row.text}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--arscmp-primary)]" />
                Thinking…
              </div>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
            ) : null}
            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {actions.map((action) => (
                  <button
                    key={`${action.label}-${action.href}`}
                    type="button"
                    onClick={() => {
                      window.location.href = action.href;
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm transition hover:border-[var(--arscmp-primary)]/40 hover:bg-[var(--arscmp-primary-50)]"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
            {doActions.length > 0 ? (
              <div className="space-y-1.5 rounded-xl border border-[var(--arscmp-primary)]/15 bg-[var(--arscmp-primary-50)]/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--arscmp-primary)]">Do it for me</p>
                <div className="flex flex-wrap gap-1.5">
                  {doActions.map((action) => {
                    const key = `${action.type}:${action.label}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={doBusyKey !== null}
                        onClick={() => void runDoAction(action)}
                        className="rounded-lg border border-[var(--arscmp-primary)]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--arscmp-primary)] shadow-sm transition hover:bg-[var(--arscmp-primary-50)] disabled:opacity-50"
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
            <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{playbook.title}</p>
              {currentStep ? (
                <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <p className="text-sm font-semibold text-zinc-900">
                    Step {stepIdx + 1} of {playbook.steps.length}: {currentStep.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">{currentStep.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentStep.href ? (
                      <button
                        type="button"
                        onClick={() =>
                          (window.location.href = `${currentStep.href}?guide=${playbook.id}&step=${stepIdx}`)
                        }
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100"
                      >
                        Take me there
                      </button>
                    ) : null}
                    {currentStep.doAction ? (
                      <button
                        type="button"
                        disabled={doBusyKey !== null}
                        onClick={() => void runDoAction(currentStep.doAction!, "step:")}
                        className="rounded-lg border border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--arscmp-primary-700)] disabled:opacity-50"
                      >
                        {doBusyKey === `step:${currentStep.doAction.type}:${currentStep.doAction.label}`
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
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={stepIdx >= playbook.steps.length - 1}
                  onClick={() => setStepIdx((s) => Math.min(playbook.steps.length - 1, s + 1))}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-zinc-100 bg-white p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Try asking</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {quickPrompts.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(s)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-[var(--arscmp-primary)]/35 hover:bg-[var(--arscmp-primary-50)] hover:text-zinc-900 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            {suggestions.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => runSuggestion(s)}
                    className="rounded-full border border-[var(--arscmp-primary)]/20 bg-[var(--arscmp-primary-50)] px-2.5 py-1 text-[11px] font-medium text-[var(--arscmp-primary)] transition hover:bg-[var(--arscmp-primary)]/10"
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
                placeholder="What do you want to do?"
                className="h-10 flex-1 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 text-sm text-zinc-900 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-[var(--arscmp-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--arscmp-primary)]/20"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void ask()}
                className="h-10 shrink-0 rounded-xl bg-[var(--arscmp-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.05] disabled:opacity-50"
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
