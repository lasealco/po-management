"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type UserOption = { id: string; name: string | null; email: string };
type WorkAction = {
  id: string;
  label: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  stale: boolean;
  objectType: string | null;
  objectId: string | null;
  objectHref: string | null;
  owner: UserOption | null;
};
type Template = {
  id: string;
  playbookId: string;
  title: string;
  description: string | null;
  objectType: string | null;
  priority: string;
  slaHours: number | null;
  steps: unknown;
};
type Run = {
  id: string;
  playbookId: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  stale: boolean;
  objectHref: string | null;
  owner: UserOption | null;
  steps: unknown;
};
type Memory = {
  id: string;
  surface: string;
  answerKind: string;
  message: string | null;
  objectType: string | null;
  objectId: string | null;
  feedback: string | null;
  createdAt: string;
};
type WorkEnginePayload = {
  generatedAt: string;
  users: UserOption[];
  metrics: Record<string, number>;
  actions: WorkAction[];
  templates: Template[];
  runs: Run[];
  memory: Memory[];
};

const priorityClass: Record<string, string> = {
  LOW: "border-zinc-200 bg-zinc-50 text-zinc-700",
  MEDIUM: "border-sky-200 bg-sky-50 text-sky-900",
  HIGH: "border-amber-200 bg-amber-50 text-amber-950",
  URGENT: "border-rose-200 bg-rose-50 text-rose-900",
};

function stepsCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export function AssistantWorkEngineClient() {
  const [data, setData] = useState<WorkEnginePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState("Shipment recovery handoff");
  const [templateSteps, setTemplateSteps] = useState("Review evidence\nAssign owner\nSend update\nClose loop");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/assistant/work-engine");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load assistant work engine."));
      return;
    }
    setData(raw as WorkEnginePayload);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function patchAction(id: string, status: string, decisionNote?: string) {
    setBusy(id);
    const res = await fetch(`/api/assistant/action-queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, decisionNote }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update action."));
      return;
    }
    await load();
  }

  async function createTemplate() {
    setBusy("template");
    const res = await fetch("/api/assistant/playbook-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: templateTitle,
        priority: "HIGH",
        slaHours: 24,
        steps: templateSteps
          .split("\n")
          .map((title) => title.trim())
          .filter(Boolean)
          .map((title, idx) => ({ id: `step-${idx + 1}`, title })),
      }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not save template."));
      return;
    }
    await load();
  }

  async function runTemplate(template: Template) {
    setBusy(template.id);
    const res = await fetch("/api/assistant/playbook-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playbook: {
          id: template.playbookId,
          title: template.title,
          priority: template.priority,
          slaHours: template.slaHours,
          steps: template.steps,
        },
        priority: template.priority,
      }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not start playbook."));
      return;
    }
    await load();
  }

  async function finishRun(run: Run) {
    const steps = Array.isArray(run.steps) ? run.steps : [];
    const firstOpen = steps.find((step) => step && typeof step === "object" && (step as Record<string, unknown>).status !== "done");
    const stepId = firstOpen && typeof firstOpen === "object" ? String((firstOpen as Record<string, unknown>).id ?? "") : "";
    setBusy(run.id);
    const res = await fetch(`/api/assistant/playbook-runs/${run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stepId ? { stepId, stepStatus: "done", note: "Completed from AMP6 work engine." } : { status: "COMPLETED" }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update playbook run."));
      return;
    }
    await load();
  }

  async function archiveMemory(id: string) {
    setBusy(id);
    const res = await fetch("/api/assistant/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], archiveReason: "Cleaned up from AMP6 work engine" }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not archive memory."));
      return;
    }
    await load();
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
        Loading AMP6 work engine...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP6</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Assistant work engine</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Run the assistant like an operations queue: assigned actions, SLA playbooks, stale work, and cleanup for object-linked memory.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">
            Refresh
          </button>
        </div>
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-6">
          {Object.entries(data.metrics).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">{key}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-950">Action queue</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.actions.map((action) => (
            <article key={action.id} className={`rounded-2xl border p-4 ${action.stale ? "border-rose-200 bg-rose-50" : "border-zinc-100 bg-zinc-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950">{action.label}</p>
                  <p className="mt-1 text-xs text-zinc-500">{action.description ?? "No description"}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityClass[action.priority] ?? priorityClass.MEDIUM}`}>
                  {action.priority}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {action.owner ? `Owner ${action.owner.name ?? action.owner.email}` : "No owner"} · Due{" "}
                {action.dueAt ? new Date(action.dueAt).toLocaleString() : "not set"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {action.objectHref ? (
                  <Link href={action.objectHref} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                    Open object
                  </Link>
                ) : null}
                <button disabled={busy === action.id} onClick={() => void patchAction(action.id, "APPROVED")} className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  Approve
                </button>
                <button disabled={busy === action.id} onClick={() => void patchAction(action.id, "DONE", "Completed from AMP6 work engine.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50">
                  Done
                </button>
                <button disabled={busy === action.id} onClick={() => void patchAction(action.id, "REJECTED", "Rejected from AMP6 work engine.")} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50">
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Playbook templates</h3>
          <div className="mt-3 space-y-2">
            {data.templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <p className="font-semibold text-zinc-900">{template.title}</p>
                <p className="text-xs text-zinc-500">{stepsCount(template.steps)} steps · SLA {template.slaHours ?? "none"}h</p>
                <button disabled={busy === template.id} onClick={() => void runTemplate(template)} className="mt-2 rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  Start run
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-3">
            <input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <textarea value={templateSteps} onChange={(e) => setTemplateSteps(e.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <button disabled={busy === "template"} onClick={() => void createTemplate()} className="mt-2 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Save template
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Active playbook runs</h3>
          <div className="mt-3 space-y-2">
            {data.runs.map((run) => (
              <div key={run.id} className={`rounded-xl border p-3 ${run.stale ? "border-rose-200 bg-rose-50" : "border-zinc-100 bg-zinc-50"}`}>
                <p className="font-semibold text-zinc-900">{run.title}</p>
                <p className="text-xs text-zinc-500">
                  {run.status} · {stepsCount(run.steps)} steps · Due {run.dueAt ? new Date(run.dueAt).toLocaleString() : "not set"}
                </p>
                <button disabled={busy === run.id} onClick={() => void finishRun(run)} className="mt-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50">
                  Complete next step
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-950">Object memory cleanup</h3>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {data.memory.map((event) => (
            <div key={event.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
              <p className="font-semibold text-zinc-900">{event.answerKind}</p>
              <p className="mt-1 text-xs text-zinc-500">{event.message ?? "No message"} · {new Date(event.createdAt).toLocaleString()}</p>
              <p className="mt-1 text-xs text-zinc-500">{event.objectType ?? "No object"} {event.objectId ?? ""}</p>
              <button disabled={busy === event.id} onClick={() => void archiveMemory(event.id)} className="mt-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50">
                Archive memory
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
