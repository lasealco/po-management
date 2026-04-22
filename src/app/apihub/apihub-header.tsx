import Link from "next/link";

export function ApihubHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Module</p>
          <h1 className="text-base font-semibold text-zinc-900">API hub</h1>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
          <Link href="/apihub" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Guided import
          </Link>
          <Link href="/apihub/workspace" className="font-medium text-zinc-800 hover:text-zinc-900">
            Workspace
          </Link>
          <span className="hidden text-zinc-300 sm:inline" aria-hidden>
            |
          </span>
          <Link href="/apihub/workspace#demo-sync" className="font-medium text-zinc-600 hover:text-zinc-900">
            Demo sync
          </Link>
          <Link href="/apihub/workspace#ingestion-ops" className="font-medium text-zinc-600 hover:text-zinc-900">
            Ingestion runs
          </Link>
          <Link href="/apihub/workspace#ingestion-alerts" className="font-medium text-zinc-600 hover:text-zinc-900">
            Alerts
          </Link>
          <Link href="/apihub/workspace#apply-conflicts" className="font-medium text-zinc-600 hover:text-zinc-900">
            Apply conflicts
          </Link>
          <Link href="/apihub/workspace#mapping-templates" className="font-medium text-zinc-600 hover:text-zinc-900">
            Mapping templates
          </Link>
          <Link href="/apihub/workspace#mapping-preview-export" className="font-medium text-zinc-600 hover:text-zinc-900">
            Preview export
          </Link>
          <Link href="/apihub/workspace#connectors" className="font-medium text-zinc-600 hover:text-zinc-900">
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
