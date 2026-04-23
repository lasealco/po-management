"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const REVIEW_STATES = [
  "NEW",
  "UNDER_REVIEW",
  "WATCH",
  "ACTION_REQUIRED",
  "DISMISSED",
  "RESOLVED",
] as const;

export type ScriAssignableUser = { id: string; name: string; email: string };

export function ScriTriagePanel({
  eventId,
  initialReviewState,
  initialOwnerId,
  assignableUsers,
}: {
  eventId: string;
  initialReviewState: string;
  initialOwnerId: string | null;
  assignableUsers: ScriAssignableUser[];
}) {
  const router = useRouter();
  const [reviewState, setReviewState] = useState(initialReviewState);
  const [ownerId, setOwnerId] = useState(initialOwnerId ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskRef, setTaskRef] = useState("");
  const [taskModule, setTaskModule] = useState("MANUAL");
  const [taskNote, setTaskNote] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  async function saveTriage() {
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {};
      if (reviewState !== initialReviewState) patch.reviewState = reviewState;
      const nextOwner = ownerId === "" ? null : ownerId;
      const prevOwner = initialOwnerId ?? null;
      if (nextOwner !== prevOwner) patch.ownerUserId = nextOwner;
      const trimmed = note.trim();
      if (trimmed.length > 0) patch.note = trimmed;

      if (Object.keys(patch).length === 0) {
        setError("Change review state, owner, or add a note.");
        return;
      }

      const res = await fetch(`/api/scri/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Update failed.");
        return;
      }
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTaskLink() {
    setTaskBusy(true);
    setTaskError(null);
    try {
      const ref = taskRef.trim();
      if (!ref.length) {
        setTaskError("Task reference is required.");
        return;
      }
      const res = await fetch(`/api/scri/events/${eventId}/task-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceModule: taskModule.trim() || "MANUAL",
          taskRef: ref,
          note: taskNote.trim() || null,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setTaskError(payload.error ?? "Request failed.");
        return;
      }
      setTaskRef("");
      setTaskNote("");
      router.refresh();
    } finally {
      setTaskBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
      <p className="mt-1 text-sm text-zinc-600">
        Triage this event: review state, owner, and optional notes are recorded in an audit trail.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor={`scri-review-${eventId}`}>
            Review state
          </label>
          <select
            id={`scri-review-${eventId}`}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={reviewState}
            onChange={(ev) => setReviewState(ev.target.value)}
          >
            {REVIEW_STATES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor={`scri-owner-${eventId}`}>
            Owner
          </label>
          <select
            id={`scri-owner-${eventId}`}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={ownerId}
            onChange={(ev) => setOwnerId(ev.target.value)}
          >
            <option value="">Unassigned</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs font-medium text-zinc-600" htmlFor={`scri-note-${eventId}`}>
          Note (optional)
        </label>
        <textarea
          id={`scri-note-${eventId}`}
          rows={3}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          placeholder="Context for the team — appended to the triage log."
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveTriage()}
          className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save triage"}
        </button>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <div className="mt-8 border-t border-zinc-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">External task link</p>
        <p className="mt-1 text-sm text-zinc-600">
          Track a ticket URL or ID from Jira, Asana, email thread, etc.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor={`scri-tm-${eventId}`}>
              Source
            </label>
            <input
              id={`scri-tm-${eventId}`}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={taskModule}
              onChange={(ev) => setTaskModule(ev.target.value)}
              placeholder="MANUAL"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600" htmlFor={`scri-tr-${eventId}`}>
              Reference / URL
            </label>
            <input
              id={`scri-tr-${eventId}`}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={taskRef}
              onChange={(ev) => setTaskRef(ev.target.value)}
              placeholder="https://… or TICKET-123"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600" htmlFor={`scri-tn-${eventId}`}>
              Note (optional)
            </label>
            <input
              id={`scri-tn-${eventId}`}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={taskNote}
              onChange={(ev) => setTaskNote(ev.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={taskBusy}
          onClick={() => void addTaskLink()}
          className="mt-3 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
        >
          {taskBusy ? "Adding…" : "Add task link"}
        </button>
        {taskError ? <p className="mt-2 text-xs text-red-600">{taskError}</p> : null}
      </div>
    </section>
  );
}
