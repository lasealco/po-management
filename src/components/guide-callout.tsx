"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { HelpDoAction } from "@/lib/help-actions";
import { HELP_PLAYBOOKS } from "@/lib/help-playbooks";

export function GuideCallout() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [doBusy, setDoBusy] = useState(false);
  const [doError, setDoError] = useState<string | null>(null);
  const guideId = params.get("guide");
  const stepRaw = params.get("step");
  const stepIdx = Math.max(0, Number(stepRaw ?? "0") || 0);

  const guide = useMemo(
    () => HELP_PLAYBOOKS.find((p) => p.id === guideId) ?? null,
    [guideId],
  );

  useEffect(() => {
    setDoError(null);
  }, [guideId, stepIdx]);

  if (!guide) return null;

  const step = guide.steps[Math.min(stepIdx, guide.steps.length - 1)];
  const onTarget = step.href ? pathname.startsWith(step.href) : false;

  async function runStepDoAction(action: HelpDoAction) {
    setDoBusy(true);
    setDoError(null);
    try {
      const res = await fetch("/api/help/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; href?: string; error?: string }
        | null;
      if (res.ok && payload?.ok && payload.href) {
        window.location.href = payload.href;
        return;
      }
      setDoError(payload?.error ?? "Action could not run.");
    } finally {
      setDoBusy(false);
    }
  }

  function go(step: number) {
    if (!guide) return;
    const next = new URL(window.location.href);
    next.searchParams.set("guide", guide.id);
    next.searchParams.set("step", String(Math.max(0, Math.min(guide.steps.length - 1, step))));
    if (guide.steps[Math.max(0, Math.min(guide.steps.length - 1, step))].href) {
      next.pathname = guide.steps[Math.max(0, Math.min(guide.steps.length - 1, step))].href!;
    }
    window.location.href = next.toString();
  }

  return (
    <div className="sticky top-0 z-30 border-b border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        <span className="rounded bg-violet-200 px-1.5 py-0.5 text-xs font-semibold">
          Guide
        </span>
        <span className="font-medium">{guide.title}</span>
        <span className="text-xs text-violet-700">
          Step {Math.min(stepIdx, guide.steps.length - 1) + 1}/{guide.steps.length}
        </span>
        <span className="text-xs text-violet-800">{step.title}</span>
        <span className="text-xs text-violet-700">{step.description}</span>
        {step.href ? (
          <button
            type="button"
            onClick={() => (window.location.href = `${step.href}?guide=${guide.id}&step=${stepIdx}`)}
            className="rounded border border-violet-300 bg-white px-2 py-0.5 text-xs"
          >
            {onTarget ? "On this step" : "Take me there"}
          </button>
        ) : null}
        {step.doAction ? (
          <button
            type="button"
            disabled={doBusy}
            onClick={() => void runStepDoAction(step.doAction!)}
            className="rounded border border-violet-500 bg-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-950 disabled:opacity-50"
          >
            {doBusy ? "…" : "Do this step"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={stepIdx <= 0}
          onClick={() => go(stepIdx - 1)}
          className="rounded border border-violet-300 bg-white px-2 py-0.5 text-xs disabled:opacity-50"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={stepIdx >= guide.steps.length - 1}
          onClick={() => go(stepIdx + 1)}
          className="rounded border border-violet-300 bg-white px-2 py-0.5 text-xs disabled:opacity-50"
        >
          Next
        </button>
        {doError ? (
          <span className="w-full text-xs text-red-700 sm:w-auto">{doError}</span>
        ) : null}
      </div>
    </div>
  );
}
