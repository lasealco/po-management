export function AssistantSnapshotLoadError({
  eyebrow,
  title,
  message,
  hint,
}: {
  eyebrow: string;
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-semibold text-amber-950">{title}</h2>
      <p className="mt-2 text-sm text-amber-950/90">{message}</p>
      {hint ? <p className="mt-3 text-sm text-amber-900/85">{hint}</p> : null}
    </section>
  );
}
