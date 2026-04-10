"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type CommandPaletteGrants = {
  orders: boolean;
  reports: boolean;
  consolidation: boolean;
  wms: boolean;
  suppliers: boolean;
  products: boolean;
  settings: boolean;
};

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  searchText: string;
  action: () => void;
};

function openHelp() {
  window.dispatchEvent(new CustomEvent("po-help:open"));
}

export function CommandPalette({ grants }: { grants: CommandPaletteGrants }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo((): CommandItem[] => {
    const go = (href: string) => () => {
      setOpen(false);
      setQuery("");
      router.push(href);
    };
    const list: CommandItem[] = [];

    list.push({
      id: "help",
      label: "Open Help assistant",
      hint: "Guided tours & chat",
      searchText: "help guide support",
      action: () => {
        setOpen(false);
        setQuery("");
        openHelp();
      },
    });

    if (grants.reports) {
      list.push({
        id: "reports",
        label: "Reports",
        searchText: "analytics export csv summary",
        action: go("/reports"),
      });
    }

    if (grants.orders) {
      list.push(
        {
          id: "orders-all",
          label: "Orders — All",
          searchText: "orders home po board all",
          action: go("/"),
        },
        {
          id: "orders-nma",
          label: "Orders — Needs my action",
          searchText: "queue nma action",
          action: go("/?queue=needs_my_action"),
        },
        {
          id: "orders-wait",
          label: "Orders — Waiting on me",
          searchText: "waiting reply comms",
          action: go("/?queue=waiting_on_me"),
        },
        {
          id: "orders-supp",
          label: "Orders — Awaiting supplier",
          searchText: "supplier sent",
          action: go("/?queue=awaiting_supplier"),
        },
        {
          id: "orders-split",
          label: "Orders — Split pending (buyer)",
          searchText: "split",
          action: go("/?queue=split_pending_buyer"),
        },
        {
          id: "orders-overdue",
          label: "Orders — Overdue",
          searchText: "due late",
          action: go("/?queue=overdue"),
        },
      );
    }

    if (grants.consolidation) {
      list.push({
        id: "consolidation",
        label: "Consolidation planner",
        searchText: "load cfs container",
        action: go("/consolidation"),
      });
    }

    if (grants.wms) {
      list.push({
        id: "wms",
        label: "Warehouse operations (WMS)",
        searchText: "warehouse wms stock bins putaway pick",
        action: go("/wms"),
      });
    }

    if (grants.suppliers) {
      list.push({
        id: "suppliers",
        label: "Suppliers",
        searchText: "vendor directory",
        action: go("/suppliers"),
      });
    }

    if (grants.products) {
      list.push({
        id: "products",
        label: "Products",
        searchText: "catalog sku",
        action: go("/products"),
      });
    }

    if (grants.settings) {
      list.push(
        {
          id: "settings-catalog",
          label: "Settings — Catalog",
          searchText: "categories divisions products master",
          action: go("/settings/catalog"),
        },
        {
          id: "settings-users",
          label: "Settings — Users",
          searchText: "roles password admin",
          action: go("/settings/users"),
        },
        {
          id: "settings-wh",
          label: "Settings — CFS & Warehouses",
          searchText: "warehouse cfs",
          action: go("/settings/warehouses"),
        },
        {
          id: "settings-home",
          label: "Settings — Overview",
          searchText: "configuration",
          action: go("/settings"),
        },
      );
    }

    list.push({
      id: "login",
      label: "Login page",
      hint: "Real password sign-in",
      searchText: "logout sign auth",
      action: go("/login"),
    });

    return list;
  }, [grants, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const blob = `${c.label} ${c.searchText} ${c.hint ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [commands, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
    setQuery("");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function runActive() {
    const cmd = filtered[activeIdx];
    if (cmd) cmd.action();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => {
        setOpen(false);
        setQuery("");
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-3 py-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                runActive();
              }
            }}
            placeholder="Jump to page or action…"
            className="w-full border-0 bg-transparent px-2 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          <p className="px-2 pb-1 text-[10px] text-zinc-400">
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1">↑</kbd>{" "}
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1">↓</kbd>{" "}
            navigate · <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1">↵</kbd>{" "}
            run · Esc close
          </p>
        </div>
        <ul className="max-h-[min(50vh,320px)] overflow-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">No matches</li>
          ) : (
            filtered.map((cmd, idx) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  onClick={() => {
                    cmd.action();
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm ${
                    idx === activeIdx ? "bg-violet-50 text-violet-950" : "text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  <span className="font-medium">{cmd.label}</span>
                  {cmd.hint ? (
                    <span className="text-xs text-zinc-500">{cmd.hint}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
