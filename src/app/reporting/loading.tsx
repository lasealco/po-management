function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl border border-zinc-200 bg-white/80 ${className}`} />;
}

export default function ReportingLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-zinc-50 px-6 py-10">
      <header className="mb-6">
        <div className="h-8 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-3 h-4 w-full max-w-3xl animate-pulse rounded bg-zinc-200" />
      </header>

      <section className="mb-8 rounded-2xl border border-zinc-200 bg-white/70 p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
          <div className="h-3 w-36 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard className="h-52 md:col-span-2" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-44 md:col-span-2" />
        </div>
      </section>

      <div className="mb-6 flex gap-2">
        <div className="h-8 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="h-8 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="h-8 w-28 animate-pulse rounded bg-zinc-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard className="h-36" />
        <SkeletonCard className="h-36" />
        <SkeletonCard className="h-36" />
        <SkeletonCard className="h-36" />
      </div>
    </main>
  );
}
