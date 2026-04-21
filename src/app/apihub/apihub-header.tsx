import Link from "next/link";

export function ApihubHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Module</p>
          <h1 className="text-base font-semibold text-zinc-900">API hub</h1>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <Link href="/apihub#demo-sync" className="font-medium text-zinc-600 hover:text-zinc-900">
            Demo sync
          </Link>
          <Link href="/apihub#ingestion-ops" className="font-medium text-zinc-600 hover:text-zinc-900">
            Ingestion runs
          </Link>
          <Link href="/apihub#mapping-templates" className="font-medium text-zinc-600 hover:text-zinc-900">
            Mapping templates
          </Link>
          <Link href="/apihub#connectors" className="font-medium text-zinc-600 hover:text-zinc-900">
            Connectors
          </Link>
          <Link href="/settings/demo" className="font-medium text-zinc-600 hover:text-zinc-900">
            Demo session
          </Link>
        </nav>
      </div>
    </header>
  );
}
