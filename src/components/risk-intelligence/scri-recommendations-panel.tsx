"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { scriObjectHref } from "@/lib/scri/object-links";

export type ScriRecommendationRow = {
  id: string;
  recommendationType: string;
  recommendationTypeLabel: string;
  targetObjectType: string | null;
  targetObjectId: string | null;
  priority: number;
  confidence: number;
  expectedEffect: string | null;
  status: string;
  statusNote: string | null;
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-900";
    case "REJECTED":
      return "bg-zinc-200 text-zinc-800";
    case "SNOOZED":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-sky-100 text-sky-900";
  }
}

export function ScriRecommendationsPanel({
  canEdit,
  recommendations,
}: {
  canEdit: boolean;
  recommendations: ScriRecommendationRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function patchStatus(id: string, status: "ACCEPTED" | "REJECTED" | "SNOOZED") {
    setBusyId(id);
    setError(null);
    try {
      const raw = (notes[id] ?? "").trim();
      const res = await fetch(`/api/scri/recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          statusNote: raw.length ? raw : null,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Update failed.");
        return;
      }
      setNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Recommendations (R5)</p>
      <p className="mt-1 text-xs text-zinc-500">
        Rule-based next steps from event type, severity, and R2 exposure. Regenerated each time you run an R2
        match.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {!recommendations.length ? (
        <p className="mt-3 text-sm text-zinc-500">
          No recommendations yet. Run <span className="font-medium text-zinc-700">Refresh matches</span> above to
          generate them.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {recommendations.map((r) => {
            const targetHref =
              r.targetObjectType && r.targetObjectId
                ? scriObjectHref(r.targetObjectType, r.targetObjectId)
                : null;
            const isActive = r.status === "ACTIVE";
            return (
              <li
                key={r.id}
                className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm text-zinc-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{r.recommendationTypeLabel}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Priority {r.priority} · confidence {r.confidence}%
                      {r.targetObjectType && r.targetObjectId ? (
                        <>
                          {" · "}
                          {targetHref ? (
                            <Link
                              href={targetHref}
                              className="font-medium text-amber-800 underline-offset-2 hover:underline"
                            >
                              {r.targetObjectType.replace(/_/g, " ")}
                            </Link>
                          ) : (
                            <span>{r.targetObjectType.replace(/_/g, " ")}</span>
                          )}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(r.status)}`}
                  >
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>
                {r.expectedEffect ? (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">{r.expectedEffect}</p>
                ) : null}
                {r.statusNote ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-600">Note:</span> {r.statusNote}
                  </p>
                ) : null}
                {canEdit && isActive ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Optional note
                    </label>
                    <input
                      type="text"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 placeholder:text-zinc-400"
                      placeholder="Context for accept / reject / snooze"
                      maxLength={2000}
                      disabled={busyId === r.id}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => patchStatus(r.id, "ACCEPTED")}
                        className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => patchStatus(r.id, "SNOOZED")}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-50"
                      >
                        Snooze
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => patchStatus(r.id, "REJECTED")}
                        className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
