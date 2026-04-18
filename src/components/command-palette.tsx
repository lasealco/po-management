"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type CommandPaletteGrants = {
  orders: boolean;
  reports: boolean;
  consolidation: boolean;
  controlTower: boolean;
  wms: boolean;
  crm: boolean;
  suppliers: boolean;
  srm: boolean;
  products: boolean;
  settings: boolean;
  tariffs: boolean;
  rfq: boolean;
  pricingSnapshots: boolean;
  invoiceAudit: boolean;
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

    if (grants.reports || grants.controlTower || grants.crm || grants.wms) {
      list.push({
        id: "executive-dashboard",
        label: "Executive dashboard",
        hint: "CEO command center",
        searchText: "executive ceo dashboard investors risk growth capital",
        action: go("/executive"),
      });
      list.push({
        id: "reporting-hub",
        label: "Reporting hub",
        hint: "PO, Control Tower, CRM, WMS — on page: R refresh, Shift+R silent",
        searchText: "reporting analytics hub all modules refresh keyboard shift cockpit",
        action: go("/reporting"),
      });
    }

    if (grants.reports) {
      list.push(
        {
          id: "reports-po",
          label: "PO Management — reports",
          searchText: "analytics export csv summary purchase orders",
          action: go("/reports"),
        },
        {
          id: "reports-po-overdue",
          label: "PO reports — overdue by requested delivery",
          searchText: "overdue delivery late requested date report",
          action: go("/reports?report=overdue_orders"),
        },
      );
    }

    if (grants.orders) {
      list.push(
        {
          id: "orders-all",
          label: "Orders — All",
          searchText: "orders home po board all",
          action: go("/orders"),
        },
        {
          id: "orders-nma",
          label: "Orders — Needs my action",
          searchText: "queue nma action",
          action: go("/orders?queue=needs_my_action"),
        },
        {
          id: "orders-wait",
          label: "Orders — Waiting on me",
          searchText: "waiting reply comms",
          action: go("/orders?queue=waiting_on_me"),
        },
        {
          id: "orders-supp",
          label: "Orders — Awaiting supplier",
          searchText: "supplier sent",
          action: go("/orders?queue=awaiting_supplier"),
        },
        {
          id: "orders-split",
          label: "Orders — Split pending (buyer)",
          searchText: "split",
          action: go("/orders?queue=split_pending_buyer"),
        },
        {
          id: "orders-overdue",
          label: "Orders — Overdue",
          searchText: "due late",
          action: go("/orders?queue=overdue"),
        },
        {
          id: "product-trace",
          label: "Product trace",
          hint: "SKU → PO, shipments, warehouse stock",
          searchText: "product trace sku where inventory shipment customer",
          action: go("/product-trace"),
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

    if (grants.controlTower) {
      list.push(
        {
          id: "control-tower",
          label: "Control Tower — dashboard",
          searchText: "control tower logistics visibility shipments",
          action: go("/control-tower"),
        },
        {
          id: "control-tower-workbench",
          label: "Control Tower — workbench",
          searchText: "control tower tracking workbench grid filters",
          action: go("/control-tower/workbench"),
        },
        {
          id: "control-tower-search",
          label: "Control Tower — search & assist",
          searchText: "control tower search assist",
          action: go("/control-tower/search"),
        },
        {
          id: "control-tower-reports",
          label: "Control Tower — reports",
          searchText: "control tower kpi reporting",
          action: go("/control-tower/reports"),
        },
      );
    }

    if (grants.tariffs) {
      list.push(
        {
          id: "tariffs-contracts",
          label: "Tariffs — contracts",
          hint: "Ocean contracts, versions, and lines",
          searchText: "tariff contract rate ocean freight baf surcharges",
          action: go("/tariffs/contracts"),
        },
        {
          id: "tariffs-geography",
          label: "Tariffs — geography groups",
          hint: "Ports, regions, carrier label mapping",
          searchText: "tariff geography locode region port subregion alias",
          action: go("/tariffs/geography"),
        },
        {
          id: "tariffs-import",
          label: "Tariffs — import center",
          hint: "Excel/PDF batches and staging",
          searchText: "tariff import upload excel pdf staging parse",
          action: go("/tariffs/import"),
        },
      );
    }

    if (grants.pricingSnapshots) {
      list.push(
        {
          id: "pricing-snapshots",
          label: "Pricing snapshots",
          hint: "Frozen contract or RFQ economics for a booking",
          searchText: "pricing snapshot freeze booking tariff rfq estimate",
          action: go("/pricing-snapshots"),
        },
        {
          id: "pricing-snapshots-new",
          label: "Pricing snapshots — freeze new",
          searchText: "new pricing snapshot freeze contract version quote response",
          action: go("/pricing-snapshots/new"),
        },
      );
    }

    if (grants.invoiceAudit) {
      list.push(
        {
          id: "invoice-audit",
          label: "Invoice audit — intakes",
          hint: "Match invoices to pricing snapshots",
          searchText: "invoice audit freight discrepancy tolerance",
          action: go("/invoice-audit"),
        },
        {
          id: "invoice-audit-new",
          label: "Invoice audit — new intake",
          searchText: "new invoice intake parse lines",
          action: go("/invoice-audit/new"),
        },
      );
    }

    if (grants.rfq) {
      list.push(
        {
          id: "rfq-requests",
          label: "RFQ — requests",
          hint: "Ocean ad hoc quotes and comparison",
          searchText: "rfq request for quote procurement ocean freight bid",
          action: go("/rfq/requests"),
        },
        {
          id: "rfq-new",
          label: "RFQ — new request",
          searchText: "new rfq quote request",
          action: go("/rfq/requests/new"),
        },
      );
    }

    if (grants.wms) {
      list.push(
        {
          id: "wms",
          label: "WMS — overview",
          searchText: "warehouse wms home dashboard at a glance",
          action: go("/wms"),
        },
        {
          id: "wms-setup",
          label: "WMS — setup (zones, bins, replenishment)",
          searchText: "wms zones bins replenishment rules",
          action: go("/wms/setup"),
        },
        {
          id: "wms-operations",
          label: "WMS — operations (tasks, outbound, waves)",
          searchText: "wms putaway pick outbound wave tasks inbound asn pack ship",
          action: go("/wms/operations"),
        },
        {
          id: "wms-stock",
          label: "WMS — stock & ledger",
          searchText: "wms inventory balances movements ledger",
          action: go("/wms/stock"),
        },
        {
          id: "wms-billing",
          label: "WMS — billing",
          searchText: "wms billing rates invoice events",
          action: go("/wms/billing"),
        },
      );
    }

    if (grants.crm) {
      list.push(
        {
          id: "crm",
          label: "CRM — overview",
          searchText: "crm sales home dashboard",
          action: go("/crm"),
        },
        {
          id: "crm-leads",
          label: "CRM — leads",
          searchText: "crm leads prospects",
          action: go("/crm/leads"),
        },
        {
          id: "crm-accounts",
          label: "CRM — accounts",
          searchText: "crm accounts customers companies",
          action: go("/crm/accounts"),
        },
        {
          id: "crm-contacts",
          label: "CRM — contacts",
          searchText: "crm contacts people",
          action: go("/crm/contacts"),
        },
        {
          id: "crm-opportunities",
          label: "CRM — opportunities (table)",
          searchText: "crm opportunities deals pipeline list",
          action: go("/crm/opportunities"),
        },
        {
          id: "crm-pipeline",
          label: "CRM — pipeline",
          searchText: "crm pipeline opportunities board stages",
          action: go("/crm/pipeline"),
        },
        {
          id: "crm-quotes",
          label: "CRM — quotes",
          searchText: "crm quotes proposals pricing",
          action: go("/crm/quotes"),
        },
        {
          id: "crm-activities",
          label: "CRM — activities",
          searchText: "crm activities tasks calls meetings",
          action: go("/crm/activities"),
        },
      );
    }

    if (grants.srm) {
      list.push({
        id: "srm",
        label: "SRM — supplier management",
        hint: "Procurement hub (in development)",
        searchText: "srm procurement supplier relationship vendor approve partner",
        action: go("/srm"),
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
    startTransition(() => {
      setActiveIdx(0);
    });
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
