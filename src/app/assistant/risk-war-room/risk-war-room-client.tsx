"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    openEvents: number;
    affectedObjects: number;
    highExposureObjects: number;
    activeRecommendations: number;
  };
  preview: {
    title: string;
    severity: string;
    riskScore: number;
    exposureMap: { topObjects?: Array<{ objectType: string; objectId: string; exposureScore: number; impactLevel: string | null }> };
    mitigationPlan: { steps?: Array<{ step: string; owner: string; action: string }>; activeRecommendationCount?: number };
  };
  rooms: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    riskScore: number;
    primaryScriEventId: string | null;
    scenarioDraftId: string | null;
    eventClusterJson: unknown;
    exposureMapJson: unknown;
    mitigationPlanJson: unknown;
    communicationDraftJson: unknown;
    actionQueueItemId: string | null;
    acknowledgedAt: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key: string): T[] {
  if (!value || typeof value !== "object") return [];
  const next = (value as Record<string, unknown>)[key];
  return Array.isArray(next) ? (next as T[]) : [];
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "string" ? next : "";
}

export function RiskWarRoomClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/risk-war-room", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load risk war room."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.roomId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/risk-war-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update risk war room."));
      return;
    }
    setMessage(success);
    if (raw && typeof raw === "object" && "snapshot" in raw) setData((raw as { snapshot: Snapshot }).snapshot);
    else await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP20</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Risk Intelligence War Room</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Cluster SCRI events, map affected shipments, suppliers, orders, and customers, create Twin scenario drafts,
          and queue mitigations with human approval. The assistant drafts work; it does not silently mutate operational records.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Cluster risk", "External events, geography, severity, and recommendations."],
            ["Step 2", "Map exposure", "Matched internal objects and high-exposure operational links."],
            ["Step 3", "Approve action", "Twin scenario, mitigations, and customer/supplier drafts."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Optional title or focus, e.g. Ningbo port disruption..."
            className="min-h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
          />
          <button
            type="button"
            disabled={busy === "create_war_room"}
            onClick={() => void post("create_war_room", { prompt }, "Risk war room created.")}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create war room
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Open events", data.signals.openEvents],
          ["Affected objects", data.signals.affectedObjects],
          ["High exposure", data.signals.highExposureObjects],
          ["Recommendations", data.signals.activeRecommendations],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Risk Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          {data.preview.severity} · risk {data.preview.riskScore}/100 · {data.preview.mitigationPlan.activeRecommendationCount ?? 0} active recommendations
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="font-semibold text-zinc-950">Top exposure</h4>
            <div className="mt-3 space-y-2">
              {(data.preview.exposureMap.topObjects ?? []).slice(0, 5).map((object) => (
                <div key={`${object.objectType}:${object.objectId}`} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-zinc-900">
                    {object.objectType} · {object.objectId}
                  </p>
                  <p className="text-zinc-600">Exposure {object.exposureScore}/100 · {object.impactLevel ?? "impact under review"}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="font-semibold text-zinc-950">Mitigation playbook</h4>
            <div className="mt-3 space-y-2">
              {(data.preview.mitigationPlan.steps ?? []).slice(0, 5).map((step) => (
                <div key={step.step} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-zinc-900">{step.step}</p>
                  <p className="text-zinc-600">{step.owner}: {step.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">War Rooms</h3>
        <div className="mt-4 space-y-4">
          {data.rooms.map((room) => {
            const clusters = readArray<{ clusterKey: string; eventCount: number; severity: string }>(room.eventClusterJson, "clusters");
            const topObjects = readArray<{ objectType: string; objectId: string; exposureScore: number }>(room.exposureMapJson, "topObjects");
            const internalDraft = readString(room.communicationDraftJson, "internal");
            return (
              <article key={room.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {room.status} · {room.severity} · risk {room.riskScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{room.title}</h4>
                    <p className="mt-1 text-xs text-zinc-500">
                      Primary SCRI {room.primaryScriEventId ?? "none"} · scenario {room.scenarioDraftId ?? "not drafted"} · updated {new Date(room.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === room.id || room.status === "MITIGATION_QUEUED"}
                      onClick={() => void post("queue_mitigation", { roomId: room.id, approvalNote: approvalNotes[room.id] ?? "" }, "Risk mitigation queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue mitigation
                    </button>
                    <button
                      type="button"
                      disabled={busy === room.id || room.status === "ACKNOWLEDGED"}
                      onClick={() => void post("acknowledge", { roomId: room.id }, "Risk war room acknowledged.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Clusters</p>
                    <p className="mt-1">{clusters.map((cluster) => `${cluster.severity} ${cluster.clusterKey} (${cluster.eventCount})`).join(", ") || "No clusters"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Top objects</p>
                    <p className="mt-1">{topObjects.slice(0, 5).map((object) => `${object.objectType}:${object.objectId} ${object.exposureScore}`).join(", ") || "No exposure"}</p>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{internalDraft}</pre>
                <textarea
                  value={approvalNotes[room.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [room.id]: event.target.value }))}
                  placeholder="Optional risk owner approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.rooms.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No risk war rooms yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
