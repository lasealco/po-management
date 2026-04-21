type ScenarioHistoryItem = {
  id: string;
  createdAt: Date;
  actorId: string | null;
  action: string;
  titleBefore: string | null;
  titleAfter: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
};

function formatDelta(before: string | null, after: string | null): string {
  if (before === after) {
    return "No change";
  }
  return `${before ?? "(empty)"} -> ${after ?? "(empty)"}`;
}

export function TwinScenarioHistoryTimeline({ items }: { items: ScenarioHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Revision history</h2>
        <p className="mt-2 text-sm text-zinc-600">
          No revisions yet. Updates to title or status will appear here as an audit timeline.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Revision history</h2>
      <p className="mt-1 text-xs text-zinc-500">Newest first. Expand a row to view title/status deltas.</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <details key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <summary className="cursor-pointer list-none pr-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-zinc-900">
                  {item.action} {item.actorId ? `by ${item.actorId}` : "by system"}
                </span>
                <span className="font-mono text-xs text-zinc-600">{item.createdAt.toISOString()}</span>
              </div>
            </summary>
            <div className="mt-3 grid gap-3 border-t border-zinc-200 pt-3 text-sm text-zinc-700 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Title delta</p>
                <p className="mt-1 break-words">{formatDelta(item.titleBefore, item.titleAfter)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status delta</p>
                <p className="mt-1 break-words">{formatDelta(item.statusBefore, item.statusAfter)}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
