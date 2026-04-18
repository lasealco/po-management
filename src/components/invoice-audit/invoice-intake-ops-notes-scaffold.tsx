"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function InvoiceIntakeOpsNotesScaffold(props: {
  intakeId: string;
  canEdit: boolean;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(props.initialNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setText(props.initialNotes ?? "");
  }, [props.initialNotes]);

  async function save() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/invoice-audit/intakes/${props.intakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawSourceNotes: text.trim().length ? text : null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setOk("Ops notes saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Ops &amp; escalation notes</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Free-form context stored on the intake (carrier ticket ids, dispute references, who was contacted). This is
        separate from parsed invoice lines and from finance review — it exists so escalation and comms work outside
        the app still leave an audit trail here.
      </p>
      <textarea
        className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner disabled:opacity-50"
        rows={4}
        disabled={!props.canEdit || busy}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. DISPUTE-4412 · emailed carrier 4/12 · awaiting revised invoice"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!props.canEdit || busy}
          onClick={() => void save()}
          className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save ops notes"}
        </button>
        <span className="text-xs text-zinc-500">Max ~12k characters (server-enforced).</span>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="mt-2 text-sm text-emerald-800">{ok}</p> : null}
    </section>
  );
}
