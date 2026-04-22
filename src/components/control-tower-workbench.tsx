"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { Suspense, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  controlTowerListPrimaryTitle,
  controlTowerListSecondaryRef,
} from "@/lib/control-tower/shipment-list-label";
import { parseControlTowerProductTraceParam } from "@/lib/control-tower/search-query";
import {
  buildWorkbenchSearchString,
  readWorkbenchUrlState,
  type WorkbenchUrlState,
} from "@/lib/control-tower/workbench-url-sync";
import {
  WORKBENCH_COLUMN_LABELS,
  WORKBENCH_COLUMN_STORAGE_KEY,
  WORKBENCH_TOGGABLE_COLUMNS,
  defaultWorkbenchColumnVisibility,
  parseWorkbenchColumnVisibility,
  workbenchVisibleColumnCount,
  type WorkbenchTogglableColumn,
} from "@/lib/control-tower/workbench-column-prefs";
import { buildWorkbenchCsv } from "@/components/control-tower-workbench/csv";
import { classifyShipmentHealth, healthBadgeClass, healthLabel } from "@/components/control-tower-workbench/health";
import {
  createRouteActionCounts,
  ROUTE_ACTION_OPTIONS,
} from "@/components/control-tower-workbench/route-actions";
import type { ShipmentHealthState as HealthState, WorkbenchRow as Row } from "@/components/control-tower-workbench/types";
import type { RouteActionName } from "@/components/control-tower-workbench/route-actions";

function ActionTooltipButton({
  disabled,
  onClick,
  className,
  tooltip,
  children,
}: {
  disabled?: boolean;
  onClick: () => void | Promise<void>;
  className: string;
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative inline-flex">
      <button type="button" disabled={disabled} onClick={() => void onClick()} className={className}>
        {children}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-md group-hover:block">
        {tooltip}
      </div>
    </div>
  );
}

function WbTh({
  show,
  className,
  title,
  children,
}: {
  show: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  if (!show) return null;
  return (
    <th className={className ?? "px-2 py-2"} title={title}>
      {children}
    </th>
  );
}

function WbTd({ show, className, children }: { show: boolean; className?: string; children: ReactNode }) {
  if (!show) return null;
  return <td className={className}>{children}</td>;
}

function CtWorkbenchDemoTools({
  restrictedView,
  enrichBusy,
  setEnrichBusy,
  timelineBusy,
  setTimelineBusy,
  load,
}: {
  restrictedView: boolean;
  enrichBusy: boolean;
  setEnrichBusy: (v: boolean) => void;
  timelineBusy: boolean;
  setTimelineBusy: (v: boolean) => void;
  load: () => void | Promise<void>;
}) {
  if (restrictedView) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900">Demo tracking</p>
          <p className="mt-0.5 text-xs text-zinc-600">
            Fill missing route legs and milestones, or rebuild heavier demo timelines. Shown only on the internal
            workbench (hidden in supplier/customer portal views).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ActionTooltipButton
            disabled={enrichBusy}
            tooltip="Adds missing route legs and tracking milestones for recent shipments without changing existing fully-populated timelines."
            onClick={async () => {
              try {
                setEnrichBusy(true);
                const res = await fetch("/api/control-tower", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "enrich_ct_demo_tracking", take: 180 }),
                });
                const parsed: unknown = await res.json();
                if (!res.ok) throw new Error(apiClientErrorMessage(parsed, "Could not enrich shipments."));
                const payload = parsed as {
                  shipmentsUpdated?: number;
                  legsCreated?: number;
                  milestonesCreated?: number;
                };
                window.alert(
                  `Demo enrichment complete.\nShipments updated: ${payload.shipmentsUpdated ?? 0}\nLegs created: ${payload.legsCreated ?? 0}\nTracking milestones created: ${payload.milestonesCreated ?? 0}`,
                );
                await load();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Could not enrich shipments.");
              } finally {
                setEnrichBusy(false);
              }
            }}
            className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enrichBusy ? "Generating demo tracking..." : "Generate demo tracking"}
          </ActionTooltipButton>
          <ActionTooltipButton
            disabled={timelineBusy}
            tooltip="Rebuilds route legs and milestone timelines for a larger shipment set, creating a visible mix of on-time, at-risk, and delayed profiles for demos."
            onClick={async () => {
              try {
                setTimelineBusy(true);
                const res = await fetch("/api/control-tower", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "regenerate_ct_demo_timeline", take: 260 }),
                });
                const parsed: unknown = await res.json();
                if (!res.ok) throw new Error(apiClientErrorMessage(parsed, "Could not regenerate timeline."));
                const payload = parsed as {
                  updated?: number;
                  onTime?: number;
                  atRisk?: number;
                  delayed?: number;
                };
                window.alert(
                  `Timeline regenerated.\nShipments updated: ${payload.updated ?? 0}\nOn-time profile: ${payload.onTime ?? 0}\nAt-risk profile: ${payload.atRisk ?? 0}\nDelayed profile: ${payload.delayed ?? 0}`,
                );
                await load();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Could not regenerate timeline.");
              } finally {
                setTimelineBusy(false);
              }
            }}
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {timelineBusy ? "Regenerating timeline..." : "Regenerate timeline (heavier)"}
          </ActionTooltipButton>
        </div>
      </div>
    </div>
  );
}

function workbenchUrlHasSearchFilters(sp: URLSearchParams): boolean {
  return Boolean(
    (sp.get("q") ?? "").trim() ||
      parseControlTowerProductTraceParam(sp.get("productTrace")) ||
      (sp.get("status") ?? "").trim() ||
      (sp.get("mode") ?? "").trim() ||
      (sp.get("lane") ?? "").trim() ||
      (sp.get("carrierSupplierId") ?? "").trim() ||
      (sp.get("supplierId") ?? "").trim() ||
      (sp.get("customerCrmAccountId") ?? "").trim() ||
      (sp.get("originCode") ?? "").trim() ||
      (sp.get("destinationCode") ?? "").trim() ||
      (sp.get("exceptionCode") ?? "").trim() ||
      (sp.get("alertType") ?? "").trim() ||
      (sp.get("shipmentSource") ?? "").trim() ||
      (sp.get("onlyOverdueEta") ?? "").trim() ||
      (sp.get("routeAction") ?? "").trim() ||
      (sp.get("dispatchOwnerUserId") ?? "").trim() ||
      (sp.get("minRouteProgressPct") ?? "").trim() ||
      (sp.get("maxRouteProgressPct") ?? "").trim() ||
      (sp.get("autoRefresh") ?? "").trim() ||
      (sp.get("ship360Tab") ?? "").trim(),
  );
}

function shipment360Href(shipmentId: string, ship360Tab: "" | "milestones") {
  const base = `/control-tower/shipments/${shipmentId}`;
  if (ship360Tab === "milestones") return `${base}?tab=milestones`;
  return base;
}

function ControlTowerWorkbenchInner({
  canEdit,
  restrictedView = false,
  supplierChoices = [],
  crmAccountChoices = [],
}: {
  canEdit: boolean;
  /** Supplier portal or CRM-scoped customer — hide internal dispatch triage. */
  restrictedView?: boolean;
  supplierChoices?: Array<{ id: string; name: string }>;
  crmAccountChoices?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultViewKey = "ct-workbench-default-view-id";
  const workbenchRequestId = useRef(0);
  const pendingDesiredQueryRef = useRef<string | null>(null);
  const skipExternalHydrateOnceRef = useRef(true);
  const urlInitRef = useRef(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [routeAction, setRouteAction] = useState("");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [onlyOverdueEta, setOnlyOverdueEta] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [productTraceFilter, setProductTraceFilter] = useState("");
  const [laneFilter, setLaneFilter] = useState("");
  const [carrierSupplierIdFilter, setCarrierSupplierIdFilter] = useState("");
  const [supplierIdFilter, setSupplierIdFilter] = useState("");
  const [customerCrmAccountIdFilter, setCustomerCrmAccountIdFilter] = useState("");
  const [originCodeFilter, setOriginCodeFilter] = useState("");
  const [destinationCodeFilter, setDestinationCodeFilter] = useState("");
  const [exceptionCodeFilter, setExceptionCodeFilter] = useState("");
  const [alertTypeFilter, setAlertTypeFilter] = useState("");
  const [shipmentSource, setShipmentSource] = useState<"" | "PO" | "UNLINKED">("");
  /** False until client layout reads `?q=` / filters from the URL (avoids a stale first fetch). */
  const [filtersReady, setFiltersReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [listTruncated, setListTruncated] = useState(false);
  const [listLimit, setListLimit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState<Array<{ id: string; name: string; filtersJson: unknown }>>([]);
  const [savedFiltersErr, setSavedFiltersErr] = useState<string | null>(null);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [timelineBusy, setTimelineBusy] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [routeHealth, setRouteHealth] = useState("");
  const [ship360Tab, setShip360Tab] = useState<"" | "milestones">("");
  /** Client-only slice on the loaded rows; not stored in the URL. */
  const [healthQuickFilter, setHealthQuickFilter] = useState<HealthState | null>(null);
  const [colVis, setColVis] = useState<Record<WorkbenchTogglableColumn, boolean>>(defaultWorkbenchColumnVisibility);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);

  useLayoutEffect(() => {
    const patch = parseWorkbenchColumnVisibility(window.localStorage.getItem(WORKBENCH_COLUMN_STORAGE_KEY));
    if (Object.keys(patch).length > 0) {
      setColVis({ ...defaultWorkbenchColumnVisibility(), ...patch });
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WORKBENCH_COLUMN_STORAGE_KEY, JSON.stringify(colVis));
  }, [colVis]);

  const showCol = useCallback(
    (k: WorkbenchTogglableColumn) => {
      if (k === "owner" && restrictedView) return false;
      return colVis[k] !== false;
    },
    [colVis, restrictedView],
  );

  useLayoutEffect(() => {
    if (urlInitRef.current) return;
    urlInitRef.current = true;
    const s = readWorkbenchUrlState(new URLSearchParams(searchParams.toString()), restrictedView);
    setStatus(s.status);
    setMode(s.mode);
    setRouteAction(s.routeAction);
    setSortBy(s.sortBy);
    setPage(s.page);
    setOnlyOverdueEta(s.onlyOverdueEta);
    setQ(s.q);
    setProductTraceFilter(s.productTraceFilter);
    setLaneFilter(s.laneFilter);
    setCarrierSupplierIdFilter(s.carrierSupplierIdFilter);
    setSupplierIdFilter(s.supplierIdFilter);
    setCustomerCrmAccountIdFilter(s.customerCrmAccountIdFilter);
    setOriginCodeFilter(s.originCodeFilter);
    setDestinationCodeFilter(s.destinationCodeFilter);
    setExceptionCodeFilter(s.exceptionCodeFilter);
    setAlertTypeFilter(s.alertTypeFilter);
    setShipmentSource(s.shipmentSource);
    setOwnerFilter(s.ownerFilter);
    setRouteHealth(s.routeHealth);
    setAutoRefresh(s.autoRefresh);
    setShip360Tab(s.ship360Tab);
    setFiltersReady(true);
  }, [searchParams, restrictedView]);

  const workbenchUrlState = useMemo(
    (): WorkbenchUrlState => ({
      status,
      mode,
      routeAction,
      sortBy,
      page,
      onlyOverdueEta,
      q,
      productTraceFilter,
      laneFilter,
      carrierSupplierIdFilter,
      supplierIdFilter,
      customerCrmAccountIdFilter,
      originCodeFilter,
      destinationCodeFilter,
      exceptionCodeFilter,
      alertTypeFilter,
      shipmentSource,
      ownerFilter,
      routeHealth,
      autoRefresh,
      ship360Tab,
    }),
    [
      status,
      mode,
      routeAction,
      sortBy,
      page,
      onlyOverdueEta,
      q,
      productTraceFilter,
      laneFilter,
      carrierSupplierIdFilter,
      supplierIdFilter,
      customerCrmAccountIdFilter,
      originCodeFilter,
      destinationCodeFilter,
      exceptionCodeFilter,
      alertTypeFilter,
      shipmentSource,
      ownerFilter,
      routeHealth,
      autoRefresh,
      ship360Tab,
    ],
  );

  useEffect(() => {
    if (!filtersReady) return;
    const t = window.setTimeout(() => {
      const qs = buildWorkbenchSearchString(workbenchUrlState, restrictedView);
      if (qs === searchParams.toString()) return;
      pendingDesiredQueryRef.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 400);
    return () => window.clearTimeout(t);
  }, [filtersReady, pathname, router, searchParams, restrictedView, workbenchUrlState]);

  useEffect(() => {
    if (!filtersReady) return;
    const cur = searchParams.toString();
    if (pendingDesiredQueryRef.current !== null && pendingDesiredQueryRef.current === cur) {
      pendingDesiredQueryRef.current = null;
      return;
    }
    if (skipExternalHydrateOnceRef.current) {
      skipExternalHydrateOnceRef.current = false;
      return;
    }
    const s = readWorkbenchUrlState(new URLSearchParams(cur), restrictedView);
    setStatus(s.status);
    setMode(s.mode);
    setRouteAction(s.routeAction);
    setSortBy(s.sortBy);
    setPage(s.page);
    setOnlyOverdueEta(s.onlyOverdueEta);
    setQ(s.q);
    setProductTraceFilter(s.productTraceFilter);
    setLaneFilter(s.laneFilter);
    setCarrierSupplierIdFilter(s.carrierSupplierIdFilter);
    setSupplierIdFilter(s.supplierIdFilter);
    setCustomerCrmAccountIdFilter(s.customerCrmAccountIdFilter);
    setOriginCodeFilter(s.originCodeFilter);
    setDestinationCodeFilter(s.destinationCodeFilter);
    setExceptionCodeFilter(s.exceptionCodeFilter);
    setAlertTypeFilter(s.alertTypeFilter);
    setShipmentSource(s.shipmentSource);
    setOwnerFilter(s.ownerFilter);
    setRouteHealth(s.routeHealth);
    setAutoRefresh(s.autoRefresh);
    setShip360Tab(s.ship360Tab);
  }, [searchParams, filtersReady, restrictedView]);

  const load = useCallback(async () => {
    const myId = ++workbenchRequestId.current;
    setBusy(true);
    setError(null);
    setListTruncated(false);
    setListLimit(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (mode) sp.set("mode", mode);
      if (q.trim()) sp.set("q", q.trim());
      const productTrace = parseControlTowerProductTraceParam(productTraceFilter || null);
      if (productTrace) sp.set("productTrace", productTrace);
      if (laneFilter.trim()) sp.set("lane", laneFilter.trim());
      if (carrierSupplierIdFilter.trim()) sp.set("carrierSupplierId", carrierSupplierIdFilter.trim());
      if (supplierIdFilter.trim()) sp.set("supplierId", supplierIdFilter.trim());
      if (customerCrmAccountIdFilter.trim()) sp.set("customerCrmAccountId", customerCrmAccountIdFilter.trim());
      if (originCodeFilter.trim()) sp.set("originCode", originCodeFilter.trim());
      if (destinationCodeFilter.trim()) sp.set("destinationCode", destinationCodeFilter.trim());
      const excTrim = exceptionCodeFilter.trim();
      if (excTrim && excTrim.length <= 80 && /^[\w.-]+$/i.test(excTrim)) sp.set("exceptionCode", excTrim);
      const alertTrim = alertTypeFilter.trim();
      if (alertTrim && alertTrim.length <= 80 && /^[\w.-]+$/i.test(alertTrim)) sp.set("alertType", alertTrim);
      if (shipmentSource) sp.set("shipmentSource", shipmentSource);
      if (!restrictedView && ownerFilter) sp.set("dispatchOwnerUserId", ownerFilter);
      if (routeHealth === "stalled") {
        sp.set("minRouteProgressPct", "0");
        sp.set("maxRouteProgressPct", "40");
      } else if (routeHealth === "mid") {
        sp.set("minRouteProgressPct", "41");
        sp.set("maxRouteProgressPct", "79");
      } else if (routeHealth === "advanced") {
        sp.set("minRouteProgressPct", "80");
        sp.set("maxRouteProgressPct", "100");
      }
      if (onlyOverdueEta) sp.set("onlyOverdueEta", "1");
      if (routeAction) sp.set("routeAction", routeAction);
      sp.set("take", routeAction ? "200" : "150");
      const res = await fetch(`/api/control-tower/shipments?${sp.toString()}`);
      const parsed: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(parsed, res.statusText || "Request failed"));
      if (myId !== workbenchRequestId.current) return;
      const data = parsed as {
        shipments?: Row[];
        truncated?: boolean;
        listLimit?: number;
      };
      setRows(data.shipments ?? []);
      setListTruncated(Boolean(data.truncated));
      setListLimit(typeof data.listLimit === "number" ? data.listLimit : null);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      if (myId === workbenchRequestId.current) {
        setError(e instanceof Error ? e.message : "Load failed");
        setListTruncated(false);
        setListLimit(null);
      }
    } finally {
      if (myId === workbenchRequestId.current) setBusy(false);
    }
  }, [
    status,
    mode,
    q,
    productTraceFilter,
    laneFilter,
    carrierSupplierIdFilter,
    supplierIdFilter,
    customerCrmAccountIdFilter,
    originCodeFilter,
    destinationCodeFilter,
    exceptionCodeFilter,
    alertTypeFilter,
    shipmentSource,
    ownerFilter,
    routeHealth,
    onlyOverdueEta,
    routeAction,
    restrictedView,
  ]);

  useEffect(() => {
    if (!filtersReady) return;
    void load();
  }, [load, filtersReady]);

  useEffect(() => {
    if (!filtersReady || !autoRefresh) return;
    const t = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [autoRefresh, load, filtersReady]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/control-tower/saved-filters");
      if (!res.ok) {
        setSavedFiltersErr("Could not load saved views.");
        return;
      }
      setSavedFiltersErr(null);
      const data = (await res.json()) as {
        filters?: Array<{ id: string; name: string; filtersJson: unknown }>;
      };
      setSaved(data.filters ?? []);
      const defaultId = typeof window !== "undefined" ? window.localStorage.getItem(defaultViewKey) : null;
      if (defaultId) {
        const match = (data.filters ?? []).find((f) => f.id === defaultId);
        const sp =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
        if (match && !workbenchUrlHasSearchFilters(sp)) {
          applySaved(match.filtersJson);
        }
      }
    })();
  }, []);

  const refreshSaved = useCallback(async () => {
    const list = await fetch("/api/control-tower/saved-filters");
    if (!list.ok) {
      setSavedFiltersErr("Could not load saved views.");
      return;
    }
    setSavedFiltersErr(null);
    const data = (await list.json()) as {
      filters?: Array<{ id: string; name: string; filtersJson: unknown }>;
    };
    setSaved(data.filters ?? []);
  }, []);

  const applySaved = (json: unknown) => {
    if (!json || typeof json !== "object") return;
    const o = json as {
      status?: string;
      mode?: string;
      q?: string;
      productTraceFilter?: string;
      laneFilter?: string;
      carrierSupplierIdFilter?: string;
      supplierIdFilter?: string;
      customerCrmAccountIdFilter?: string;
      originCodeFilter?: string;
      destinationCodeFilter?: string;
      exceptionCodeFilter?: string;
      alertTypeFilter?: string;
      shipmentSource?: "" | "PO" | "UNLINKED";
      ownerFilter?: string;
      routeHealth?: string;
      routeAction?: string;
      sortBy?: string;
      onlyOverdueEta?: boolean;
      autoRefresh?: boolean;
      ship360Tab?: "" | "milestones";
      columnVisibility?: Record<string, unknown>;
    };
    setStatus(typeof o.status === "string" ? o.status : "");
    setMode(typeof o.mode === "string" ? o.mode : "");
    setQ(typeof o.q === "string" ? o.q : "");
    setProductTraceFilter(
      parseControlTowerProductTraceParam(
        typeof o.productTraceFilter === "string" ? o.productTraceFilter : null,
      ) ?? "",
    );
    setLaneFilter(typeof o.laneFilter === "string" ? o.laneFilter : "");
    setCarrierSupplierIdFilter(typeof o.carrierSupplierIdFilter === "string" ? o.carrierSupplierIdFilter : "");
    setSupplierIdFilter(typeof o.supplierIdFilter === "string" ? o.supplierIdFilter : "");
    setCustomerCrmAccountIdFilter(
      typeof o.customerCrmAccountIdFilter === "string" ? o.customerCrmAccountIdFilter : "",
    );
    setOriginCodeFilter(typeof o.originCodeFilter === "string" ? o.originCodeFilter : "");
    setDestinationCodeFilter(typeof o.destinationCodeFilter === "string" ? o.destinationCodeFilter : "");
    setExceptionCodeFilter(typeof o.exceptionCodeFilter === "string" ? o.exceptionCodeFilter : "");
    setAlertTypeFilter(typeof o.alertTypeFilter === "string" ? o.alertTypeFilter : "");
    setShipmentSource(o.shipmentSource === "PO" || o.shipmentSource === "UNLINKED" ? o.shipmentSource : "");
    setOwnerFilter(typeof o.ownerFilter === "string" ? o.ownerFilter : "");
    setRouteHealth(typeof o.routeHealth === "string" ? o.routeHealth : "");
    setRouteAction(typeof o.routeAction === "string" ? o.routeAction : "");
    setSortBy(typeof o.sortBy === "string" ? o.sortBy : "updated_desc");
    setOnlyOverdueEta(Boolean(o.onlyOverdueEta));
    setAutoRefresh(typeof o.autoRefresh === "boolean" ? o.autoRefresh : true);
    setShip360Tab(o.ship360Tab === "milestones" ? "milestones" : "");
    if (o.columnVisibility && typeof o.columnVisibility === "object") {
      const patch = parseWorkbenchColumnVisibility(JSON.stringify(o.columnVisibility));
      if (Object.keys(patch).length > 0) {
        setColVis({ ...defaultWorkbenchColumnVisibility(), ...patch });
      }
    }
    setPage(1);
    setHealthQuickFilter(null);
  };

  const saveCurrentFilter = async () => {
    const name = typeof window !== "undefined" ? window.prompt("Filter name:") : null;
    if (!name?.trim()) return;
    const res = await fetch("/api/control-tower", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_ct_filter",
        name: name.trim(),
        filtersJson: {
          status,
          mode,
          q,
          productTraceFilter,
          laneFilter,
          carrierSupplierIdFilter,
          supplierIdFilter,
          customerCrmAccountIdFilter,
          originCodeFilter,
          destinationCodeFilter,
          exceptionCodeFilter,
          alertTypeFilter,
          shipmentSource,
          ownerFilter,
          routeHealth,
          routeAction,
          sortBy,
          onlyOverdueEta,
          autoRefresh,
          ship360Tab,
          columnVisibility: colVis,
        },
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      window.alert(err.error || "Save failed");
      return;
    }
    await refreshSaved();
  };

  const statusOptions = useMemo(
    () => [
      "",
      "BOOKING_DRAFT",
      "BOOKING_SUBMITTED",
      "SHIPPED",
      "VALIDATED",
      "BOOKED",
      "IN_TRANSIT",
      "DELIVERED",
      "RECEIVED",
    ],
    [],
  );
  const modeOptions = useMemo(() => ["", "OCEAN", "AIR", "ROAD", "RAIL"], []);
  const routeActionOptions = useMemo(() => [...ROUTE_ACTION_OPTIONS], []);
  const routeActionCounts = useMemo(() => createRouteActionCounts(rows), [rows]);
  const ownerChoices = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.dispatchOwner?.id) m.set(r.dispatchOwner.id, r.dispatchOwner.name);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);
  /** Route bucket + overdue are applied server-side; we only sort client-side. */
  const filteredRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortBy === "eta_asc") {
        const ae = a.latestEta || a.eta;
        const be = b.latestEta || b.eta;
        const av = ae ? new Date(ae).getTime() : Number.MAX_SAFE_INTEGER;
        const bv = be ? new Date(be).getTime() : Number.MAX_SAFE_INTEGER;
        return av - bv;
      }
      if (sortBy === "route_progress_asc") {
        return (a.routeProgressPct ?? 999) - (b.routeProgressPct ?? 999);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return sorted;
  }, [rows, sortBy]);

  const chipFilteredRows = useMemo(() => {
    if (!healthQuickFilter) return filteredRows;
    const now = Date.now();
    return filteredRows.filter((r) => classifyShipmentHealth(r, now) === healthQuickFilter);
  }, [filteredRows, healthQuickFilter]);

  const exportCsv = useCallback(() => {
    const csv = buildWorkbenchCsv({
      rows: chipFilteredRows,
      colVis,
      restrictedView,
      listTruncated,
      listLimit,
      nowMs: Date.now(),
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-tower-shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chipFilteredRows, colVis, restrictedView, listTruncated, listLimit]);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(chipFilteredRows.length / pageSize));
  const pagedRows = useMemo(
    () => chipFilteredRows.slice((page - 1) * pageSize, page * pageSize),
    [chipFilteredRows, page],
  );
  const triageStats = useMemo(
    () => ({
      overdue: filteredRows.filter((r) => {
        const eta = r.latestEta || r.eta;
        return eta ? new Date(eta).getTime() < Date.now() : false;
      }).length,
      needsSendBooking: filteredRows.filter((r) => (r.nextAction || "").startsWith("Send booking")).length,
      awaitingBooking: filteredRows.filter((r) => (r.nextAction || "").startsWith("Await booking")).length,
      bookingSlaOverdue: filteredRows.filter(
        (r) => (r.nextAction || "").startsWith("Escalate booking") || Boolean(r.bookingSlaBreached),
      ).length,
      needsDeparture: filteredRows.filter((r) => (r.nextAction || "").startsWith("Mark departure")).length,
      needsArrival: filteredRows.filter((r) => (r.nextAction || "").startsWith("Record arrival")).length,
    }),
    [filteredRows],
  );
  const healthStats = useMemo(() => {
    const now = Date.now();
    const stats = { good: 0, at_risk: 0, delayed: 0, missing_data: 0 };
    for (const r of filteredRows) {
      const health = classifyShipmentHealth(r, now);
      stats[health] += 1;
    }
    return stats;
  }, [filteredRows]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const canUseBulkAlertAck = canEdit && !restrictedView;
  useEffect(() => {
    setSelectedShipmentIds((prev) => {
      if (prev.length === 0) return prev;
      const visibleRowIds = new Set(rows.map((r) => r.id));
      const next = prev.filter((id) => visibleRowIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [rows]);
  const selectedShipmentSet = useMemo(() => new Set(selectedShipmentIds), [selectedShipmentIds]);
  const selectedEligibleShipmentIds = useMemo(
    () => rows.filter((r) => selectedShipmentSet.has(r.id) && (r.openQueueCounts?.openAlerts ?? 0) > 0).map((r) => r.id),
    [rows, selectedShipmentSet],
  );
  const pagedRowIds = useMemo(() => pagedRows.map((r) => r.id), [pagedRows]);
  const allRowsOnPageSelected =
    pagedRowIds.length > 0 && pagedRowIds.every((shipmentId) => selectedShipmentSet.has(shipmentId));

  const tableColSpan = useMemo(
    () => workbenchVisibleColumnCount(colVis, Boolean(restrictedView)) + (canUseBulkAlertAck ? 1 : 0),
    [canUseBulkAlertAck, colVis, restrictedView],
  );

  const setExternalOrderRef = useCallback(
    async (row: Row) => {
      const current = row.externalOrderRef || "";
      const next = window.prompt("External sales / ERP reference", current);
      if (next === null) return;
      const value = next.trim();
      if (!value) {
        window.alert("Reference cannot be empty.");
        return;
      }
      const res = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_order_external_reference",
          shipmentId: row.id,
          externalOrderRef: value,
        }),
      });
      const parsed: unknown = await res.json();
      if (!res.ok) {
        window.alert(apiClientErrorMessage(parsed, "Could not save reference"));
        return;
      }
      await load();
    },
    [load],
  );

  return (
    <div className="space-y-4">
      {restrictedView ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Portal view: dispatch-owner triage and internal queue columns are hidden. Data is limited to shipments linked
          to your account or supplier scope.
        </p>
      ) : null}
      <CtWorkbenchDemoTools
        restrictedView={restrictedView}
        enrichBusy={enrichBusy}
        setEnrichBusy={setEnrichBusy}
        timelineBusy={timelineBusy}
        setTimelineBusy={setTimelineBusy}
        load={load}
      />
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <p className="w-full text-[11px] text-zinc-500">
          Filters update the address bar after you pause typing (~400ms) so you can copy or bookmark the exact list query.
          Auto-refresh off is stored as <span className="font-mono text-zinc-600">autoRefresh=0</span> (default on omits the param).
          Use <span className="font-mono text-zinc-600">ship360Tab=milestones</span> so PO/shipment links open Shipment 360 on the Milestones tab.
        </p>
        <label className="text-xs text-zinc-600">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {statusOptions.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {modeOptions.map((m) => (
              <option key={m || "any"} value={m}>
                {m || "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-zinc-600">
          Search
          <input
            value={q.trim() ? q : productTraceFilter}
            onChange={(e) => {
              setQ(e.target.value);
              if (productTraceFilter) setProductTraceFilter("");
            }}
            placeholder="PO #, SKU, tracking, docs, assignee…"
            className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Lane
          <input
            value={laneFilter}
            onChange={(e) => setLaneFilter(e.target.value)}
            placeholder="e.g. CNSHA or USLAX"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Carrier
          <select
            value={carrierSupplierIdFilter}
            onChange={(e) => setCarrierSupplierIdFilter(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {supplierChoices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Supplier
          <select
            value={supplierIdFilter}
            onChange={(e) => setSupplierIdFilter(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {supplierChoices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Customer
          <select
            value={customerCrmAccountIdFilter}
            onChange={(e) => setCustomerCrmAccountIdFilter(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            {crmAccountChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Shipment source
          <select
            value={shipmentSource}
            onChange={(e) => setShipmentSource(e.target.value as "" | "PO" | "UNLINKED")}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="PO">PO-linked</option>
            <option value="UNLINKED">Unlinked / export</option>
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Origin code
          <input
            value={originCodeFilter}
            onChange={(e) => setOriginCodeFilter(e.target.value)}
            placeholder="e.g. BEANR"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Dest. code
          <input
            value={destinationCodeFilter}
            onChange={(e) => setDestinationCodeFilter(e.target.value)}
            placeholder="e.g. CLVAP"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Open exception code
          <input
            value={exceptionCodeFilter}
            onChange={(e) => setExceptionCodeFilter(e.target.value)}
            placeholder="Catalog type on OPEN / IN_PROGRESS"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Open alert type
          <input
            value={alertTypeFilter}
            onChange={(e) => setAlertTypeFilter(e.target.value)}
            placeholder="e.g. BOOKING_SLA_BREACHED, MANUAL"
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        {!restrictedView ? (
          <label className="text-xs text-zinc-600">
            Dispatch owner
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="">Any</option>
              {ownerChoices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-xs text-zinc-600">
          Route health
          <select
            value={routeHealth}
            onChange={(e) => setRouteHealth(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="stalled">Stalled (0-40%)</option>
            <option value="mid">Mid-route (41-79%)</option>
            <option value="advanced">Advanced (80-100%)</option>
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Route action
          <select
            value={routeAction}
            onChange={(e) => setRouteAction(e.target.value)}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {routeActionOptions.map((opt) => (
              <option key={opt || "all-actions"} value={opt}>
                {opt || "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Sort
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="mt-1 block rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="updated_desc">Updated (newest)</option>
            <option value="eta_asc">ETA (earliest)</option>
            <option value="route_progress_asc">Route progress (lowest)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={onlyOverdueEta}
            onChange={(e) => {
              setOnlyOverdueEta(e.target.checked);
              setPage(1);
            }}
          />
          Overdue ETA only
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={ship360Tab === "milestones"}
            onChange={(e) => {
              setShip360Tab(e.target.checked ? "milestones" : "");
              setPage(1);
            }}
          />
          Shipment links → Milestones tab
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded border border-arscmp-primary bg-arscmp-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setAutoRefresh((v) => !v)}
          className={`rounded border px-3 py-2 text-sm font-medium ${
            autoRefresh
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-zinc-300 text-zinc-700"
          }`}
        >
          Auto-refresh: {autoRefresh ? "On" : "Off"}
        </button>
        <button
          type="button"
          disabled={chipFilteredRows.length === 0}
          onClick={exportCsv}
          className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
        >
          Export CSV
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void saveCurrentFilter()}
            className="rounded border border-sky-600 px-3 py-2 text-sm font-medium text-sky-900"
          >
            Save view
          </button>
        ) : null}
        {saved.length > 0 ? (
          <div className="flex flex-col gap-1 text-xs text-zinc-600">
            <span>Saved views</span>
            <div className="max-h-24 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-1">
              {saved.map((f) => (
                <div key={f.id} className="mb-1 flex items-center gap-1 last:mb-0">
                  <button
                    type="button"
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-left text-xs hover:bg-zinc-100"
                    onClick={() => applySaved(f.filtersJson)}
                    title="Apply saved view"
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2 py-1 text-[11px]"
                    title="Set default"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(defaultViewKey, f.id);
                      }
                    }}
                  >
                    Default
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-800"
                    title="Delete saved view"
                    onClick={async () => {
                      if (!window.confirm(`Delete saved view "${f.name}"?`)) return;
                      const res = await fetch("/api/control-tower", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "delete_ct_filter", filterId: f.id }),
                      });
                      if (!res.ok) {
                        const err: unknown = await res.json();
                        window.alert(apiClientErrorMessage(err, "Delete failed"));
                        return;
                      }
                      if (
                        typeof window !== "undefined" &&
                        window.localStorage.getItem(defaultViewKey) === f.id
                      ) {
                        window.localStorage.removeItem(defaultViewKey);
                      }
                      await refreshSaved();
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="self-start rounded border border-zinc-300 px-2 py-1 text-[11px]"
              onClick={() => {
                if (typeof window !== "undefined") window.localStorage.removeItem(defaultViewKey);
              }}
            >
              Clear default
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setRouteAction("");
            setPage(1);
          }}
          className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
            routeAction === "" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-zinc-300 text-zinc-700"
          }`}
        >
          Any ({rows.length})
        </button>
        {routeActionOptions
          .filter((o): o is RouteActionName => Boolean(o))
          .map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setHealthQuickFilter(null);
                setRouteAction((cur) => (cur === opt ? "" : opt));
                setPage(1);
              }}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                routeAction === opt
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-zinc-300 text-zinc-700"
              }`}
            >
              {opt} ({routeActionCounts[opt] ?? 0})
            </button>
          ))}
      </div>
      <p className="text-xs text-zinc-500">
        Route buckets and colored chips are clickable: they set the same filters as the toolbar (route action, overdue
        ETA, health slice on the table). Counts use the current API result; use Refresh after server filters change.
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter((cur) => (cur === "good" ? null : "good"));
            setPage(1);
          }}
          aria-pressed={healthQuickFilter === "good"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            healthQuickFilter === "good"
              ? "border-emerald-700 bg-emerald-700 text-white ring-2 ring-emerald-900/15"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          }`}
        >
          On-time: <strong>{healthStats.good}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter((cur) => (cur === "at_risk" ? null : "at_risk"));
            setPage(1);
          }}
          aria-pressed={healthQuickFilter === "at_risk"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            healthQuickFilter === "at_risk"
              ? "border-amber-700 bg-amber-700 text-white ring-2 ring-amber-900/15"
              : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
          }`}
        >
          At risk: <strong>{healthStats.at_risk}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter((cur) => (cur === "delayed" ? null : "delayed"));
            setPage(1);
          }}
          aria-pressed={healthQuickFilter === "delayed"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            healthQuickFilter === "delayed"
              ? "border-rose-700 bg-rose-700 text-white ring-2 ring-rose-900/15"
              : "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
          }`}
        >
          Delayed: <strong>{healthStats.delayed}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter((cur) => (cur === "missing_data" ? null : "missing_data"));
            setPage(1);
          }}
          aria-pressed={healthQuickFilter === "missing_data"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            healthQuickFilter === "missing_data"
              ? "border-zinc-600 bg-zinc-600 text-white ring-2 ring-zinc-900/15"
              : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Missing plan/tracking: <strong>{healthStats.missing_data}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setPage(1);
          }}
          title="Clear on-table health slice (does not change server filters)"
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            healthQuickFilter != null
              ? "border-sky-400 bg-sky-50 text-sky-950 ring-2 ring-sky-300/60 hover:bg-sky-100"
              : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          Visible: <strong>{filteredRows.length}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setOnlyOverdueEta((v) => !v);
            setPage(1);
          }}
          aria-pressed={onlyOverdueEta}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            onlyOverdueEta
              ? "border-amber-700 bg-amber-700 text-white ring-2 ring-amber-900/15"
              : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
          }`}
        >
          Overdue ETA: <strong>{triageStats.overdue}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setRouteAction((cur) => (cur === "Send booking" ? "" : "Send booking"));
            setPage(1);
          }}
          aria-pressed={routeAction === "Send booking"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            routeAction === "Send booking"
              ? "border-violet-700 bg-violet-700 text-white ring-2 ring-violet-900/15"
              : "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
          }`}
        >
          Send booking: <strong>{triageStats.needsSendBooking}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setRouteAction((cur) => (cur === "Await booking" ? "" : "Await booking"));
            setPage(1);
          }}
          aria-pressed={routeAction === "Await booking"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            routeAction === "Await booking"
              ? "border-slate-600 bg-slate-600 text-white ring-2 ring-slate-900/15"
              : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
          }`}
        >
          Await confirm: <strong>{triageStats.awaitingBooking}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setRouteAction((cur) => (cur === "Escalate booking" ? "" : "Escalate booking"));
            setPage(1);
          }}
          aria-pressed={routeAction === "Escalate booking"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            routeAction === "Escalate booking"
              ? "border-rose-700 bg-rose-700 text-white ring-2 ring-rose-900/15"
              : "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
          }`}
        >
          Booking SLA overdue: <strong>{triageStats.bookingSlaOverdue}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setRouteAction((cur) => (cur === "Mark departure" ? "" : "Mark departure"));
            setPage(1);
          }}
          aria-pressed={routeAction === "Mark departure"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            routeAction === "Mark departure"
              ? "border-sky-700 bg-sky-700 text-white ring-2 ring-sky-900/15"
              : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
          }`}
        >
          Needs departure: <strong>{triageStats.needsDeparture}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthQuickFilter(null);
            setRouteAction((cur) => (cur === "Record arrival" ? "" : "Record arrival"));
            setPage(1);
          }}
          aria-pressed={routeAction === "Record arrival"}
          className={`cursor-pointer rounded-full border px-3 py-1 transition ${
            routeAction === "Record arrival"
              ? "border-orange-700 bg-orange-700 text-white ring-2 ring-orange-900/15"
              : "border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100"
          }`}
        >
          Needs arrival: <strong>{triageStats.needsArrival}</strong>
        </button>
      </div>
      {healthQuickFilter ? (
        <p className="text-xs text-zinc-600">
          Table and export use <strong>{healthLabel(healthQuickFilter)}</strong> only ({chipFilteredRows.length} of{" "}
          {filteredRows.length} loaded rows). Chip counts above still reflect the full loaded list.
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">
        Last refreshed: {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : "—"}
      </p>
      {listTruncated && listLimit != null ? (
        <p className="text-xs text-amber-900">
          Showing up to <strong>{listLimit}</strong> shipments per load; more rows may match these filters. Narrow
          filters or use <strong>Export CSV</strong> for the visible columns — exports start with a{" "}
          <code className="rounded bg-amber-100 px-0.5">#</code> comment line when the list is capped.
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}
      {savedFiltersErr ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{savedFiltersErr}</p>
      ) : null}

      <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
        <summary className="cursor-pointer select-none font-medium text-zinc-900">Table columns</summary>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-700">
          {WORKBENCH_TOGGABLE_COLUMNS.filter((k) => !(k === "owner" && restrictedView)).map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={colVis[k] !== false}
                onChange={() =>
                  setColVis((prev) => ({
                    ...prev,
                    [k]: prev[k] !== false ? false : true,
                  }))
                }
              />
              {WORKBENCH_COLUMN_LABELS[k]}
            </label>
          ))}
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100"
            onClick={() => setColVis(defaultWorkbenchColumnVisibility())}
          >
            Reset columns
          </button>
        </div>
      </details>
      {canUseBulkAlertAck ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2 py-1 hover:bg-zinc-100"
            onClick={() => {
              setSelectedShipmentIds((prev) => {
                if (allRowsOnPageSelected) {
                  const pageSet = new Set(pagedRowIds);
                  return prev.filter((id) => !pageSet.has(id));
                }
                const next = new Set(prev);
                for (const rowId of pagedRowIds) next.add(rowId);
                return Array.from(next);
              });
            }}
          >
            {allRowsOnPageSelected ? "Clear page selection" : "Select page"}
          </button>
          <button
            type="button"
            disabled={selectedEligibleShipmentIds.length === 0}
            className="rounded border border-arscmp-primary bg-arscmp-primary px-2 py-1 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            onClick={async () => {
              const shipmentIds = selectedEligibleShipmentIds;
              if (shipmentIds.length === 0) {
                window.alert("Select at least one shipment with open alerts.");
                return;
              }
              const res = await fetch("/api/control-tower", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "bulk_acknowledge_ct_alerts",
                  shipmentIds,
                }),
              });
              const parsed: unknown = await res.json();
              if (!res.ok) {
                window.alert(apiClientErrorMessage(parsed, "Could not acknowledge alerts."));
                return;
              }
              const payload = parsed as { acknowledgedAlertCount?: number };
              window.alert(`Acknowledged ${payload.acknowledgedAlertCount ?? 0} open alerts.`);
              setSelectedShipmentIds([]);
              await load();
            }}
          >
            Acknowledge open alerts
          </button>
          <span>
            Selected shipments: <strong>{selectedShipmentIds.length}</strong> · with open alerts:{" "}
            <strong>{selectedEligibleShipmentIds.length}</strong>
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-800">
            <tr>
              {canUseBulkAlertAck ? (
                <th className="w-10 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label={allRowsOnPageSelected ? "Clear page selection" : "Select rows on page"}
                    checked={allRowsOnPageSelected}
                    onChange={() => {
                      setSelectedShipmentIds((prev) => {
                        if (allRowsOnPageSelected) {
                          const pageSet = new Set(pagedRowIds);
                          return prev.filter((id) => !pageSet.has(id));
                        }
                        const next = new Set(prev);
                        for (const rowId of pagedRowIds) next.add(rowId);
                        return Array.from(next);
                      });
                    }}
                  />
                </th>
              ) : null}
              <th className="px-2 py-2" title="Opens Shipment 360. Prefers PO when shipment no looks like an ASN ref.">
                PO / shipment
              </th>
              <th className="px-2 py-2">Order</th>
              <WbTh show={showCol("status")}>Status</WbTh>
              <WbTh show={showCol("mode")}>Mode</WbTh>
              <WbTh show={showCol("health")}>Health</WbTh>
              <WbTh show={showCol("customer")}>Customer</WbTh>
              <WbTh show={showCol("lane")}>Lane</WbTh>
              <WbTh show={showCol("eta")}>ETA</WbTh>
              <WbTh show={showCol("ataDelay")}>ATA / Delay</WbTh>
              <WbTh show={showCol("qtyWt")}>Qty / Wt / Cbm</WbTh>
              <WbTh show={showCol("owner")}>Owner / Queue</WbTh>
              <WbTh show={showCol("route")}>Route</WbTh>
              <WbTh show={showCol("nextAction")}>Next action</WbTh>
              <WbTh
                show={showCol("milestone")}
                title="Workflow milestone (latest) and Control Tower tracking next due."
              >
                Milestone / tracking
              </WbTh>
              <WbTh show={showCol("updated")}>Updated</WbTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="px-2 py-6 text-center text-zinc-500">
                  {busy ? "Loading…" : "No rows match."}
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => (
                <tr
                  key={r.id}
                  className={`text-zinc-800 ${
                    (r.nextAction || "").startsWith("Record arrival")
                      ? "bg-amber-50/40"
                      : (r.nextAction || "").startsWith("Mark departure")
                        ? "bg-sky-50/40"
                        : ""
                  }`}
                >
                  {canUseBulkAlertAck ? (
                    <td className="px-2 py-2 text-center align-top">
                      <input
                        type="checkbox"
                        aria-label={`Select shipment ${r.orderNumber}`}
                        checked={selectedShipmentSet.has(r.id)}
                        onChange={(e) => {
                          setSelectedShipmentIds((prev) => {
                            if (e.target.checked) return Array.from(new Set([...prev, r.id]));
                            return prev.filter((id) => id !== r.id);
                          });
                        }}
                      />
                    </td>
                  ) : null}
                  <td className="px-2 py-2 font-medium">
                    <Link href={shipment360Href(r.id, ship360Tab)} className="block text-sky-800 hover:underline">
                      <span className="text-zinc-900">
                        {controlTowerListPrimaryTitle({
                          orderNumber: r.orderNumber,
                          shipmentNo: r.shipmentNo,
                          id: r.id,
                        })}
                      </span>
                      {(() => {
                        const sub = controlTowerListSecondaryRef({
                          orderNumber: r.orderNumber,
                          shipmentNo: r.shipmentNo,
                          id: r.id,
                        });
                        return sub ? (
                          <span className="mt-0.5 block text-xs font-normal text-zinc-600">{sub}</span>
                        ) : null;
                      })()}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-zinc-600">
                    <Link href={`/orders/${r.orderId}`} className="hover:underline">
                      {r.orderNumber}
                    </Link>
                    {r.shipmentSource === "UNLINKED" ? (
                      <div className="mt-1 space-y-1">
                        <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-900">
                          UNLINKED
                        </span>
                        <div className="text-[11px] text-zinc-600">
                          Ext ref: {r.externalOrderRef || "—"}
                        </div>
                        {!restrictedView ? (
                          <button
                            type="button"
                            className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[10px] hover:bg-zinc-50"
                            onClick={() => void setExternalOrderRef(r)}
                          >
                            Set ref
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <WbTd show={showCol("status")} className="px-2 py-2">
                    {r.status}
                  </WbTd>
                  <WbTd show={showCol("mode")} className="px-2 py-2">
                    {r.transportMode || "—"}
                  </WbTd>
                  <WbTd show={showCol("health")} className="whitespace-nowrap px-2 py-2">
                    {(() => {
                      const health = classifyShipmentHealth(r, Date.now());
                      return (
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${healthBadgeClass(health)}`}>
                          {healthLabel(health)}
                        </span>
                      );
                    })()}
                  </WbTd>
                  <WbTd show={showCol("customer")} className="px-2 py-2 text-xs text-zinc-600">
                    {r.customerCrmAccountName || (r.customerCrmAccountId ? r.customerCrmAccountId.slice(0, 8) + "…" : "—")}
                  </WbTd>
                  <WbTd show={showCol("lane")} className="px-2 py-2 text-xs text-zinc-600">
                    {(r.originCode || "—") + " → " + (r.destinationCode || "—")}
                  </WbTd>
                  <WbTd show={showCol("eta")} className="whitespace-nowrap px-2 py-2 text-xs">
                    {r.eta || r.latestEta
                      ? new Date((r.latestEta || r.eta) as string).toLocaleDateString()
                      : "—"}
                  </WbTd>
                  <WbTd show={showCol("ataDelay")} className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">
                    {r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : "—"}
                    {(() => {
                      const etaIso = r.latestEta || r.eta;
                      if (!etaIso || !r.receivedAt) return null;
                      const deltaMs = new Date(r.receivedAt).getTime() - new Date(etaIso).getTime();
                      const days = Math.round((deltaMs / 86_400_000) * 10) / 10;
                      return (
                        <span
                          className={`ml-2 rounded-full border px-2 py-0.5 ${
                            days <= 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          }`}
                        >
                          {days <= 0 ? `${Math.abs(days)}d early` : `${days}d late`}
                        </span>
                      );
                    })()}
                  </WbTd>
                  <WbTd show={showCol("qtyWt")} className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">
                    {r.quantityRef || "—"} / {r.weightKgRef || "—"}kg / {r.cbmRef || "—"}cbm
                  </WbTd>
                  <WbTd show={showCol("owner")} className="px-2 py-2 text-xs text-zinc-600">
                    <div>{r.dispatchOwner?.name || "Unassigned"}</div>
                    <div className="text-zinc-500">
                      A:{r.openQueueCounts?.openAlerts ?? 0} / E:{r.openQueueCounts?.openExceptions ?? 0}
                    </div>
                  </WbTd>
                  <WbTd show={showCol("route")} className="whitespace-nowrap px-2 py-2 text-xs text-zinc-700">
                    {r.routeProgressPct == null ? "—" : `${r.routeProgressPct}%`}
                  </WbTd>
                  <WbTd show={showCol("nextAction")} className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">
                    {r.nextAction || "—"}
                  </WbTd>
                  <WbTd show={showCol("milestone")} className="px-2 py-2 text-xs text-zinc-600">
                    <div>
                      {r.latestMilestone
                        ? `${r.latestMilestone.code}${r.latestMilestone.hasActual ? " ✓" : ""}`
                        : "—"}{" "}
                      <span className="text-zinc-400">(workflow)</span>
                    </div>
                    {!restrictedView && r.trackingMilestoneSummary?.next ? (
                      <div className="mt-1">
                        <Link
                          href={`/control-tower/shipments/${r.id}?tab=milestones`}
                          className={`inline-flex max-w-[14rem] flex-col rounded border px-2 py-0.5 hover:underline ${
                            r.trackingMilestoneSummary.next.isLate
                              ? "border-rose-200 bg-rose-50 text-rose-900"
                              : "border-sky-200 bg-sky-50 text-sky-900"
                          }`}
                          title="Open Shipment 360 → Milestones"
                        >
                          <span className="font-mono text-[10px]">{r.trackingMilestoneSummary.next.code}</span>
                          {r.trackingMilestoneSummary.next.dueAt ? (
                            <span className="text-[10px] text-zinc-600">
                              {new Date(r.trackingMilestoneSummary.next.dueAt).toLocaleDateString()}
                              {r.trackingMilestoneSummary.next.isLate ? " · late" : ""}
                            </span>
                          ) : null}
                        </Link>
                      </div>
                    ) : !restrictedView &&
                      r.trackingMilestoneSummary &&
                      r.trackingMilestoneSummary.openCount > 0 &&
                      !r.trackingMilestoneSummary.next ? (
                      <div className="mt-1 text-[10px] text-zinc-500">
                        <Link
                          href={`/control-tower/shipments/${r.id}?tab=milestones`}
                          className="text-sky-800 underline"
                        >
                          {r.trackingMilestoneSummary.openCount} open tracking
                        </Link>
                      </div>
                    ) : null}
                  </WbTd>
                  <WbTd show={showCol("updated")} className="whitespace-nowrap px-2 py-2 text-xs text-zinc-500">
                    {new Date(r.updatedAt).toLocaleString()}
                  </WbTd>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
        <span className="text-zinc-600">
          Page {page} / {totalPages}
          {healthQuickFilter ? (
            <span className="ml-2 text-xs text-zinc-500">
              ({chipFilteredRows.length} row{chipFilteredRows.length === 1 ? "" : "s"} in view)
            </span>
          ) : null}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function ControlTowerWorkbench(props: {
  canEdit: boolean;
  restrictedView?: boolean;
  supplierChoices?: Array<{ id: string; name: string }>;
  crmAccountChoices?: Array<{ id: string; name: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading workbench…</p>}>
      <ControlTowerWorkbenchInner {...props} />
    </Suspense>
  );
}
