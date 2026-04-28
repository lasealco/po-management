"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type EvidenceItem = {
  sourceType: string;
  sourceId: string | null;
  title: string;
  summary: string;
  severity: "INFO" | "WARN" | "ERROR";
  href: string;
  evidence: unknown;
};

type ReviewItem = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  summary: string;
  severity: string;
  status: string;
  actionQueueItemId: string | null;
  assistantEvidenceRecordId: string | null;
  createdAt: string;
};

type Payload = {
  generatedAt: string;
  metrics: Record<string, number>;
  evidence: EvidenceItem[];
  mappingJobs: Array<{ id: string; status: string; errorMessage: string | null; updatedAt: string }>;
  reviewItems: ReviewItem[];
};

function errorMessage(raw: unknown, fallback: string) {
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return fallback;
}

const severityClass: Record<string, string> = {
  INFO: "border-sky-200 bg-sky-50 text-sky-900",
  WARN: "border-amber-200 bg-amber-50 text-amber-950",
  ERROR: "border-rose-200 bg-rose-50 text-rose-900",
};

export function ApiHubAssistantClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/apihub/assistant-evidence");
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(errorMessage(raw, "Could not load API Hub assistant evidence."));
      return;
    }
    setData(raw as Payload);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createReview(item: EvidenceItem) {
    setBusy(`${item.sourceType}:${item.sourceId ?? item.title}`);
    setError(null);
    const res = await fetch("/api/apihub/assistant-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_review_item", ...item }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(errorMessage(raw, "Could not create assistant review item."));
      return;
    }
    await load();
  }

  async function closeReview(id: string) {
    setBusy(id);
    const res = await fetch("/api/apihub/assistant-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close_review_item", id, sourceType: "review_item", title: "Close", summary: "Close review" }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(errorMessage(raw, "Could not close review item."));
      return;
    }
    await load();
  }

  if (!data) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">Loading API Hub assistant evidence...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP9</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">API Hub assistant evidence</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Convert connector, staging, mapping, and conflict signals into assistant evidence and reviewable work without exposing secrets or applying data silently.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">
            Refresh
          </button>
        </div>
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {Object.entries(data.metrics).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <p className="text-xs text-zinc-500">{key}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-950">Assistant-readable evidence</h3>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {data.evidence.map((item) => (
            <article key={`${item.sourceType}:${item.sourceId ?? item.title}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.sourceType} {item.sourceId ? `· ${item.sourceId}` : ""}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${severityClass[item.severity] ?? severityClass.INFO}`}>
                  {item.severity}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-700">{item.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={item.href} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                  Open source
                </Link>
                <button
                  disabled={busy === `${item.sourceType}:${item.sourceId ?? item.title}`}
                  onClick={() => void createReview(item)}
                  className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Create assistant review item
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Review work created</h3>
          <div className="mt-3 space-y-2">
            {data.reviewItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.status} · action {item.actionQueueItemId ?? "not queued"} · evidence {item.assistantEvidenceRecordId ?? "none"}
                    </p>
                  </div>
                  {item.status !== "CLOSED" ? (
                    <button
                      disabled={busy === item.id}
                      onClick={() => void closeReview(item.id)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Mapping jobs</h3>
          <div className="mt-3 space-y-2">
            {data.mappingJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
                <p className="font-semibold text-zinc-900">{job.status}</p>
                <p className="mt-1 text-xs text-zinc-500">{job.id} · {new Date(job.updatedAt).toLocaleString()}</p>
                {job.errorMessage ? <p className="mt-1 text-xs text-rose-700">{job.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
