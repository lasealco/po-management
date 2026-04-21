"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TwinScenarioTitleInlineEditorProps = {
  draftId: string;
  initialTitle: string | null;
};

export function TwinScenarioTitleInlineEditor(props: TwinScenarioTitleInlineEditorProps) {
  const { draftId, initialTitle } = props;
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleLabel = title.trim() ? title.trim() : "Untitled draft";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/supply-chain-twin/scenarios/${encodeURIComponent(draftId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (response.ok) {
        setTitle(nextTitle);
        setIsEditing(false);
        router.refresh();
        return;
      }
      if (response.status === 403) {
        setError("You no longer have access to edit this scenario draft.");
        return;
      }
      if (response.status === 404) {
        setError("This scenario draft no longer exists.");
        return;
      }
      setError("Unable to rename this scenario draft right now.");
    } catch {
      setError("Unable to rename this scenario draft right now.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{titleLabel}</h1>
      {isEditing ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={onSubmit}
        >
          <label className="sr-only" htmlFor="scenario-title-input">
            Scenario title
          </label>
          <input
            id="scenario-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            disabled={isSaving}
            className="w-full max-w-xl rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-[var(--arscmp-primary)]/20 placeholder:text-zinc-400 focus:ring-2 disabled:opacity-60"
            placeholder="Untitled draft"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save title"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              setTitle(initialTitle ?? "");
              setIsEditing(false);
              setError(null);
            }}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setError(null);
            }}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
          >
            Rename title
          </button>
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
