"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  generatedAt: string;
  score: number;
  status: string;
  signals: Record<string, number | boolean>;
  boardReport: {
    executiveSummary: string;
    limitations: string[];
    metrics: Record<string, number | boolean>;
  };
  demoScript: Array<{ step: number; title: string; href: string; talkTrack: string }>;
  latestReports: Array<{ id: string; title: string; status: string; score: number; summary: string; createdAt: string }>;
};

export function AssistantOperatingSystemClient({ initialSnapshot, canExport }: { initialSnapshot: Snapshot; canExport: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/operating-system", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load assistant operating system."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function exportReport() {
    if (!canExport) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/operating-system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "export_board_report" }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not export board report."));
      return;
    }
    setMessage("Board report exported and audit event recorded.");
    await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {!canExport ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Exporting the board report requires org.settings edit. You can still run the demo from this page.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP12</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Customer-Ready AI Operating System</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              One demo script and board report that ties chat, workbenches, evidence, governed automation, API Hub,
              Supply Chain Twin, admin controls, and human approval into one customer story.
            </p>
          </div>
          <div className={`rounded-2xl border px-6 py-4 text-center ${data.status === "CUSTOMER_READY" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">Operating score</p>
            <p className="mt-1 text-4xl font-semibold">{data.score}</p>
            <p className="text-sm">{data.status}</p>
          </div>
        </div>
        <p className="mt-5 rounded-xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-100">{data.boardReport.executiveSummary}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void exportReport()}
            disabled={!canExport || busy}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Export board report
          </button>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800">
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {Object.entries(data.signals).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{key.replaceAll(/([A-Z])/g, " $1")}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{String(value)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Customer Demo Runbook</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.demoScript.map((step) => (
            <article key={step.step} className="rounded-xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step {step.step}</p>
              <h4 className="mt-1 font-semibold text-zinc-900">{step.title}</h4>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{step.talkTrack}</p>
              <Link href={step.href} className="mt-3 inline-block text-sm font-semibold text-[var(--arscmp-primary)]">
                Open step
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Board Report Preview</h3>
          <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
            {JSON.stringify(data.boardReport, null, 2)}
          </pre>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Export History And Limits</h3>
          <div className="mt-4 space-y-3">
            {data.latestReports.length === 0 ? <p className="text-sm text-zinc-500">No board reports exported yet.</p> : null}
            {data.latestReports.map((report) => (
              <article key={report.id} className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{report.status} · {report.score}/100</p>
                <h4 className="mt-1 font-semibold text-zinc-900">{report.title}</h4>
                <p className="mt-2 text-sm text-zinc-600">{report.summary}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="font-semibold text-zinc-900">Operating limitations</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-600">
              {data.boardReport.limitations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
