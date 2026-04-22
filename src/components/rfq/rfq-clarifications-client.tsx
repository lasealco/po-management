"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { apiClientErrorMessage } from "@/lib/api-client-error";

export type ClarificationRow = {
  id: string;
  body: string;
  visibility: string;
  createdAt: string;
  authorName: string | null;
};

export function RfqClarificationsClient({
  requestId,
  canEdit,
  messages,
}: {
  requestId: string;
  canEdit: boolean;
  messages: ClarificationRow[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"INTERNAL" | "RECIPIENTS">("INTERNAL");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/rfq/requests/${requestId}/clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          visibility,
          metadata:
            visibility === "RECIPIENTS"
              ? { emailDraft: { note: "Not sent — reserved for future automation." } }
              : undefined,
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiClientErrorMessage(data, "Could not post message."));
        return;
      }
      setBody("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
        {messages.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">No clarification threads yet.</li>
        ) : null}
        {messages.map((m) => (
          <li key={m.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>{m.authorName ?? "User"}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  {m.createdAt} · {m.visibility}
                </span>
                <RecordIdCopy id={m.id} copyButtonLabel="Copy message id" />
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{m.body}</p>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
          <label className="block text-xs font-medium text-zinc-600">Visibility</label>
          <select
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "INTERNAL" | "RECIPIENTS")}
          >
            <option value="INTERNAL">Internal (buyer team only)</option>
            <option value="RECIPIENTS">Recipients (future email to all)</option>
          </select>
          <label className="mt-3 block text-xs font-medium text-zinc-600">Message</label>
          <textarea
            className="mt-1 min-h-[5rem] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask for clarification on free time, surcharges, validity…"
          />
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={() => void send()}
            className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            Post message
          </button>
        </div>
      ) : null}
    </div>
  );
}
