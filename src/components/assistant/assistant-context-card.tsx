import Link from "next/link";

export function AssistantContextCard({
  title,
  description,
  prompt,
}: {
  title: string;
  description: string;
  prompt: string;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">Ask assistant</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">{description}</p>
        </div>
        <Link
          href={`/assistant?prompt=${encodeURIComponent(prompt)}`}
          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Open assistant
        </Link>
      </div>
    </section>
  );
}
