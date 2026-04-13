"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Tab =
  | "details"
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
  const alerts = (data.alerts as unknown[]) ?? [];
  const exceptions = (data.exceptions as unknown[]) ?? [];
  const auditTrail = (data.auditTrail as unknown[]) ?? [];
  const ctReferences = (data.ctReferences as unknown[]) ?? [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: "Details & parties" },
    { id: "milestones", label: "Milestones" },
    { id: "documents", label: "Documents" },
    { id: "notes", label: "Notes" },
    { id: "commercial", label: "Commercial" },
    { id: "alerts", label: "Alerts" },
    { id: "exceptions", label: "Exceptions" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <div className="space-y-4">
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
              <select name="visibility" className="rounded border px-2 py-1">
                <option value="INTERNAL">Internal</option>
                <option value="SHARED">Shared with customer</option>
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
        </section>
      ) : null}

      {tab === "alerts" ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <ul className="space-y-2 text-xs">
            {alerts.map((a) => {
              const row = a as Record<string, unknown>;
              return (
                <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-50 pb-2">
                  <div>
                    <span className="font-medium">{String(row.title)}</span> · {String(row.severity)} ·{" "}
                    {String(row.status)}
                    {row.body ? <p className="text-zinc-600">{String(row.body)}</p> : null}
                  </div>
                  {canEdit && row.status === "OPEN" ? (
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
              return (
                <li key={String(row.id)} className="border-b border-zinc-50 pb-2">
                  <span className="font-medium">{String(row.type)}</span> · {String(row.status)} ·{" "}
                  {String(row.severity)}
                  {row.rootCause ? <p className="text-zinc-600">{String(row.rootCause)}</p> : null}
                  {canEdit ? (
                    <div className="mt-1 flex gap-1">
                      {(["IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          className="rounded border border-zinc-200 px-2 py-0.5"
                          onClick={async () => {
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
                          {st}
                        </button>
                      ))}
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
