import Link from "next/link";

import { workspaceTabHref } from "@/app/apihub/workspace-tabs";

export function ApihubHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 py-3 pl-2 pr-6 sm:flex-row sm:items-center sm:justify-between sm:pl-3 md:pl-6">
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
          <Link href={workspaceTabHref("demo-sync")} className="font-medium text-zinc-600 hover:text-zinc-900">
            Demo sync
          </Link>
          <Link href={workspaceTabHref("ingestion-ops")} className="font-medium text-zinc-600 hover:text-zinc-900">
            Ingestion runs
          </Link>
          <Link href={workspaceTabHref("ingestion-alerts")} className="font-medium text-zinc-600 hover:text-zinc-900">
            Alerts
          </Link>
          <Link href={workspaceTabHref("apply-conflicts")} className="font-medium text-zinc-600 hover:text-zinc-900">
            Apply conflicts
          </Link>
          <Link href={workspaceTabHref("mapping-templates")} className="font-medium text-zinc-600 hover:text-zinc-900">
            Mapping templates
          </Link>
          <Link
            href={workspaceTabHref("mapping-preview-export")}
            className="font-medium text-zinc-600 hover:text-zinc-900"
          >
            Preview export
          </Link>
          <Link href={workspaceTabHref("connectors")} className="font-medium text-zinc-600 hover:text-zinc-900">
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
