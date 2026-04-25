import Link from "next/link";

export type AssistantTimelineEvent = {
  id: string;
  label: string;
  description: string;
  href?: string | null;
  at: string | Date;
};

export function AssistantObjectTimeline({ events }: { events: AssistantTimelineEvent[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Assistant timeline</p>
      <h2 className="mt-1 text-base font-semibold text-zinc-900">AI-assisted activity</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Trace customer messages, drafts, and confirmations that touched this object.
      </p>
      <ol className="mt-4 space-y-3">
        {events.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
            No assistant activity linked yet.
          </li>
        ) : (
          events.map((event) => (
            <li key={event.id} className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900">{event.label}</p>
                  <p className="mt-1 text-zinc-600">{event.description}</p>
                  <p className="mt-1 text-xs text-zinc-500">{new Date(event.at).toLocaleString()}</p>
                </div>
                {event.href ? (
                  <Link
                    href={event.href}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
