"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import { ctSlaState } from "@/lib/control-tower/sla-thresholds";
import { CT_SHIPMENT_DOCUMENT_TYPES } from "@/lib/control-tower/shipment-document-types";
import { ControlTowerRouteMap } from "@/components/control-tower-route-map";

type Tab =
  | "details"
  | "routing"
  | "milestones"
  | "documents"
  | "notes"
  | "commercial"
  | "alerts"
  | "exceptions"
  | "audit";

const ALL_TABS: Tab[] = [
  "details",
  "routing",
  "milestones",
  "documents",
  "notes",
  "commercial",
  "alerts",
  "exceptions",
  "audit",
];

function tabFromInitial(v: string | undefined): Tab {
  if (!v) return "details";
  return ALL_TABS.includes(v as Tab) ? (v as Tab) : "details";
}

function shipmentStatusChipClass(status: string) {
  switch (status) {
    case "RECEIVED":
    case "DELIVERED":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "IN_TRANSIT":
    case "BOOKED":
      return "border-sky-300 bg-sky-50 text-sky-900";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-800";
  }
}

function transportModeChipClass(mode: string) {
  const m = mode.toUpperCase();
  if (m === "OCEAN") return "border-cyan-300 bg-cyan-50 text-cyan-950";
  if (m === "AIR") return "border-violet-300 bg-violet-50 text-violet-950";
  if (m === "ROAD") return "border-amber-300 bg-amber-50 text-amber-950";
  if (m === "RAIL") return "border-orange-300 bg-orange-50 text-orange-950";
  return "border-zinc-300 bg-white text-zinc-800";
}

type BolPartyBlock = {
  name: string | null;
  addressLines: string[];
  localityLine: string | null;
  taxId?: string | null;
};

function BolPartyBox({ label, party }: { label: string; party: BolPartyBlock }) {
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-semibold leading-snug text-zinc-950">{party.name || "—"}</p>
      {party.addressLines.map((ln) => (
        <p key={ln} className="text-sm leading-snug text-zinc-700">
          {ln}
        </p>
      ))}
      {party.localityLine ? <p className="mt-1 text-xs text-zinc-600">{party.localityLine}</p> : null}
      {party.taxId ? <p className="mt-0.5 text-[11px] text-zinc-500">Tax ID: {party.taxId}</p> : null}
    </div>
  );
}

export function ControlTowerShipment360({
  shipmentId,
  canEdit,
  initialTab,
}: {
  shipmentId: string;
  canEdit: boolean;
  /** Deep-link from workbench / ops (`?tab=milestones`, etc.). */
  initialTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(() => tabFromInitial(initialTab));
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/control-tower/shipments/${shipmentId}`);
      const json = (await res.json()) as Record<string, unknown> & { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const r = Boolean((data as { view?: { restricted?: boolean } }).view?.restricted);
    if (r && tab === "audit") setTab("details");
  }, [data, tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get("tab") ?? "";
    const want = tab === "details" ? "" : tab;
    if (current === want) return;
    const nextParams = new URLSearchParams(window.location.search);
    if (tab === "details") nextParams.delete("tab");
    else nextParams.set("tab", tab);
    const q = nextParams.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [tab, pathname, router]);

  const bookingSafe = (data?.booking as Record<string, unknown> | null | undefined) ?? undefined;
  const legsSafe = (data?.legs as unknown[]) ?? [];
  const containersSafe = (data?.containers as unknown[]) ?? [];
  const exceptionsSafe = (data?.exceptions as unknown[]) ?? [];

  const stuffedQtyByShipmentItemId = useMemo(() => {
    const m = new Map<string, number>();
    for (const raw of containersSafe) {
      const box = raw as Record<string, unknown>;
      for (const row of (box.cargoLines as unknown[]) ?? []) {
        const cl = row as Record<string, unknown>;
        const sid = String(cl.shipmentItemId);
        const q = Number(String(cl.quantity));
        if (!sid || !Number.isFinite(q)) continue;
        m.set(sid, (m.get(sid) ?? 0) + q);
      }
    }
    return m;
  }, [containersSafe]);

  const routeSubtitle = useMemo(() => {
    const oc = bookingSafe?.originCode ? String(bookingSafe.originCode) : "";
    const dc = bookingSafe?.destinationCode ? String(bookingSafe.destinationCode) : "";
    if (oc || dc) return `${oc || "—"} → ${dc || "—"}`;
    const first = legsSafe[0] as Record<string, unknown> | undefined;
    const last = legsSafe.length ? (legsSafe[legsSafe.length - 1] as Record<string, unknown>) : undefined;
    if (first && last) {
      const a = String(first.originCode || "—");
      const b = String(last.destinationCode || "—");
      return `${a} → ${b}`;
    }
    return null;
  }, [bookingSafe, legsSafe]);

  const openExceptionCount = useMemo(
    () =>
      exceptionsSafe.filter((x) => {
        const st = String((x as Record<string, unknown>).status || "");
        return st === "OPEN" || st === "IN_PROGRESS";
      }).length,
    [exceptionsSafe],
  );

  const modeLabel = String(
    (data?.transportMode as string) || (bookingSafe?.mode as string) || "—",
  );

  async function postAction(body: Record<string, unknown>) {
    const res = await fetch("/api/control-tower", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, unknown> & { error?: string };
    if (!res.ok) throw new Error(json.error || res.statusText);
    await load();
    return json;
  }

  const asLocalDateTime = (iso: unknown) => {
    if (typeof iso !== "string" || !iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const tzOffsetMs = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  };
  const legPhase = (leg: Record<string, unknown>) => {
    if (leg.actualAta) return "Arrived";
    if (leg.actualAtd) return "Departed";
    if (leg.plannedEtd || leg.plannedEta) return "Planned";
    return "Draft";
  };
  const legPhaseClass = (phase: string) => {
    if (phase === "Arrived") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (phase === "Departed") return "border-sky-200 bg-sky-50 text-sky-800";
    if (phase === "Planned") return "border-amber-200 bg-amber-50 text-amber-800";
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  };
  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-900">
        {error}{" "}
        <Link href="/control-tower/workbench" className="font-medium underline">
          Back to workbench
        </Link>
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-zinc-500">{busy ? "Loading…" : "No data."}</p>;
  }

  const order = data.order as Record<string, unknown> | undefined;
  const booking = data.booking as Record<string, unknown> | null | undefined;
  const lines = (data.lines as unknown[]) ?? [];
  const emissions = data.emissionsSummary as
    | {
        tonnageKg: number | null;
        tonnageSource: string;
        totalKgCo2e: number | null;
        totalDistanceKm: number | null;
        methodology: string;
        legs: Array<{
          legNo: number;
          originCode: string | null;
          destinationCode: string | null;
          mode: string | null;
          distanceKm: number | null;
          distanceSource: string;
          kgCo2e: number | null;
        }>;
      }
    | undefined;
  const milestones = (data.milestones as unknown[]) ?? [];
  const ctMilestones = (data.ctTrackingMilestones as unknown[]) ?? [];
  const documents = (data.documents as unknown[]) ?? [];
  const collaborationNotes = (data.collaborationNotes as unknown[]) ?? [];
  const financial = data.financial as Record<string, unknown> | null | undefined;
  const costing = data.costing as
    | {
        displayCurrency: string;
        totalOriginalByCurrency: Record<string, number>;
        convertedTotal: number;
        missingConversionCount: number;
        fxDates: string[];
        lines: Array<{
          id: string;
          category: string;
          description: string | null;
          vendor: string | null;
          invoiceNo: string | null;
          invoiceDate: string | null;
          currency: string;
          amount: number;
          convertedAmount: number | null;
          convertedCurrency: string;
          convertedFxDate: string | null;
          createdByName: string;
          createdAt: string;
        }>;
        availableFxRates: Array<{
          id: string;
          baseCurrency: string;
          quoteCurrency: string;
          rate: number;
          rateDate: string;
          provider: string | null;
        }>;
      }
    | null
    | undefined;
  const alerts = (data.alerts as unknown[]) ?? [];
  const exceptions = (data.exceptions as unknown[]) ?? [];
  const auditTrail = (data.auditTrail as unknown[]) ?? [];
  const ctReferences = (data.ctReferences as unknown[]) ?? [];
  const legs = (data.legs as unknown[]) ?? [];
  const containers = (data.containers as unknown[]) ?? [];
  const routePerformance = data.routePerformance as
    | {
        orderRequestedDeliveryAt: string | null;
        plannedDepartureAt: string | null;
        plannedArrivalAt: string | null;
        actualArrivalAt: string | null;
        plannedVsRequestedDays: number | null;
        actualVsRequestedDays: number | null;
        plannedVsRequestedStatus: "ok" | "at_risk" | "late" | "unknown";
        summary: string | null;
        bookingEtd: string | null;
        bookingEta: string | null;
        bookingLatestEta: string | null;
        hasSyntheticLeg: boolean;
      }
    | undefined;
  const orderForLink = data.order as { id?: string; orderNumber?: string } | undefined;
  const routeProgress = (() => {
    if (!legs.length) return { pct: 0, hint: "Add at least one leg to start route tracking." };
    const normalized = legs.map((raw) => legPhase(raw as Record<string, unknown>));
    const score = normalized.reduce((sum, p) => {
      if (p === "Arrived") return sum + 1;
      if (p === "Departed") return sum + 0.6;
      if (p === "Planned") return sum + 0.2;
      return sum;
    }, 0);
    const pct = Math.round((score / legs.length) * 100);
    const nextIdx = normalized.findIndex((p) => p !== "Arrived");
    if (nextIdx === -1) return { pct, hint: "Route complete: all legs arrived." };
    const nextLeg = legs[nextIdx] as Record<string, unknown>;
    const nextPhase = normalized[nextIdx];
    const origin = (nextLeg.originCode as string) || "—";
    const destination = (nextLeg.destinationCode as string) || "—";
    const nextLabel = `Leg ${String(nextLeg.legNo)} ${origin} -> ${destination}`;
    if (nextPhase === "Draft") {
      return { pct, hint: `Next action: enrich ${nextLabel} with carrier/mode and ETD/ETA.` };
    }
    if (nextPhase === "Planned") {
      return { pct, hint: `Next action: mark departure updates for ${nextLabel}.` };
    }
    return { pct, hint: `Next action: record arrival for ${nextLabel}.` };
  })();
  const crmAccountChoices =
    (data.crmAccountChoices as Array<{ id: string; name: string }> | undefined) ?? [];
  const assigneeChoices =
    (data.assigneeChoices as Array<{ id: string; name: string }> | undefined) ?? [];
  const exceptionCodeCatalog =
    (data.exceptionCodeCatalog as Array<{ code: string; label: string; defaultSeverity: string }>) ?? [];
  const forwarderSupplierChoices =
    (data.forwarderSupplierChoices as Array<{ id: string; name: string }>) ?? [];
  const forwarderOfficeChoices =
    (data.forwarderOfficeChoices as Array<{ id: string; name: string; supplierId: string }>) ?? [];
  const forwarderContactChoices =
    (data.forwarderContactChoices as Array<{
      id: string;
      name: string;
      supplierId: string;
      email: string | null;
    }>) ?? [];
  const opsAssignee = data.opsAssignee as { id: string; name: string } | null | undefined;
  const opsAssigneeUserId = (data.opsAssigneeUserId as string | null | undefined) ?? null;
  const customerCrmAccount = data.customerCrmAccount as
    | { id: string; name: string; legalName: string | null }
    | null
    | undefined;
  const bolDocumentParties = data.bolDocumentParties as
    | {
        shipper: BolPartyBlock;
        consignee: BolPartyBlock;
        notifyParty: { name: string; legalName: string | null } | null;
      }
    | undefined;
  const documentRouting = data.documentRouting as
    | {
        originCode: string | null;
        destinationCode: string | null;
        incoterm: string | null;
        buyerReference: string | null;
        supplierReference: string | null;
      }
    | undefined;

  const restricted = Boolean(
    (data as { view?: { restricted?: boolean } }).view?.restricted,
  );
  const milestoneSummary = data.milestoneSummary as
    | {
        openCount: number;
        lateCount: number;
        next: {
          code: string;
          label: string | null;
          dueAt: string | null;
          isLate: boolean;
        } | null;
      }
    | null
    | undefined;
  const milestonePackCatalog =
    (data.milestonePackCatalog as
      | Array<{ id: string; title: string; description: string; milestoneCount: number }>
      | undefined) ?? [];
  const canApplyMilestonePack = Boolean(
    (data as { canApplyMilestonePack?: boolean }).canApplyMilestonePack,
  );
  const transportModeForMilestonePacks = (data as { transportModeForMilestonePacks?: string | null })
    .transportModeForMilestonePacks;
  const formatMoney = (v: number) =>
    new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const allTabs: { id: Tab; label: string }[] = [
    { id: "details", label: "Details & parties" },
    { id: "routing", label: "Routing & CRM" },
    { id: "milestones", label: "Milestones" },
    { id: "documents", label: "Documents" },
    { id: "notes", label: "Notes" },
    { id: "commercial", label: "Commercial" },
    { id: "alerts", label: "Alerts" },
    { id: "exceptions", label: "Exceptions" },
    { id: "audit", label: "Audit" },
  ];
  const tabs = restricted ? allTabs.filter((t) => t.id !== "audit") : allTabs;

  return (
    <div className="space-y-4">
      {restricted ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Customer or supplier portal view: internal references, audit, and some operational notes are hidden.
        </p>
      ) : null}
      {milestoneSummary && (milestoneSummary.next || milestoneSummary.lateCount > 0) ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            milestoneSummary.lateCount > 0
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-zinc-300 bg-zinc-50 text-zinc-800"
          }`}
        >
          <p className="font-semibold text-zinc-900">Tracking milestones</p>
          <p className="mt-1 text-zinc-700">
            {milestoneSummary.next ? (
              <>
                Next: <span className="font-mono">{milestoneSummary.next.code}</span>
                {milestoneSummary.next.label ? ` (${milestoneSummary.next.label})` : ""}
                {milestoneSummary.next.dueAt ? (
                  <>
                    {" "}
                    · due{" "}
                    <span className="font-medium">
                      {new Date(milestoneSummary.next.dueAt).toLocaleString()}
                    </span>
                  </>
                ) : null}
                {milestoneSummary.next.isLate ? (
                  <span className="ml-2 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900">
                    Late
                  </span>
                ) : null}
              </>
            ) : (
              <span>No dated open tracking milestones — add planned dates or apply a template pack.</span>
            )}
            {milestoneSummary.openCount > 0 ? (
              <span className="ml-2 text-xs text-zinc-600">
                ({milestoneSummary.openCount} open
                {milestoneSummary.lateCount > 0 ? ` · ${milestoneSummary.lateCount} late` : ""})
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
      <header className="rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white via-white to-zinc-50/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
                {(data.shipmentNo as string)
                  ? `Shipment ${data.shipmentNo as string}`
                  : `Shipment ${shipmentId.slice(0, 8)}`}
              </h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${shipmentStatusChipClass(String(data.status || ""))}`}
              >
                {String(data.status || "—")}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${transportModeChipClass(modeLabel)}`}
              >
                {modeLabel}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-zinc-600">
              Order <span className="font-medium text-zinc-800">{(order?.orderNumber as string) || "—"}</span>
              {routeSubtitle ? (
                <>
                  <span className="text-zinc-400"> · </span>
                  <span className="font-medium text-zinc-800">{routeSubtitle}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap justify-end gap-2">
              {emissions && emissions.totalKgCo2e != null ? (
                <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-right text-xs text-emerald-950">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">CO₂e (est.)</p>
                  <p className="font-semibold tabular-nums">{emissions.totalKgCo2e} kg</p>
                </div>
              ) : null}
              {routePerformance && routePerformance.plannedVsRequestedStatus !== "unknown" ? (
                <button
                  type="button"
                  onClick={() => setTab("routing")}
                  className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                    routePerformance.plannedVsRequestedStatus === "ok"
                      ? "border-emerald-200 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100"
                      : routePerformance.plannedVsRequestedStatus === "at_risk"
                        ? "border-amber-200 bg-amber-50/90 text-amber-950 hover:bg-amber-100"
                        : "border-rose-200 bg-rose-50/90 text-rose-950 hover:bg-rose-100"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">PO vs plan</p>
                  <p className="font-semibold">
                    {routePerformance.plannedVsRequestedStatus === "ok"
                      ? "On track"
                      : routePerformance.plannedVsRequestedStatus === "at_risk"
                        ? "At risk"
                        : "Late vs PO"}
                  </p>
                </button>
              ) : null}
              {!restricted ? (
                <button
                  type="button"
                  onClick={() => setTab("exceptions")}
                  className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                    openExceptionCount > 0
                      ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Exceptions</p>
                  <p className="font-semibold tabular-nums">{openExceptionCount} open</p>
                </button>
              ) : null}
            </div>
            <Link
              href="/control-tower/workbench"
              className="text-right text-sm font-medium text-sky-800 hover:underline"
            >
              ← Workbench
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-white text-sky-900 shadow-sm ring-1 ring-zinc-200/80"
                : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <div className="space-y-4">
          <div className={`grid gap-3 ${restricted ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
            <section className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Movement</h2>
              <dl className="mt-3 space-y-2.5 text-zinc-800">
                <div>
                  <dt className="text-xs text-zinc-500">Carrier · tracking</dt>
                  <dd className="font-medium">
                    {(data.carrier as string) || "—"}
                    <span className="text-zinc-400"> · </span>
                    {(data.trackingNo as string) || "—"}
                  </dd>
                </div>
                {booking ? (
                  <>
                    <div>
                      <dt className="text-xs text-zinc-500">Booking</dt>
                      <dd>
                        <span className="font-medium">{(booking.bookingNo as string) || "—"}</span>
                        <span className="text-zinc-400"> · </span>
                        {String(booking.status || "—")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">ETD → ETA</dt>
                      <dd className="text-xs">
                        {booking.etd ? new Date(booking.etd as string).toLocaleString() : "—"} →{" "}
                        {booking.eta ? new Date(booking.eta as string).toLocaleString() : "—"}
                      </dd>
                    </div>
                  </>
                ) : null}
                <div>
                  <dt className="text-xs text-zinc-500">Forwarder</dt>
                  <dd className="font-medium text-zinc-900">
                    {booking?.forwarderSupplierName ? String(booking.forwarderSupplierName) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">ASN · expected receive</dt>
                  <dd className="text-xs">
                    {(data.asnReference as string) || "—"}
                    <span className="text-zinc-400"> · </span>
                    {data.expectedReceiveAt
                      ? new Date(data.expectedReceiveAt as string).toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Shipped → received</dt>
                  <dd className="text-xs">
                    {data.shippedAt ? new Date(data.shippedAt as string).toLocaleString() : "—"}
                    <span className="text-zinc-400"> → </span>
                    {data.receivedAt ? new Date(data.receivedAt as string).toLocaleString() : "—"}
                  </dd>
                </div>
                {data.shipmentNotes ? (
                  <div>
                    <dt className="text-xs text-zinc-500">Notes</dt>
                    <dd className="text-sm leading-snug text-zinc-700">{String(data.shipmentNotes)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
            <section className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Parties</h2>
              <dl className="mt-3 space-y-2.5 text-zinc-800">
                <div>
                  <dt className="text-xs text-zinc-500">Supplier</dt>
                  <dd className="font-medium">{(order?.supplier as { name?: string } | undefined)?.name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Ship to</dt>
                  <dd>
                    {(order?.shipToName as string) || "—"}
                    {order?.shipToCity ? `, ${String(order.shipToCity)}` : ""}{" "}
                    {(order?.shipToCountryCode as string) || ""}
                  </dd>
                </div>
                {customerCrmAccount ? (
                  <div>
                    <dt className="text-xs text-zinc-500">Logistics customer</dt>
                    <dd className="font-medium text-zinc-900">{customerCrmAccount.name}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          {!restricted ? (
            <section className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Custody & forwarder</h2>
              <dl className="mt-2 grid gap-2 text-xs text-zinc-700 sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Forwarder</dt>
                  <dd className="font-medium">
                    {booking?.forwarderSupplierName
                      ? String(booking.forwarderSupplierName)
                      : "—"}
                    {booking?.forwarderOfficeName ? (
                      <span className="block text-[11px] font-normal text-zinc-600">
                        Office: {String(booking.forwarderOfficeName)}
                        {booking.forwarderOfficeCity ? ` · ${String(booking.forwarderOfficeCity)}` : ""}
                      </span>
                    ) : null}
                    {booking?.forwarderContactName ? (
                      <span className="block text-[11px] font-normal text-zinc-600">
                        Contact: {String(booking.forwarderContactName)}
                        {booking.forwarderContactEmail ? ` · ${String(booking.forwarderContactEmail)}` : ""}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Booking record</dt>
                  <dd>
                    {booking?.bookingCreatedByName ? (
                      <span className="block">Created by {String(booking.bookingCreatedByName)}</span>
                    ) : (
                      <span className="block text-zinc-500">No booking row yet</span>
                    )}
                    {booking?.bookingUpdatedByName ? (
                      <span className="block text-zinc-600">
                        Last saved by {String(booking.bookingUpdatedByName)}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Ops assignee (this shipment)</dt>
                  <dd>
                    {canEdit ? (
                      <select
                        className="mt-0.5 max-w-xs rounded border border-zinc-300 px-2 py-1"
                        defaultValue={opsAssigneeUserId || ""}
                        onChange={async (e) => {
                          try {
                            await postAction({
                              action: "update_shipment_ops_assignee",
                              shipmentId,
                              opsAssigneeUserId: e.target.value || null,
                            });
                          } catch (err) {
                            window.alert(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        <option value="">Unassigned</option>
                        {assigneeChoices.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-medium">{opsAssignee?.name ?? "—"}</span>
                    )}
                  </dd>
                </div>
              </dl>
              {canEdit ? (
                <form
                  key={`fwd-${String(booking?.forwarderSupplierId ?? "")}`}
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 text-xs"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const sup = String(fd.get("forwarderSupplierId") || "").trim();
                    try {
                      await postAction({
                        action: "update_ct_shipment_booking_forwarder",
                        shipmentId,
                        forwarderSupplierId: sup || null,
                        forwarderOfficeId: String(fd.get("forwarderOfficeId") || "").trim() || null,
                        forwarderContactId: String(fd.get("forwarderContactId") || "").trim() || null,
                      });
                      await load();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-zinc-500">Forwarder (supplier)</span>
                    <select
                      name="forwarderSupplierId"
                      defaultValue={String(booking?.forwarderSupplierId || "")}
                      className="min-w-[200px] rounded border px-2 py-1"
                    >
                      <option value="">None</option>
                      {forwarderSupplierChoices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-zinc-500">Office</span>
                    <select name="forwarderOfficeId" className="min-w-[180px] rounded border px-2 py-1">
                      <option value="">—</option>
                      {forwarderOfficeChoices.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-zinc-500">Contact</span>
                    <select name="forwarderContactId" className="min-w-[200px] rounded border px-2 py-1">
                      <option value="">—</option>
                      {forwarderContactChoices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.email ? ` (${c.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                    Save forwarder
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}
          </div>

          {bolDocumentParties ? (
            <section className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">Shipper, consignee & notify party</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Typical BOL / AWB party boxes: shipper from the supplier master (registered address), consignee from the
                order ship-to, notify party from the linked logistics customer when set.
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <BolPartyBox label="Shipper" party={bolDocumentParties.shipper} />
                <BolPartyBox label="Consignee" party={bolDocumentParties.consignee} />
                <BolPartyBox
                  label="Notify party"
                  party={{
                    name: bolDocumentParties.notifyParty?.name ?? null,
                    addressLines: bolDocumentParties.notifyParty?.legalName
                      ? [bolDocumentParties.notifyParty.legalName]
                      : [],
                    localityLine: null,
                  }}
                />
              </div>
              {documentRouting ? (
                <dl className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-700 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-zinc-500">Place of receipt / origin</dt>
                    <dd className="mt-0.5 font-mono text-sm text-zinc-900">
                      {documentRouting.originCode || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-zinc-500">
                      Port of discharge / destination
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm text-zinc-900">
                      {documentRouting.destinationCode || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-zinc-500">Incoterm</dt>
                    <dd className="mt-0.5">{documentRouting.incoterm || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <dt className="font-semibold uppercase tracking-wide text-zinc-500">References on documents</dt>
                    <dd className="mt-0.5 space-y-0.5">
                      {documentRouting.buyerReference ? (
                        <span className="block">Buyer ref: {documentRouting.buyerReference}</span>
                      ) : null}
                      {documentRouting.supplierReference ? (
                        <span className="block">Supplier ref: {documentRouting.supplierReference}</span>
                      ) : null}
                      {!documentRouting.buyerReference && !documentRouting.supplierReference ? (
                        <span className="text-zinc-400">—</span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-semibold text-zinc-900">Cargo & equipment</h2>
              <button
                type="button"
                onClick={() => setTab("routing")}
                className="text-xs font-medium text-sky-800 underline decoration-sky-300 hover:text-sky-950"
              >
                Routing & containers →
              </button>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-zinc-700">
              <div>
                <dt className="text-xs text-zinc-500">Est. gross weight</dt>
                <dd className="font-medium tabular-nums">
                  {data.estimatedWeightKg != null && String(data.estimatedWeightKg).trim() !== ""
                    ? `${data.estimatedWeightKg} kg`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Est. volume</dt>
                <dd className="font-medium tabular-nums">
                  {data.estimatedVolumeCbm != null && String(data.estimatedVolumeCbm).trim() !== ""
                    ? `${data.estimatedVolumeCbm} m³`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Outer packages (pieces)</dt>
                <dd className="font-medium tabular-nums">
                  {data.cargoOuterPackageCount != null ? String(data.cargoOuterPackageCount) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Chargeable weight</dt>
                <dd className="font-medium tabular-nums">
                  {data.cargoChargeableWeightKg != null && String(data.cargoChargeableWeightKg).trim() !== ""
                    ? `${data.cargoChargeableWeightKg} kg`
                    : "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Dimensions (summary)</dt>
                <dd className="text-sm">{String(data.cargoDimensionsText || "—")}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-zinc-500">Commodity</dt>
                <dd className="text-sm text-zinc-800">{String(data.cargoCommoditySummary || "—")}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Containers on file</dt>
                <dd className="font-medium tabular-nums">{containers.length}</dd>
              </div>
            </dl>
            {canEdit ? (
              <form
                className="mt-4 border-t border-zinc-100 pt-4 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const numOrEmpty = (name: string) => {
                    const v = String(fd.get(name) ?? "").trim();
                    return v === "" ? null : v;
                  };
                  try {
                    await postAction({
                      action: "update_shipment_cargo_summary",
                      shipmentId,
                      estimatedWeightKg: numOrEmpty("estimatedWeightKg"),
                      estimatedVolumeCbm: numOrEmpty("estimatedVolumeCbm"),
                      cargoOuterPackageCount: numOrEmpty("cargoOuterPackageCount"),
                      cargoChargeableWeightKg: numOrEmpty("cargoChargeableWeightKg"),
                      cargoDimensionsText: String(fd.get("cargoDimensionsText") ?? "").trim() || null,
                      cargoCommoditySummary: String(fd.get("cargoCommoditySummary") ?? "").trim() || null,
                    });
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                <p className="mb-2 font-medium text-zinc-800">Edit cargo summary</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-zinc-500">Est. weight (kg)</span>
                    <input
                      name="estimatedWeightKg"
                      defaultValue={String(data.estimatedWeightKg ?? "")}
                      className="rounded border border-zinc-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-zinc-500">Est. volume (m³)</span>
                    <input
                      name="estimatedVolumeCbm"
                      defaultValue={String(data.estimatedVolumeCbm ?? "")}
                      className="rounded border border-zinc-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-zinc-500">Outer packages</span>
                    <input
                      name="cargoOuterPackageCount"
                      defaultValue={
                        data.cargoOuterPackageCount != null ? String(data.cargoOuterPackageCount) : ""
                      }
                      className="rounded border border-zinc-300 px-2 py-1"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-zinc-500">Chargeable weight (kg)</span>
                    <input
                      name="cargoChargeableWeightKg"
                      defaultValue={String(data.cargoChargeableWeightKg ?? "")}
                      className="rounded border border-zinc-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-zinc-500">Dimensions (text)</span>
                    <input
                      name="cargoDimensionsText"
                      defaultValue={String(data.cargoDimensionsText ?? "")}
                      placeholder="e.g. 120×80×100 cm"
                      className="rounded border border-zinc-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                    <span className="text-zinc-500">Commodity</span>
                    <textarea
                      name="cargoCommoditySummary"
                      defaultValue={String(data.cargoCommoditySummary ?? "")}
                      rows={2}
                      className="rounded border border-zinc-300 px-2 py-1"
                    />
                  </label>
                </div>
                <button type="submit" className="mt-3 rounded bg-zinc-900 px-3 py-1.5 text-white">
                  Save cargo summary
                </button>
              </form>
            ) : null}
          </section>
          <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-sm shadow-sm">
            <h2 className="font-semibold text-emerald-950">CO₂e (estimated)</h2>
            <p className="mt-1 text-xs text-emerald-900/80">
              Planning-grade footprint from legs × mass. Extend the coordinate table and swap emission factors when you
              lock a methodology for reporting.
            </p>
            {emissions && emissions.legs.length > 0 ? (
              <>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-emerald-950">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">Mass basis</dt>
                    <dd className="font-medium tabular-nums">
                      {emissions.tonnageKg != null
                        ? `${emissions.tonnageKg} kg (${emissions.tonnageSource.replace(/_/g, " ")})`
                        : "— (add chargeable / est. weight or line kg)"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">
                      Route distance (sum)
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {emissions.totalDistanceKm != null ? `${emissions.totalDistanceKm} km` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">
                      Shipment total
                    </dt>
                    <dd className="text-base font-semibold tabular-nums text-emerald-950">
                      {emissions.totalKgCo2e != null ? `${emissions.totalKgCo2e} kg CO₂e` : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 overflow-x-auto rounded border border-emerald-100/80 bg-white/80">
                  <table className="min-w-full text-left text-xs text-emerald-950">
                    <thead className="bg-emerald-100/50 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                      <tr>
                        <th className="px-2 py-2">Leg</th>
                        <th className="px-2 py-2">Lane</th>
                        <th className="px-2 py-2">Mode</th>
                        <th className="px-2 py-2">Distance</th>
                        <th className="px-2 py-2">Source</th>
                        <th className="px-2 py-2">Leg CO₂e</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {emissions.legs.map((row) => (
                        <tr key={row.legNo}>
                          <td className="whitespace-nowrap px-2 py-2 font-mono">{row.legNo}</td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {(row.originCode || "—") + " → " + (row.destinationCode || "—")}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">{row.mode || "—"}</td>
                          <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                            {row.distanceKm != null ? `${row.distanceKm} km` : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-emerald-800/90">
                            {row.distanceSource === "coordinates"
                              ? "Great circle"
                              : row.distanceSource === "time_speed"
                                ? "Schedule × speed"
                                : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 tabular-nums font-medium">
                            {row.kgCo2e != null ? `${row.kgCo2e} kg` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-emerald-900/75">{emissions.methodology}</p>
              </>
            ) : (
              <p className="mt-2 text-xs text-emerald-900/80">
                Add routing legs (or a booking with origin / destination) plus shipment weight to estimate CO₂e.
              </p>
            )}
          </section>
          <section className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
            <h2 className="font-semibold text-zinc-900">Lines & cargo (order)</h2>
            <div className="mt-2 overflow-x-auto rounded border border-zinc-100">
              <table className="min-w-full text-left text-xs text-zinc-800">
                <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="whitespace-nowrap px-2 py-2">Ln</th>
                    <th className="min-w-[8rem] px-2 py-2">Description</th>
                    <th className="whitespace-nowrap px-2 py-2">SKU / code</th>
                    <th className="whitespace-nowrap px-2 py-2">Order qty</th>
                    <th className="whitespace-nowrap px-2 py-2">Shipped</th>
                    <th className="whitespace-nowrap px-2 py-2">Rcvd</th>
                    <th className="whitespace-nowrap px-2 py-2">HS</th>
                    <th className="whitespace-nowrap px-2 py-2">DG</th>
                    <th className="whitespace-nowrap px-2 py-2">Pkgs</th>
                    <th className="whitespace-nowrap px-2 py-2">Kg</th>
                    <th className="whitespace-nowrap px-2 py-2">m³</th>
                    <th className="min-w-[6rem] px-2 py-2">Dims</th>
                    {canEdit ? <th className="px-2 py-2"> </th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {lines.map((line) => {
                    const l = line as Record<string, unknown>;
                    const p = l.product as Record<string, unknown> | null | undefined;
                    const dg = Boolean(p?.isDangerousGoods);
                    const sku = p ? String(p.sku || p.productCode || "") : "";
                    return (
                      <tr key={String(l.id)} className="align-top">
                        <td className="whitespace-nowrap px-2 py-2 font-mono">{String(l.lineNo)}</td>
                        <td className="max-w-[14rem] px-2 py-2 text-zinc-700">{String(l.description)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-zinc-600">{sku || "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">{String(l.orderLineQuantity)}</td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">{String(l.quantityShipped)}</td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">{String(l.quantityReceived)}</td>
                        <td className="whitespace-nowrap px-2 py-2 font-mono text-[10px]">
                          {p?.hsCode ? String(p.hsCode) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {dg ? (
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-900">
                              DG{p?.unNumber ? ` · ${String(p.unNumber)}` : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {l.cargoPackageCount != null ? String(l.cargoPackageCount) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {l.cargoGrossWeightKg != null ? String(l.cargoGrossWeightKg) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {l.cargoVolumeCbm != null ? String(l.cargoVolumeCbm) : "—"}
                        </td>
                        <td className="max-w-[10rem] px-2 py-2 text-zinc-600">
                          {l.cargoDimensionsText ? String(l.cargoDimensionsText) : "—"}
                        </td>
                        {canEdit ? (
                          <td className="px-2 py-2">
                            <form
                              className="flex flex-col gap-1"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const fd = new FormData(e.currentTarget);
                                const emptyToNull = (name: string) => {
                                  const v = String(fd.get(name) ?? "").trim();
                                  return v === "" ? null : v;
                                };
                                try {
                                  await postAction({
                                    action: "update_shipment_item_cargo",
                                    shipmentId,
                                    shipmentItemId: String(l.id),
                                    cargoPackageCount: emptyToNull("cargoPackageCount"),
                                    cargoGrossWeightKg: emptyToNull("cargoGrossWeightKg"),
                                    cargoVolumeCbm: emptyToNull("cargoVolumeCbm"),
                                    cargoDimensionsText:
                                      String(fd.get("cargoDimensionsText") ?? "").trim() || null,
                                  });
                                } catch (err) {
                                  window.alert(err instanceof Error ? err.message : "Failed");
                                }
                              }}
                            >
                              <input
                                name="cargoPackageCount"
                                placeholder="Pkgs"
                                defaultValue={
                                  l.cargoPackageCount != null ? String(l.cargoPackageCount) : ""
                                }
                                className="w-14 rounded border px-1 py-0.5"
                              />
                              <input
                                name="cargoGrossWeightKg"
                                placeholder="Kg"
                                defaultValue={
                                  l.cargoGrossWeightKg != null ? String(l.cargoGrossWeightKg) : ""
                                }
                                className="w-16 rounded border px-1 py-0.5"
                              />
                              <input
                                name="cargoVolumeCbm"
                                placeholder="m³"
                                defaultValue={
                                  l.cargoVolumeCbm != null ? String(l.cargoVolumeCbm) : ""
                                }
                                className="w-16 rounded border px-1 py-0.5"
                              />
                              <input
                                name="cargoDimensionsText"
                                placeholder="Dims"
                                defaultValue={String(l.cargoDimensionsText ?? "")}
                                className="w-24 rounded border px-1 py-0.5"
                              />
                              <button
                                type="submit"
                                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-white"
                              >
                                Save
                              </button>
                            </form>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold text-zinc-900">References</h2>
            <ul className="space-y-1 text-xs">
              {ctReferences.length === 0 ? (
                <li className="text-zinc-500">No extra references.</li>
              ) : (
                ctReferences.map((r) => {
                  const row = r as Record<string, unknown>;
                  return (
                    <li key={String(row.id)}>
                      <span className="font-medium">{String(row.refType)}</span>: {String(row.refValue)}
                    </li>
                  );
                })
              )}
            </ul>
            {canEdit ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const refType = String(fd.get("refType") || "").trim();
                  const refValue = String(fd.get("refValue") || "").trim();
                  if (!refType || !refValue) return;
                  try {
                    await postAction({
                      action: "add_ct_reference",
                      shipmentId,
                      refType,
                      refValue,
                    });
                    (e.target as HTMLFormElement).reset();
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                <input name="refType" placeholder="Type (e.g. MASTER_BL)" className="rounded border px-2 py-1 text-xs" />
                <input name="refValue" placeholder="Value" className="rounded border px-2 py-1 text-xs" />
                <button type="submit" className="rounded bg-zinc-900 px-2 py-1 text-xs text-white">
                  Add reference
                </button>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "routing" ? (
        <div className="space-y-4">
          {routePerformance ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-zinc-900">Route plan vs PO & actuals</h2>
                  <p className="mt-1 text-xs text-zinc-600">
                    Compare requested delivery on the PO to planned booking / leg arrival and recorded actuals.
                    {routePerformance.hasSyntheticLeg ? (
                      <span className="ml-1 text-amber-800">
                        Showing booking as a single segment until you add explicit legs.
                      </span>
                    ) : null}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                    routePerformance.plannedVsRequestedStatus === "ok"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : routePerformance.plannedVsRequestedStatus === "at_risk"
                        ? "border-amber-300 bg-amber-50 text-amber-950"
                        : routePerformance.plannedVsRequestedStatus === "late"
                          ? "border-rose-300 bg-rose-50 text-rose-950"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  }`}
                >
                  {routePerformance.plannedVsRequestedStatus === "ok"
                    ? "On plan"
                    : routePerformance.plannedVsRequestedStatus === "at_risk"
                      ? "At risk vs PO"
                      : routePerformance.plannedVsRequestedStatus === "late"
                        ? "Late vs PO"
                        : "Incomplete data"}
                </span>
              </div>
              {routePerformance.summary ? (
                <p className="mt-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
                  {routePerformance.summary}
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">PO requested</p>
                  <p className="mt-1 font-mono text-sm text-zinc-900">
                    {routePerformance.orderRequestedDeliveryAt
                      ? new Date(routePerformance.orderRequestedDeliveryAt).toLocaleDateString()
                      : "—"}
                  </p>
                  {orderForLink?.id ? (
                    <Link
                      href={`/orders/${orderForLink.id}`}
                      className="mt-2 inline-block text-xs text-sky-800 underline"
                    >
                      Open {orderForLink.orderNumber ?? "PO"}
                    </Link>
                  ) : null}
                </div>
                <div className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Planned departure</p>
                  <p className="mt-1 font-mono text-sm text-zinc-900">
                    {routePerformance.plannedDepartureAt
                      ? new Date(routePerformance.plannedDepartureAt).toLocaleString()
                      : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Booking ETD {routePerformance.bookingEtd ? new Date(routePerformance.bookingEtd).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Planned arrival</p>
                  <p className="mt-1 font-mono text-sm text-zinc-900">
                    {routePerformance.plannedArrivalAt
                      ? new Date(routePerformance.plannedArrivalAt).toLocaleString()
                      : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    ETA / latest{" "}
                    {routePerformance.bookingLatestEta || routePerformance.bookingEta
                      ? new Date(
                          routePerformance.bookingLatestEta || routePerformance.bookingEta || "",
                        ).toLocaleDateString()
                      : "—"}
                  </p>
                  {routePerformance.plannedVsRequestedDays != null &&
                  routePerformance.orderRequestedDeliveryAt ? (
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        routePerformance.plannedVsRequestedDays > 0 ? "text-amber-800" : "text-emerald-800"
                      }`}
                    >
                      {routePerformance.plannedVsRequestedDays > 0
                        ? `+${routePerformance.plannedVsRequestedDays} d vs PO`
                        : `${routePerformance.plannedVsRequestedDays} d vs PO`}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Actual arrival</p>
                  <p className="mt-1 font-mono text-sm text-zinc-900">
                    {routePerformance.actualArrivalAt
                      ? new Date(routePerformance.actualArrivalAt).toLocaleString()
                      : "—"}
                  </p>
                  {routePerformance.actualVsRequestedDays != null &&
                  routePerformance.orderRequestedDeliveryAt ? (
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        routePerformance.actualVsRequestedDays > 0 ? "text-rose-800" : "text-emerald-800"
                      }`}
                    >
                      {routePerformance.actualVsRequestedDays > 0
                        ? `+${routePerformance.actualVsRequestedDays} d vs PO`
                        : `${routePerformance.actualVsRequestedDays} d vs PO`}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
          <ControlTowerRouteMap
            legs={legs.map((raw) => {
              const leg = raw as Record<string, unknown>;
              return {
                legNo: Number(leg.legNo) || 0,
                originCode: (leg.originCode as string) || null,
                destinationCode: (leg.destinationCode as string) || null,
                plannedEtd: (leg.plannedEtd as string) || null,
                plannedEta: (leg.plannedEta as string) || null,
                actualAtd: (leg.actualAtd as string) || null,
                actualAta: (leg.actualAta as string) || null,
              };
            })}
          />

          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">Customer account scope</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Shipments tagged for a customer account are visible to users scoped to that account (in
              addition to supplier-portal workflows).
            </p>
            {customerCrmAccount ? (
              <p className="mt-2 text-zinc-800">
                <span className="font-medium">{customerCrmAccount.name}</span>
                {customerCrmAccount.legalName ? (
                  <span className="text-zinc-500"> · {customerCrmAccount.legalName}</span>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">No customer account linked.</p>
            )}
            {canEdit && crmAccountChoices.length > 0 ? (
              <form
                key={String(data.customerCrmAccountId ?? "none")}
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const raw = String(fd.get("crmAccountId") ?? "");
                  const crmAccountId = raw === "" ? null : raw;
                  try {
                    await postAction({
                      action: "set_shipment_customer_crm_account",
                      shipmentId,
                      crmAccountId,
                    });
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-zinc-500">Link account</span>
                  <select
                    name="crmAccountId"
                    defaultValue={(data.customerCrmAccountId as string) || ""}
                    className="rounded border border-zinc-300 px-2 py-1"
                  >
                    <option value="">None</option>
                    {crmAccountChoices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-white">
                  Save
                </button>
              </form>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">Legs</h2>
            {legs.length > 0 ? (
              <div className="mt-2 rounded border border-zinc-100 bg-zinc-50 p-2">
                <div className="mb-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-600">
                    <span>Route progress</span>
                    <span className="font-semibold text-zinc-800">{routeProgress.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-zinc-200">
                    <div
                      className="h-full rounded bg-sky-600 transition-all"
                      style={{ width: `${routeProgress.pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-600">{routeProgress.hint}</p>
                </div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Route timeline</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {legs.map((raw, idx) => {
                    const leg = raw as Record<string, unknown>;
                    const phase = legPhase(leg);
                    return (
                      <div key={String(leg.id)} className="flex items-center gap-2">
                        <div
                          className={`rounded border px-2 py-1 text-[11px] ${legPhaseClass(phase)}`}
                          title={`Leg ${String(leg.legNo)} · ${phase}`}
                        >
                          <span className="font-semibold">L{String(leg.legNo)}</span>{" "}
                          {(leg.originCode as string) || "—"} → {(leg.destinationCode as string) || "—"}
                          <span className="ml-1 opacity-80">({phase})</span>
                          {(Boolean(leg.plannedEtd) || Boolean(leg.plannedEta)) && (
                            <span className="ml-1 opacity-80">
                              · {leg.plannedEtd ? new Date(leg.plannedEtd as string).toLocaleDateString() : "—"} to{" "}
                              {leg.plannedEta ? new Date(leg.plannedEta as string).toLocaleDateString() : "—"}
                            </span>
                          )}
                        </div>
                        {idx < legs.length - 1 ? <span className="text-zinc-400">→</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {legs.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No routing legs yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-xs">
                {legs.map((raw) => {
                  const leg = raw as Record<string, unknown>;
                  return (
                    <li key={String(leg.id)} className="border-b border-zinc-100 pb-2">
                      <div>
                        <span className="font-medium">Leg {String(leg.legNo)}</span> ·{" "}
                        {(leg.originCode as string) || "—"} → {(leg.destinationCode as string) || "—"} ·{" "}
                        {(leg.carrier as string) || "—"} · {String(leg.transportMode || "—")}
                        <span className="ml-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                          {legPhase(leg)}
                        </span>
                        <div className="text-zinc-500">
                          ETD {leg.plannedEtd ? new Date(leg.plannedEtd as string).toLocaleString() : "—"} · ETA{" "}
                          {leg.plannedEta ? new Date(leg.plannedEta as string).toLocaleString() : "—"}
                          {leg.actualAtd || leg.actualAta ? (
                            <>
                              {" "}
                              · ATD{" "}
                              {leg.actualAtd ? new Date(leg.actualAtd as string).toLocaleDateString() : "—"} / ATA{" "}
                              {leg.actualAta ? new Date(leg.actualAta as string).toLocaleDateString() : "—"}
                            </>
                          ) : null}
                        </div>
                        {leg.notes ? <p className="mt-1 text-zinc-600">{String(leg.notes)}</p> : null}
                      </div>
                      {canEdit ? (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <form
                            className="flex flex-wrap items-end gap-2"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const fd = new FormData(e.currentTarget);
                              const mode = String(fd.get("transportMode") || "").trim();
                              try {
                                await postAction({
                                  action: "update_ct_leg",
                                  legId: String(leg.id),
                                  originCode: String(fd.get("originCode") || ""),
                                  destinationCode: String(fd.get("destinationCode") || ""),
                                  carrier: String(fd.get("carrier") || ""),
                                  transportMode: mode || null,
                                  plannedEtd: String(fd.get("plannedEtd") || "") || null,
                                  plannedEta: String(fd.get("plannedEta") || "") || null,
                                  actualAtd: String(fd.get("actualAtd") || "") || null,
                                  actualAta: String(fd.get("actualAta") || "") || null,
                                  notes: String(fd.get("notes") || ""),
                                });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            <input
                              name="originCode"
                              defaultValue={String(leg.originCode || "")}
                              placeholder="Origin"
                              className="w-24 rounded border px-1 py-0.5"
                            />
                            <input
                              name="destinationCode"
                              defaultValue={String(leg.destinationCode || "")}
                              placeholder="Dest"
                              className="w-24 rounded border px-1 py-0.5"
                            />
                            <input
                              name="carrier"
                              defaultValue={String(leg.carrier || "")}
                              placeholder="Carrier"
                              className="w-28 rounded border px-1 py-0.5"
                            />
                            <select
                              name="transportMode"
                              defaultValue={String(leg.transportMode || "")}
                              className="rounded border px-1 py-0.5"
                            >
                              <option value="">Mode</option>
                              <option value="OCEAN">OCEAN</option>
                              <option value="AIR">AIR</option>
                              <option value="ROAD">ROAD</option>
                              <option value="RAIL">RAIL</option>
                            </select>
                            <input
                              name="plannedEtd"
                              type="datetime-local"
                              defaultValue={asLocalDateTime(leg.plannedEtd)}
                              className="rounded border px-1 py-0.5"
                            />
                            <input
                              name="plannedEta"
                              type="datetime-local"
                              defaultValue={asLocalDateTime(leg.plannedEta)}
                              className="rounded border px-1 py-0.5"
                            />
                            <input
                              name="actualAtd"
                              type="datetime-local"
                              defaultValue={asLocalDateTime(leg.actualAtd)}
                              className="rounded border px-1 py-0.5"
                            />
                            <input
                              name="actualAta"
                              type="datetime-local"
                              defaultValue={asLocalDateTime(leg.actualAta)}
                              className="rounded border px-1 py-0.5"
                            />
                            <input
                              name="notes"
                              defaultValue={String(leg.notes || "")}
                              placeholder="Notes"
                              className="w-36 rounded border px-1 py-0.5"
                            />
                            <button type="submit" className="rounded bg-zinc-800 px-2 py-0.5 text-white">
                              Update
                            </button>
                          </form>
                          <button
                            type="button"
                            className="shrink-0 rounded border border-zinc-300 px-2 py-0.5"
                            onClick={async () => {
                              try {
                                await postAction({
                                  action: "move_ct_leg",
                                  legId: String(leg.id),
                                  direction: "up",
                                });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded border border-zinc-300 px-2 py-0.5"
                            onClick={async () => {
                              try {
                                await postAction({
                                  action: "move_ct_leg",
                                  legId: String(leg.id),
                                  direction: "down",
                                });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded border border-red-200 px-2 py-0.5 text-red-800"
                            onClick={async () => {
                              if (!window.confirm("Delete this leg?")) return;
                              try {
                                await postAction({ action: "delete_ct_leg", legId: String(leg.id) });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit ? (
              <form
                className="mt-3 grid gap-2 border-t border-zinc-100 pt-3 text-xs md:grid-cols-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const mode = String(fd.get("transportMode") || "").trim();
                  try {
                    await postAction({
                      action: "create_ct_leg",
                      shipmentId,
                      originCode: String(fd.get("originCode") || "") || null,
                      destinationCode: String(fd.get("destinationCode") || "") || null,
                      carrier: String(fd.get("carrier") || "") || null,
                      transportMode: mode || null,
                      plannedEtd: String(fd.get("plannedEtd") || "") || null,
                      plannedEta: String(fd.get("plannedEta") || "") || null,
                      notes: String(fd.get("notes") || "") || null,
                    });
                    (e.target as HTMLFormElement).reset();
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                <input name="originCode" placeholder="Origin code" className="rounded border px-2 py-1" />
                <input name="destinationCode" placeholder="Dest code" className="rounded border px-2 py-1" />
                <input name="carrier" placeholder="Carrier" className="rounded border px-2 py-1" />
                <select name="transportMode" className="rounded border px-2 py-1">
                  <option value="">Mode (optional)</option>
                  <option value="OCEAN">OCEAN</option>
                  <option value="AIR">AIR</option>
                  <option value="ROAD">ROAD</option>
                  <option value="RAIL">RAIL</option>
                </select>
                <input name="plannedEtd" type="datetime-local" className="rounded border px-2 py-1" />
                <input name="plannedEta" type="datetime-local" className="rounded border px-2 py-1" />
                <input name="notes" placeholder="Notes" className="rounded border px-2 py-1 md:col-span-3" />
                <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white md:col-span-3">
                  Add leg
                </button>
              </form>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">Containers</h2>
            {containers.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No containers yet.</p>
            ) : (
              <ul className="mt-2 space-y-3 text-xs">
                {containers.map((raw) => {
                  const c = raw as Record<string, unknown>;
                  return (
                    <li key={String(c.id)} className="border-b border-zinc-100 pb-2">
                      <div className="font-medium">
                        {String(c.containerNumber)}
                        {c.legNo != null ? (
                          <span className="font-normal text-zinc-500"> · leg {String(c.legNo)}</span>
                        ) : null}
                      </div>
                      <div className="text-zinc-600">
                        {String(c.containerType || "—")} · {String(c.status || "—")} · seal{" "}
                        {String(c.seal || "—")}
                      </div>
                      <div className="text-zinc-500">
                        Gate in {c.gateInAt ? new Date(c.gateInAt as string).toLocaleString() : "—"} · out{" "}
                        {c.gateOutAt ? new Date(c.gateOutAt as string).toLocaleString() : "—"}
                      </div>
                      <div className="mt-1 flex gap-1">
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                          {c.gateInAt ? "Gate-in done" : "Awaiting gate-in"}
                        </span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                          {c.gateOutAt ? "Gate-out done" : "Awaiting gate-out"}
                        </span>
                      </div>
                      <div className="mt-3 rounded border border-sky-100 bg-sky-50/70 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-950">
                          Loaded in this container
                        </p>
                        {Array.isArray(c.cargoLines) && (c.cargoLines as unknown[]).length > 0 ? (
                          <ul className="mt-1.5 space-y-1.5">
                            {(c.cargoLines as unknown[]).map((row) => {
                              const cl = row as Record<string, unknown>;
                              return (
                                <li
                                  key={String(cl.id)}
                                  className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-800"
                                >
                                  <span>
                                    Line {String(cl.lineNo)} — {String(cl.description)} ·{" "}
                                    <span className="font-medium tabular-nums">{String(cl.quantity)}</span>
                                    {cl.notes != null && String(cl.notes) ? (
                                      <span className="text-zinc-500"> ({String(cl.notes)})</span>
                                    ) : null}
                                  </span>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      className="shrink-0 rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-800"
                                      onClick={async () => {
                                        if (!window.confirm("Remove this line from the container?")) return;
                                        try {
                                          await postAction({
                                            action: "delete_ct_container_cargo_line",
                                            cargoLineId: String(cl.id),
                                          });
                                        } catch (err) {
                                          window.alert(err instanceof Error ? err.message : "Failed");
                                        }
                                      }}
                                    >
                                      Remove
                                    </button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[11px] text-zinc-500">No shipment lines linked yet.</p>
                        )}
                        {canEdit ? (
                          <form
                            className="mt-2 flex flex-wrap items-end gap-2 border-t border-sky-100/80 pt-2"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const fd = new FormData(e.currentTarget);
                              const sid = String(fd.get("shipmentItemId") || "");
                              const q = String(fd.get("quantity") || "").trim();
                              if (!sid || !q) return;
                              try {
                                await postAction({
                                  action: "upsert_ct_container_cargo_line",
                                  containerId: String(c.id),
                                  shipmentItemId: sid,
                                  quantity: q,
                                  notes: String(fd.get("notes") || "") || null,
                                });
                                (e.target as HTMLFormElement).reset();
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            <select
                              name="shipmentItemId"
                              required
                              className="max-w-[min(100%,260px)] rounded border px-2 py-1 text-[11px]"
                            >
                              <option value="">Shipment line…</option>
                              {lines.map((lr) => {
                                const ln = lr as Record<string, unknown>;
                                const lid = String(ln.id);
                                const cap = Number(String(ln.quantityShipped));
                                const usedAll = stuffedQtyByShipmentItemId.get(lid) ?? 0;
                                const cargoRows = ((c.cargoLines as unknown[]) ?? []) as Array<
                                  Record<string, unknown>
                                >;
                                const rowHere = cargoRows.find((x) => String(x.shipmentItemId) === lid);
                                const inThis = rowHere ? Number(String(rowHere.quantity)) : 0;
                                const maxHere = Number.isFinite(cap)
                                  ? Math.max(0, cap - usedAll + (Number.isFinite(inThis) ? inThis : 0))
                                  : 0;
                                return (
                                  <option key={lid} value={lid}>
                                    Line {String(ln.lineNo)} — {String(ln.description).slice(0, 40)}
                                    {String(ln.description).length > 40 ? "…" : ""} (max {maxHere} in this
                                    container)
                                  </option>
                                );
                              })}
                            </select>
                            <input
                              name="quantity"
                              type="number"
                              min={0}
                              step="0.001"
                              required
                              placeholder="Qty"
                              className="w-24 rounded border px-2 py-1 text-[11px] tabular-nums"
                            />
                            <input
                              name="notes"
                              placeholder="Notes (optional)"
                              className="min-w-[120px] flex-1 rounded border px-2 py-1 text-[11px]"
                            />
                            <button
                              type="submit"
                              className="rounded bg-sky-900 px-2 py-1 text-[11px] text-white"
                            >
                              Add / update
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {canEdit ? (
                        <form
                          className="mt-2 flex flex-wrap items-end gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const legRaw = String(fd.get("legId") ?? "");
                            try {
                              await postAction({
                                action: "update_ct_container",
                                containerId: String(c.id),
                                legId: legRaw === "" ? null : legRaw,
                                containerNumber: String(fd.get("containerNumber") || "").trim() || undefined,
                                containerType: String(fd.get("containerType") || "") || null,
                                status: String(fd.get("status") || "") || null,
                                seal: String(fd.get("seal") || "") || null,
                                gateInAt: String(fd.get("gateInAt") || "") || null,
                                gateOutAt: String(fd.get("gateOutAt") || "") || null,
                              });
                            } catch (err) {
                              window.alert(err instanceof Error ? err.message : "Failed");
                            }
                          }}
                        >
                          <input
                            name="containerNumber"
                            defaultValue={String(c.containerNumber)}
                            className="w-32 rounded border px-1 py-0.5"
                          />
                          <input
                            name="containerType"
                            defaultValue={String(c.containerType || "")}
                            placeholder="Type"
                            className="w-24 rounded border px-1 py-0.5"
                          />
                          <input
                            name="status"
                            defaultValue={String(c.status || "")}
                            placeholder="Status"
                            className="w-24 rounded border px-1 py-0.5"
                          />
                          <input
                            name="seal"
                            defaultValue={String(c.seal || "")}
                            placeholder="Seal"
                            className="w-24 rounded border px-1 py-0.5"
                          />
                          <select
                            name="legId"
                            defaultValue={c.legId ? String(c.legId) : ""}
                            className="rounded border px-1 py-0.5"
                          >
                            <option value="">No leg</option>
                            {legs.map((lr) => {
                              const lg = lr as Record<string, unknown>;
                              return (
                                <option key={String(lg.id)} value={String(lg.id)}>
                                  Leg {String(lg.legNo)}
                                </option>
                              );
                            })}
                          </select>
                          <input
                            name="gateInAt"
                            type="datetime-local"
                            defaultValue={asLocalDateTime(c.gateInAt)}
                            className="rounded border px-1 py-0.5"
                          />
                          <input
                            name="gateOutAt"
                            type="datetime-local"
                            defaultValue={asLocalDateTime(c.gateOutAt)}
                            className="rounded border px-1 py-0.5"
                          />
                          <button type="submit" className="rounded bg-zinc-800 px-2 py-0.5 text-white">
                            Update
                          </button>
                          <button
                            type="button"
                            className="rounded border border-zinc-300 px-2 py-0.5"
                            onClick={async () => {
                              try {
                                await postAction({
                                  action: "update_ct_container",
                                  containerId: String(c.id),
                                  gateInAt: new Date().toISOString(),
                                });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            Gate in now
                          </button>
                          <button
                            type="button"
                            className="rounded border border-zinc-300 px-2 py-0.5"
                            onClick={async () => {
                              try {
                                await postAction({
                                  action: "update_ct_container",
                                  containerId: String(c.id),
                                  gateOutAt: new Date().toISOString(),
                                });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            Gate out now
                          </button>
                          <button
                            type="button"
                            className="rounded border border-zinc-300 px-2 py-0.5"
                            onClick={async () => {
                              try {
                                await postAction({
                                  action: "update_ct_container",
                                  containerId: String(c.id),
                                  gateInAt: null,
                                });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            Clear gate-in
                          </button>
                          <button
                            type="button"
                            className="rounded border border-zinc-300 px-2 py-0.5"
                            onClick={async () => {
                              try {
                                await postAction({
                                  action: "update_ct_container",
                                  containerId: String(c.id),
                                  gateOutAt: null,
                                });
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed");
                              }
                            }}
                          >
                            Clear gate-out
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const num = String(fd.get("containerNumber") || "").trim();
                  if (!num) return;
                  const legId = String(fd.get("legId") || "").trim();
                  try {
                    await postAction({
                      action: "create_ct_container",
                      shipmentId,
                      containerNumber: num,
                      legId: legId || null,
                      containerType: String(fd.get("containerType") || "") || null,
                      status: String(fd.get("status") || "") || null,
                      seal: String(fd.get("seal") || "") || null,
                    });
                    (e.target as HTMLFormElement).reset();
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                <input name="containerNumber" placeholder="Container # *" className="rounded border px-2 py-1" />
                <input name="containerType" placeholder="Type" className="rounded border px-2 py-1" />
                <input name="status" placeholder="Status" className="rounded border px-2 py-1" />
                <input name="seal" placeholder="Seal" className="rounded border px-2 py-1" />
                <select name="legId" className="rounded border px-2 py-1">
                  <option value="">Leg (optional)</option>
                  {legs.map((lr) => {
                    const lg = lr as Record<string, unknown>;
                    return (
                      <option key={String(lg.id)} value={String(lg.id)}>
                        Leg {String(lg.legNo)}
                      </option>
                    );
                  })}
                </select>
                <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                  Add container
                </button>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "milestones" ? (
        <div className="space-y-4">
          <p className="text-xs text-zinc-600">
            Milestone template packs follow{" "}
            <span className="font-mono text-zinc-800">docs/controltower/control_tower_milestone_template_catalog</span>.
            Planned dates anchor to booking ETD/ETA (or shipment created) and skip rows when the anchor is missing.
            Packs match the shipment transport mode (from the shipment or booking). Apply is only available before any
            control-tower tracking milestones exist — use{" "}
            <Link className="text-sky-800 underline" href="/control-tower/shipments/new">
              New logistics shipment
            </Link>{" "}
            to set mode and optional template at create time.
          </p>
          {!restricted && canEdit && !canApplyMilestonePack ? (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              Template packs are disabled once this shipment has tracking milestones. Add or edit milestones manually,
              or keep using workflow milestones below.
            </p>
          ) : null}
          {!restricted && canEdit && canApplyMilestonePack && !transportModeForMilestonePacks ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Set transport mode on the shipment or booking to see mode-specific template packs.
            </p>
          ) : null}
          {!restricted && canEdit && canApplyMilestonePack && milestonePackCatalog.length > 0 ? (
            <section className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-sm">
              <h2 className="font-semibold text-sky-950">Apply milestone pack</h2>
              <p className="mt-1 text-xs text-sky-900">
                Creates tracking milestones that are not already on this shipment (never overwrites an existing code).
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {milestonePackCatalog.map((pack) => (
                  <div key={pack.id} className="rounded border border-sky-200 bg-white p-3 text-xs text-zinc-800">
                    <p className="font-semibold text-zinc-900">{pack.title}</p>
                    <p className="mt-1 text-zinc-600">{pack.description}</p>
                    <p className="mt-1 text-zinc-500">{pack.milestoneCount} milestones</p>
                    <button
                      type="button"
                      className="mt-2 rounded bg-sky-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-800"
                      onClick={async () => {
                        if (!window.confirm(`Apply “${pack.title}” to this shipment?`)) return;
                        try {
                          const json = await postAction({
                            action: "apply_ct_milestone_pack",
                            shipmentId,
                            packId: pack.id,
                          });
                          window.alert(
                            `Applied: ${Number(json.created ?? 0)} created, ${Number(json.skipped ?? 0)} skipped (existing or missing anchor).`,
                          );
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : "Failed");
                        }
                      }}
                    >
                      Apply {pack.id.replace(/_/g, " ").toLowerCase()}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">Workflow milestones</h2>
            <ul className="mt-2 space-y-2 text-xs">
              {milestones.map((m) => {
                const row = m as Record<string, unknown>;
                return (
                  <li key={String(row.id)} className="border-b border-zinc-100 pb-2">
                    <span className="font-medium">{String(row.code)}</span> · src {String(row.source)} · act{" "}
                    {row.actualAt ? new Date(row.actualAt as string).toLocaleString() : "—"}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">Control tower tracking milestones</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Label</th>
                    <th className="py-2 pr-3 font-medium">Planned</th>
                    <th className="py-2 pr-3 font-medium">Predicted</th>
                    <th className="py-2 pr-3 font-medium">Actual</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {ctMilestones.map((m) => {
                    const row = m as Record<string, unknown>;
                    return (
                      <tr key={String(row.id)} className="border-b border-zinc-100 text-zinc-800">
                        <td className="py-2 pr-3 font-mono">{String(row.code)}</td>
                        <td className="py-2 pr-3">{row.label ? String(row.label) : "—"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {row.plannedAt ? new Date(row.plannedAt as string).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {row.predictedAt ? new Date(row.predictedAt as string).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {row.actualAt ? new Date(row.actualAt as string).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {String(row.sourceType)}
                          {row.sourceRef ? (
                            <span className="text-zinc-500"> · {String(row.sourceRef)}</span>
                          ) : null}
                        </td>
                        <td className="py-2 whitespace-nowrap text-zinc-500">
                          {row.updatedByName ? String(row.updatedByName) : "—"} ·{" "}
                          {row.updatedAt ? new Date(row.updatedAt as string).toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEdit ? (
              <form
                className="mt-3 grid gap-2 text-xs md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const code = String(fd.get("code") || "").trim();
                  if (!code) return;
                  try {
                    await postAction({
                      action: "upsert_ct_tracking_milestone",
                      shipmentId,
                      code,
                      label: String(fd.get("label") || "") || null,
                      plannedAt: String(fd.get("plannedAt") || "") || null,
                      actualAt: String(fd.get("actualAt") || "") || null,
                      sourceType: String(fd.get("sourceType") || "MANUAL"),
                      notes: String(fd.get("notes") || "") || null,
                    });
                    (e.target as HTMLFormElement).reset();
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                <input name="code" placeholder="Code *" className="rounded border px-2 py-1" required />
                <input name="label" placeholder="Label" className="rounded border px-2 py-1" />
                <input name="plannedAt" type="datetime-local" className="rounded border px-2 py-1" />
                <input name="actualAt" type="datetime-local" className="rounded border px-2 py-1" />
                <input name="sourceType" placeholder="MANUAL" className="rounded border px-2 py-1" />
                <input name="notes" placeholder="Notes" className="rounded border px-2 py-1 md:col-span-2" />
                <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white md:col-span-2">
                  Add / update by code
                </button>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "documents" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <p className="text-xs text-zinc-600">
            Files live in object storage (or local <code className="text-[11px]">public/uploads</code> in
            development); this screen only stores metadata and links. Integrations (e.g. CargoWise) can register
            documents via API; otherwise use upload below.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {documents.map((d) => {
              const row = d as Record<string, unknown>;
              const src = String(row.source || "UPLOAD");
              const prov = row.integrationProvider != null ? String(row.integrationProvider) : "";
              const extRef = row.externalRef != null ? String(row.externalRef) : "";
              return (
                <li key={String(row.id)} className="border-b border-zinc-100 pb-2">
                  <a
                    href={String(row.blobUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-800 hover:underline"
                  >
                    {String(row.fileName)}
                  </a>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    <span className="font-medium text-zinc-800">
                      {String(row.docTypeLabel || row.docType)}
                    </span>
                    {String(row.docType) !== String(row.docTypeLabel) ? (
                      <span className="text-zinc-400"> ({String(row.docType)})</span>
                    ) : null}
                    {" · "}
                    {String(row.visibility)}
                    {" · "}
                    <span
                      className={
                        src === "INTEGRATION"
                          ? "text-violet-800"
                          : "text-zinc-700"
                      }
                    >
                      {src === "INTEGRATION" ? "Integration" : "Upload"}
                    </span>
                    {prov ? <span className="text-zinc-500"> · {prov}</span> : null}
                    {extRef ? (
                      <span className="text-zinc-400" title={extRef}>
                        {" "}
                        · ref {extRef.length > 40 ? `${extRef.slice(0, 40)}…` : extRef}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <form
              className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const file = fd.get("file");
                if (!(file instanceof File) || !file.size) return;
                try {
                  const up = new FormData();
                  up.set("shipmentId", shipmentId);
                  up.set("docType", String(fd.get("docType") || "OTHER"));
                  up.set("visibility", String(fd.get("visibility") || "INTERNAL"));
                  up.set("file", file);
                  const res = await fetch("/api/control-tower/documents/upload", {
                    method: "POST",
                    body: up,
                  });
                  if (!res.ok) {
                    const j = (await res.json()) as { error?: string };
                    throw new Error(j.error || "Upload failed");
                  }
                  form.reset();
                  await load();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <input type="file" name="file" accept=".pdf,image/*" required className="text-xs" />
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-zinc-500">Document type</span>
                  <select name="docType" className="min-w-[200px] rounded border px-2 py-1" required>
                    {Array.from(new Set(CT_SHIPMENT_DOCUMENT_TYPES.map((t) => t.group))).map((group) => (
                      <optgroup key={group} label={group}>
                        {CT_SHIPMENT_DOCUMENT_TYPES.filter((t) => t.group === group).map((t) => (
                          <option key={t.code} value={t.code}>
                            {t.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-zinc-500">Visibility</span>
                  <select name="visibility" className="rounded border px-2 py-1">
                    <option value="INTERNAL">Internal</option>
                    <option value="CUSTOMER_SHAREABLE">Customer shareable</option>
                  </select>
                </label>
                <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                  Upload
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === "notes" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <ul className="space-y-3 text-xs">
            {collaborationNotes.map((n) => {
              const row = n as Record<string, unknown>;
              return (
                <li key={String(row.id)} className="border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">{String(row.createdByName)} ·</span>{" "}
                  <span className="text-zinc-500">{new Date(row.createdAt as string).toLocaleString()}</span>
                  <p className="mt-1 text-zinc-800">{String(row.body)}</p>
                  <span className="text-zinc-400">({String(row.visibility)})</span>
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <form
              className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const body = String(fd.get("body") || "").trim();
                if (!body) return;
                try {
                  await postAction({
                    action: "create_ct_note",
                    shipmentId,
                    body,
                    visibility: fd.get("visibility") === "SHARED" ? "SHARED" : "INTERNAL",
                  });
                  (e.target as HTMLFormElement).reset();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <textarea name="body" rows={3} className="w-full rounded border px-2 py-1" placeholder="Note" />
              <select name="visibility" className="rounded border px-2 py-1" defaultValue={restricted ? "SHARED" : "INTERNAL"}>
                {restricted ? (
                  <option value="SHARED">Shared with customer</option>
                ) : (
                  <>
                    <option value="INTERNAL">Internal</option>
                    <option value="SHARED">Shared with customer</option>
                  </>
                )}
              </select>
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                Post note
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === "commercial" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          {financial ? (
            <dl className="space-y-1 text-xs text-zinc-700">
              {Object.entries(financial).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-zinc-500">{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-zinc-500">No financial snapshot yet.</p>
          )}
          {costing ? (
            <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase text-zinc-700">Cost lines (multi-currency)</p>
              <p className="mt-1 text-sm text-zinc-800">
                Total ({costing.displayCurrency}):{" "}
                <span className="font-semibold">
                  {formatMoney(costing.convertedTotal)} {costing.displayCurrency}
                </span>
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Original totals:{" "}
                {Object.entries(costing.totalOriginalByCurrency)
                  .map(([cur, val]) => `${formatMoney(val)} ${cur}`)
                  .join(" · ") || "—"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                FX dates used:{" "}
                {costing.fxDates.length > 0
                  ? costing.fxDates.map((d) => new Date(d).toLocaleDateString()).join(", ")
                  : "same currency only"}
              </p>
              {costing.missingConversionCount > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  {costing.missingConversionCount} line(s) missing FX conversion to {costing.displayCurrency}.
                </p>
              ) : null}
              <ul className="mt-3 space-y-1 text-xs text-zinc-700">
                {costing.lines.map((line) => (
                  <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-2 py-1">
                    <span className="min-w-0 truncate">
                      {line.category}
                      {line.description ? ` · ${line.description}` : ""}
                      {line.vendor ? ` · ${line.vendor}` : ""}
                      {line.invoiceNo ? ` · inv ${line.invoiceNo}` : ""}
                    </span>
                    <span className="font-medium">
                      {formatMoney(line.amount)} {line.currency}
                      {" → "}
                      {line.convertedAmount != null
                        ? `${formatMoney(line.convertedAmount)} ${line.convertedCurrency}`
                        : "no FX"}
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="rounded border border-red-200 px-2 py-0.5 text-red-700"
                        onClick={async () => {
                          if (!window.confirm("Delete this cost line?")) return;
                          try {
                            await postAction({ action: "delete_ct_cost_line", costLineId: line.id });
                          } catch (err) {
                            window.alert(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canEdit ? (
            <form
              className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 text-xs md:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const num = (name: string) => {
                  const v = String(fd.get(name) || "").trim();
                  return v === "" ? null : Number(v);
                };
                try {
                  await postAction({
                    action: "create_ct_financial_snapshot",
                    shipmentId,
                    customerVisibleCost: num("customerVisibleCost"),
                    internalCost: num("internalCost"),
                    internalRevenue: num("internalRevenue"),
                    internalNet: num("internalNet"),
                    internalMarginPct: num("internalMarginPct"),
                  });
                  (e.target as HTMLFormElement).reset();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <input name="customerVisibleCost" placeholder="Customer cost" className="rounded border px-2 py-1" />
              <input name="internalCost" placeholder="Internal cost" className="rounded border px-2 py-1" />
              <input name="internalRevenue" placeholder="Internal revenue" className="rounded border px-2 py-1" />
              <input name="internalNet" placeholder="Internal net" className="rounded border px-2 py-1" />
              <input name="internalMarginPct" placeholder="Margin %" className="rounded border px-2 py-1" />
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white md:col-span-2">
                Record snapshot
              </button>
            </form>
          ) : null}
          {canEdit ? (
            <form
              className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 text-xs md:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await postAction({
                    action: "add_ct_cost_line",
                    shipmentId,
                    category: String(fd.get("category") || "").trim(),
                    description: String(fd.get("description") || "").trim() || null,
                    vendor: String(fd.get("vendor") || "").trim() || null,
                    invoiceNo: String(fd.get("invoiceNo") || "").trim() || null,
                    invoiceDate: String(fd.get("invoiceDate") || "") || null,
                    currency: String(fd.get("currency") || "USD"),
                    amount: Number(String(fd.get("amount") || "0").replace(",", ".")),
                  });
                  (e.target as HTMLFormElement).reset();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <input name="category" placeholder="Category *" className="rounded border px-2 py-1" required />
              <input name="description" placeholder="Description" className="rounded border px-2 py-1" />
              <input name="vendor" placeholder="Vendor" className="rounded border px-2 py-1" />
              <input name="invoiceNo" placeholder="Invoice #" className="rounded border px-2 py-1" />
              <input name="invoiceDate" type="date" className="rounded border px-2 py-1" />
              <input name="currency" placeholder="Currency (EUR)" defaultValue="EUR" className="rounded border px-2 py-1" />
              <input name="amount" placeholder="Amount (e.g. 1200,50)" className="rounded border px-2 py-1" required />
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white md:col-span-3">
                Add cost line
              </button>
            </form>
          ) : null}
          {canEdit ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await postAction({
                    action: "set_ct_display_currency",
                    currency: String(fd.get("displayCurrency") || "USD"),
                  });
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-zinc-500">Display currency</span>
                <input
                  name="displayCurrency"
                  defaultValue={costing?.displayCurrency || "USD"}
                  className="rounded border px-2 py-1"
                />
              </label>
              <button type="submit" className="rounded border border-zinc-300 px-3 py-1">
                Save display currency
              </button>
            </form>
          ) : null}
          {canEdit ? (
            <form
              className="mt-3 grid gap-2 border-t border-zinc-100 pt-3 text-xs md:grid-cols-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await postAction({
                    action: "upsert_ct_fx_rate",
                    baseCurrency: String(fd.get("baseCurrency") || ""),
                    quoteCurrency: String(fd.get("quoteCurrency") || ""),
                    rate: Number(String(fd.get("rate") || "0").replace(",", ".")),
                    rateDate: String(fd.get("rateDate") || ""),
                    provider: String(fd.get("provider") || "").trim() || null,
                  });
                  (e.target as HTMLFormElement).reset();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <input name="baseCurrency" placeholder="Base (USD)" className="rounded border px-2 py-1" required />
              <input name="quoteCurrency" placeholder="Quote (EUR)" className="rounded border px-2 py-1" required />
              <input name="rate" placeholder="Rate (0,92)" className="rounded border px-2 py-1" required />
              <input name="rateDate" type="date" className="rounded border px-2 py-1" required />
              <input name="provider" placeholder="Provider" className="rounded border px-2 py-1" />
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white md:col-span-5">
                Save FX rate
              </button>
            </form>
          ) : null}
          {costing && costing.availableFxRates.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-zinc-600">
              {costing.availableFxRates.map((r) => (
                <li key={r.id}>
                  {r.baseCurrency}/{r.quoteCurrency} {formatMoney(r.rate)} · {new Date(r.rateDate).toLocaleDateString()}
                  {r.provider ? ` · ${r.provider}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tab === "alerts" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <ul className="space-y-2 text-xs">
            {alerts.map((a) => {
              const row = a as Record<string, unknown>;
              const sla = ctSlaState(String(row.createdAt ?? ""), String(row.severity || "WARN"));
              return (
                <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-50 pb-2">
                  <div>
                    <span className="font-medium">{String(row.title)}</span> · {String(row.severity)} ·{" "}
                    {String(row.status)}
                    <span
                      className={`ml-2 rounded-full border px-2 py-0.5 ${
                        sla.breached
                          ? "border-red-200 bg-red-50 text-red-800"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      age {sla.ageHours}h / SLA {sla.threshold}h
                    </span>
                    {row.body ? <p className="text-zinc-600">{String(row.body)}</p> : null}
                    {row.status === "ACKNOWLEDGED" && row.acknowledgedAt ? (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Acknowledged{" "}
                        {row.acknowledgedByName ? `by ${String(row.acknowledgedByName)} ` : null}
                        {new Date(String(row.acknowledgedAt)).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        defaultValue={row.owner ? String((row.owner as { id: string }).id) : ""}
                        className="rounded border border-zinc-300 px-1 py-0.5"
                        onChange={async (e) => {
                          try {
                            await postAction({
                              action: "assign_ct_alert_owner",
                              alertId: String(row.id),
                              ownerUserId: e.target.value || null,
                            });
                          } catch (err) {
                            window.alert(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        <option value="">Owner: none</option>
                        {assigneeChoices.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      {row.status === "OPEN" ? (
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-0.5"
                          onClick={async () => {
                            try {
                              await postAction({ action: "acknowledge_ct_alert", alertId: String(row.id) });
                            } catch (err) {
                              window.alert(err instanceof Error ? err.message : "Failed");
                            }
                          }}
                        >
                          Ack
                        </button>
                      ) : null}
                      {row.status !== "CLOSED" ? (
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-0.5"
                          onClick={async () => {
                            try {
                              await postAction({ action: "close_ct_alert", alertId: String(row.id) });
                            } catch (err) {
                              window.alert(err instanceof Error ? err.message : "Failed");
                            }
                          }}
                        >
                          Close
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-zinc-300 px-2 py-0.5"
                          onClick={async () => {
                            try {
                              await postAction({ action: "reopen_ct_alert", alertId: String(row.id) });
                            } catch (err) {
                              window.alert(err instanceof Error ? err.message : "Failed");
                            }
                          }}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <form
              className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const title = String(fd.get("title") || "").trim();
                if (!title) return;
                try {
                  await postAction({
                    action: "create_ct_alert",
                    shipmentId,
                    title,
                    type: String(fd.get("type") || "MANUAL"),
                    severity: String(fd.get("severity") || "WARN"),
                    body: String(fd.get("body") || "") || null,
                  });
                  (e.target as HTMLFormElement).reset();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <input name="title" placeholder="Title *" className="w-full rounded border px-2 py-1" />
              <input name="type" placeholder="Type" className="rounded border px-2 py-1" />
              <select name="severity" className="rounded border px-2 py-1">
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
              <textarea name="body" placeholder="Body" className="w-full rounded border px-2 py-1" rows={2} />
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                Create alert
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === "exceptions" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <ul className="space-y-2 text-xs">
            {exceptions.map((x) => {
              const row = x as Record<string, unknown>;
              const sla = ctSlaState(String(row.createdAt ?? ""), String(row.severity || "WARN"));
              return (
                <li key={String(row.id)} className="border-b border-zinc-50 pb-2">
                  <span className="font-medium">{String(row.typeLabel || row.type)}</span>
                  {String(row.typeLabel) !== String(row.type) ? (
                    <span className="font-mono text-[10px] text-zinc-400"> ({String(row.type)})</span>
                  ) : null}
                  {" · "}
                  {String(row.status)} · {String(row.severity)}
                  <span
                    className={`ml-2 rounded-full border px-2 py-0.5 ${
                      sla.breached
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    age {sla.ageHours}h / SLA {sla.threshold}h
                  </span>
                  {row.rootCause ? <p className="text-zinc-600">{String(row.rootCause)}</p> : null}
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        defaultValue={row.owner ? String((row.owner as { id: string }).id) : ""}
                        className="rounded border border-zinc-200 px-2 py-0.5 text-xs"
                        onChange={async (e) => {
                          try {
                            await postAction({
                              action: "assign_ct_exception_owner",
                              exceptionId: String(row.id),
                              ownerUserId: e.target.value || null,
                            });
                          } catch (err) {
                            window.alert(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        <option value="">Owner: none</option>
                        {assigneeChoices.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-zinc-600">
                        Status
                        <select
                          key={`${String(row.id)}-${String(row.status)}`}
                          defaultValue={String(row.status)}
                          className="rounded border border-zinc-300 px-2 py-1"
                          onChange={async (e) => {
                            const st = e.target.value;
                            if (!st || st === String(row.status)) return;
                            try {
                              await postAction({
                                action: "update_ct_exception",
                                exceptionId: String(row.id),
                                status: st,
                              });
                            } catch (err) {
                              window.alert(err instanceof Error ? err.message : "Failed");
                            }
                          }}
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <form
              className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const sevRaw = String(fd.get("severity") || "").trim();
                const rootCause = String(fd.get("rootCause") || "").trim() || null;
                try {
                  if (exceptionCodeCatalog.length > 0) {
                    const code = String(fd.get("exceptionCode") || "").trim();
                    if (!code) return;
                    await postAction({
                      action: "create_ct_exception",
                      shipmentId,
                      exceptionCode: code,
                      ...(sevRaw === "INFO" || sevRaw === "WARN" || sevRaw === "CRITICAL"
                        ? { severity: sevRaw }
                        : {}),
                      ...(rootCause ? { rootCause } : {}),
                    });
                  } else {
                    const type = String(fd.get("type") || "").trim();
                    if (!type) return;
                    await postAction({
                      action: "create_ct_exception",
                      shipmentId,
                      type,
                      severity:
                        sevRaw === "INFO" || sevRaw === "WARN" || sevRaw === "CRITICAL" ? sevRaw : "WARN",
                      ...(rootCause ? { rootCause } : {}),
                    });
                  }
                  (e.target as HTMLFormElement).reset();
                  await load();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              {exceptionCodeCatalog.length > 0 ? (
                <label className="flex max-w-md flex-col gap-0.5">
                  <span className="text-[11px] text-zinc-500">Exception type</span>
                  <select name="exceptionCode" required className="rounded border px-2 py-1">
                    <option value="">Select code…</option>
                    {exceptionCodeCatalog.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label} ({c.code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input name="type" placeholder="Exception type *" className="max-w-md rounded border px-2 py-1" />
              )}
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-zinc-500">Severity</span>
                  <select name="severity" className="rounded border px-2 py-1">
                    <option value="">Default (from code)</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </label>
                <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                  Log exception
                </button>
              </div>
              <textarea
                name="rootCause"
                placeholder="Root cause / notes (optional)"
                rows={2}
                className="max-w-xl rounded border px-2 py-1"
              />
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          {auditTrail.length === 0 ? (
            <p className="text-xs text-zinc-500">No audit entries (customer view hides audit).</p>
          ) : (
            <ul className="space-y-2 font-mono text-[11px] text-zinc-700">
              {auditTrail.map((a) => {
                const row = a as Record<string, unknown>;
                return (
                  <li key={String(row.id)}>
                    {new Date(row.createdAt as string).toISOString()} · {String(row.actorName)} ·{" "}
                    {String(row.action)} · {String(row.entityType)} · {String(row.entityId).slice(0, 8)}…
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
