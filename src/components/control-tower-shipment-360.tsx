"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ctSlaState } from "@/lib/control-tower/sla-thresholds";

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

export function ControlTowerShipment360({
  shipmentId,
  canEdit,
}: {
  shipmentId: string;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<Tab>("details");
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
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const r = Boolean((data as { view?: { restricted?: boolean } }).view?.restricted);
    if (r && tab === "audit") setTab("details");
  }, [data, tab]);

  async function postAction(body: Record<string, unknown>) {
    const res = await fetch("/api/control-tower", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error || res.statusText);
    await load();
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
  const customerCrmAccount = data.customerCrmAccount as
    | { id: string; name: string; legalName: string | null }
    | null
    | undefined;

  const restricted = Boolean(
    (data as { view?: { restricted?: boolean } }).view?.restricted,
  );
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Shipment {(data.shipmentNo as string) || shipmentId.slice(0, 8)}
          </h1>
          <p className="text-sm text-zinc-600">
            Order {(order?.orderNumber as string) || "—"} · {(data.status as string) || "—"} ·{" "}
            {((data.transportMode as string) || booking?.mode || "—") as string}
          </p>
        </div>
        <Link
          href="/control-tower/workbench"
          className="text-sm font-medium text-sky-800 hover:underline"
        >
          ← Workbench
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-zinc-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? "bg-sky-100 text-sky-900" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">Shipment</h2>
            <dl className="mt-2 space-y-1 text-zinc-700">
              <div>
                <dt className="text-xs text-zinc-500">Carrier / tracking</dt>
                <dd>
                  {(data.carrier as string) || "—"} · {(data.trackingNo as string) || "—"}
                </dd>
              </div>
              {data.shipmentNotes ? (
                <div>
                  <dt className="text-xs text-zinc-500">Shipment notes</dt>
                  <dd className="text-zinc-700">{String(data.shipmentNotes)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-zinc-500">Shipped</dt>
                <dd>{data.shippedAt ? new Date(data.shippedAt as string).toLocaleString() : "—"}</dd>
              </div>
              {booking ? (
                <>
                  <div>
                    <dt className="text-xs text-zinc-500">Booking</dt>
                    <dd>
                      {(booking.bookingNo as string) || "—"} · {(booking.status as string) || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">ETD / ETA</dt>
                    <dd className="text-xs">
                      {booking.etd ? new Date(booking.etd as string).toLocaleString() : "—"} →{" "}
                      {booking.eta ? new Date(booking.eta as string).toLocaleString() : "—"}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">Parties</h2>
            <dl className="mt-2 space-y-1 text-zinc-700">
              <div>
                <dt className="text-xs text-zinc-500">Supplier</dt>
                <dd>{(order?.supplier as { name?: string } | undefined)?.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Ship to</dt>
                <dd>
                  {(order?.shipToName as string) || "—"}
                  {order?.shipToCity ? `, ${String(order.shipToCity)}` : ""}{" "}
                  {(order?.shipToCountryCode as string) || ""}
                </dd>
              </div>
            </dl>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm md:col-span-2">
            <h2 className="font-semibold text-zinc-900">Lines</h2>
            <ul className="mt-2 divide-y divide-zinc-100">
              {lines.map((line) => {
                const l = line as Record<string, unknown>;
                const p = l.product as Record<string, unknown> | null | undefined;
                return (
                  <li key={String(l.id)} className="py-2 text-xs text-zinc-700">
                    Line {String(l.lineNo)} · {String(l.description)} · qty {String(l.quantityShipped)}
                    {p ? ` · ${String(p.sku || p.productCode || "")}` : ""}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm md:col-span-2">
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
            <h2 className="font-semibold text-zinc-900">Control tower milestones</h2>
            <ul className="mt-2 space-y-2 text-xs">
              {ctMilestones.map((m) => {
                const row = m as Record<string, unknown>;
                return (
                  <li key={String(row.id)} className="border-b border-zinc-100 pb-2">
                    <span className="font-medium">{String(row.code)}</span> {row.label ? `· ${String(row.label)}` : ""}{" "}
                    · plan {row.plannedAt ? new Date(row.plannedAt as string).toLocaleDateString() : "—"} · act{" "}
                    {row.actualAt ? new Date(row.actualAt as string).toLocaleDateString() : "—"} ·{" "}
                    {String(row.sourceType)}
                  </li>
                );
              })}
            </ul>
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
          <ul className="space-y-2 text-xs">
            {documents.map((d) => {
              const row = d as Record<string, unknown>;
              return (
                <li key={String(row.id)}>
                  <a
                    href={String(row.blobUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-800 hover:underline"
                  >
                    {String(row.fileName)}
                  </a>{" "}
                  · {String(row.docType)} · {String(row.visibility)}
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
              <div className="flex flex-wrap gap-2">
                <input name="docType" placeholder="Doc type" className="rounded border px-2 py-1" />
                <select name="visibility" className="rounded border px-2 py-1">
                  <option value="INTERNAL">Internal</option>
                  <option value="CUSTOMER_SHAREABLE">Customer shareable</option>
                </select>
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
                  <span className="font-medium">{String(row.type)}</span> · {String(row.status)} ·{" "}
                  {String(row.severity)}
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
              className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const type = String(fd.get("type") || "").trim();
                if (!type) return;
                try {
                  await postAction({
                    action: "create_ct_exception",
                    shipmentId,
                    type,
                    severity: String(fd.get("severity") || "WARN"),
                  });
                  (e.target as HTMLFormElement).reset();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <input name="type" placeholder="Exception type *" className="rounded border px-2 py-1" />
              <select name="severity" className="rounded border px-2 py-1">
                <option value="WARN">WARN</option>
                <option value="INFO">INFO</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
              <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white">
                Log exception
              </button>
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
