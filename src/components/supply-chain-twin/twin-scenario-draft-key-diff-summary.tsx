import type { DraftNestedPathEntryV1, DraftTopLevelKeyDiffV1 } from "./scenario-draft-compare-summary";

function KeyList(props: { title: string; keys: string[]; tone: "zinc" | "emerald" | "amber" | "rose" }) {
  const { title, keys, tone } = props;
  const toneCls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/90 text-amber-950"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50/90 text-rose-950"
          : "border-zinc-200 bg-zinc-50/90 text-zinc-900";
  if (keys.length === 0) {
    return (
      <div className={`rounded-xl border px-3 py-2 text-xs ${toneCls}`}>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-zinc-600">—</p>
      </div>
    );
  }
  const shown = keys.slice(0, 24);
  const more = keys.length - shown.length;
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${toneCls}`}>
      <p className="font-semibold">
        {title} <span className="font-normal text-zinc-600">({keys.length})</span>
      </p>
      <p className="mt-1 font-mono text-[11px] leading-relaxed">{shown.join(", ")}</p>
      {more > 0 ? <p className="mt-1 text-zinc-600">+{more} more</p> : null}
    </div>
  );
}

export function TwinScenarioDraftKeyDiffSummary(props: { diff: DraftTopLevelKeyDiffV1; deepLine: string }) {
  const { diff, deepLine } = props;

  if (diff.kind === "non_object") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-700">{diff.narrative}</p>
        <p className="text-sm text-zinc-600">{deepLine}</p>
      </div>
    );
  }

  const { onlyInLeft, onlyInRight, sameKeys, changedKeys, nestedPathDiffs, nestedPathDiffsOverflow } = diff;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Top-level keys</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <KeyList title="Only on left draft" keys={onlyInLeft} tone="rose" />
        <KeyList title="Only on right draft" keys={onlyInRight} tone="emerald" />
        <KeyList title="Same key + value" keys={sameKeys} tone="zinc" />
        <KeyList title="Same key, different value" keys={changedKeys} tone="amber" />
      </div>
      <NestedPathDiffStrip entries={nestedPathDiffs} overflow={nestedPathDiffsOverflow} />
      <p className="text-sm text-zinc-600">{deepLine}</p>
    </div>
  );
}

function nestedPathBadgeClass(kind: DraftNestedPathEntryV1["kind"]): string {
  if (kind === "only_left") {
    return "bg-rose-100 text-rose-900";
  }
  if (kind === "only_right") {
    return "bg-emerald-100 text-emerald-900";
  }
  return "bg-amber-100 text-amber-900";
}

function NestedPathDiffStrip(props: { entries: DraftNestedPathEntryV1[]; overflow: number }) {
  const { entries, overflow } = props;
  if (entries.length === 0 && overflow === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600">
        <p className="font-semibold text-zinc-800">Nested paths (depth ≤ 2)</p>
        <p className="mt-1">No object-valued changed keys with inner key differences, or inner values match.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Nested paths (depth ≤ 2)</p>
      <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-zinc-800">
        {entries.map((e) => (
          <li key={e.path} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-zinc-900">{e.path}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${nestedPathBadgeClass(e.kind)}`}
            >
              {e.kind === "only_left"
                ? "left only"
                : e.kind === "only_right"
                  ? "right only"
                  : "diff"}
            </span>
          </li>
        ))}
      </ul>
      {overflow > 0 ? (
        <p className="mt-2 text-xs text-zinc-600">
          +{overflow} more nested path{overflow === 1 ? "" : "s"} not shown (cap).
        </p>
      ) : null}
    </div>
  );
}
