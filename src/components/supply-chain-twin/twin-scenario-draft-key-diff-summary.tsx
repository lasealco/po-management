import type { DraftTopLevelKeyDiffV1 } from "./scenario-draft-compare-summary";

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

  const { onlyInLeft, onlyInRight, sameKeys, changedKeys } = diff;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Top-level keys</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <KeyList title="Only on left draft" keys={onlyInLeft} tone="rose" />
        <KeyList title="Only on right draft" keys={onlyInRight} tone="emerald" />
        <KeyList title="Same key + value" keys={sameKeys} tone="zinc" />
        <KeyList title="Same key, different value" keys={changedKeys} tone="amber" />
      </div>
      <p className="text-sm text-zinc-600">{deepLine}</p>
    </div>
  );
}
