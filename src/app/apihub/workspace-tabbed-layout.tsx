"use client";

import Link from "next/link";
import { Children, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  WORKSPACE_TAB_META,
  isWorkspaceTabId,
  normalizeWorkspaceTab,
  type WorkspaceTabId,
} from "@/app/apihub/workspace-tabs";

type Props = {
  initialTabId: WorkspaceTabId;
  children: ReactNode;
};

export function WorkspaceTabbedLayout({ initialTabId, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState<WorkspaceTabId>(initialTabId);

  const childArr = useMemo(() => Children.toArray(children), [children]);

  useEffect(() => {
    const t = searchParams.get("tab");
    setActive(normalizeWorkspaceTab(t ?? undefined));
  }, [searchParams]);

  /** Legacy hash links (#ingestion-ops) → ?tab= (one-time migrate) */
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw || !isWorkspaceTabId(raw)) return;
    const n = raw;
    const params = new URLSearchParams(window.location.search);
    if (n === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", n);
    }
    const q = params.toString();
    const path = window.location.pathname;
    const next = q ? `${path}?${q}` : path;
    window.history.replaceState(null, "", next);
    window.location.hash = "";
    setActive(n);
  }, []);

  const selectTab = useCallback(
    (id: WorkspaceTabId) => {
      setActive(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", id);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Manual operator workspace</p>
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Workspace sections"
        >
          {WORKSPACE_TAB_META.map((t, i) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                id={`workspace-tab-${t.id}`}
                onClick={() => selectTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)]/10 text-zinc-900"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                    isActive ? "bg-[var(--arscmp-primary)]" : "bg-zinc-400"
                  }`}
                >
                  {i + 1}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Default hub entry:{" "}
          <Link href="/apihub" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Guided import
          </Link>
          . Tabs stay pinned while you work.
        </p>
      </div>

      <div className="p-6">
        {WORKSPACE_TAB_META.map((t, i) => (
          <div
            key={t.id}
            role="tabpanel"
            aria-labelledby={`workspace-tab-${t.id}`}
            hidden={active !== t.id}
            className={active === t.id ? "block [&_section]:mt-0" : "hidden"}
          >
            {childArr[i] ?? null}
          </div>
        ))}
      </div>
    </div>
  );
}
