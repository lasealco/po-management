type Overview = {
  generatedAt: string;
  isCustomerView: boolean;
  counts: {
    active: number;
    byStatus: Record<string, number>;
    openAlerts: number | null;
    openExceptions: number | null;
    staleShipments: number;
    arrivalsNext3Days: number;
    arrivalsNext7Days: number;
    arrivalsNext14Days: number;
    withLegs: number;
    withContainers: number;
    overdueEta: number;
    unassignedOpenAlerts: number | null;
    unassignedOpenExceptions: number | null;
  };
  staleTop: Array<{
    id: string;
    shipmentNo: string | null;
    orderNumber: string;
    status: string;
    bookingEta: string | null;
    updatedAt: string;
  }>;
};

export function ControlTowerDashboard({ overview }: { overview: Overview }) {
  const { counts, isCustomerView, staleTop } = overview;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Active pipeline</p>
        <p className="mt-1 text-2xl font-semibold text-zinc-900">{counts.active}</p>
        <p className="mt-1 text-xs text-zinc-500">Non-terminal shipment rows (shipped → in transit)</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Stale (7d+ no touch)</p>
        <p className="mt-1 text-2xl font-semibold text-amber-800">{counts.staleShipments}</p>
        <p className="mt-1 text-xs text-zinc-500">Excludes delivered / received</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Arrivals window</p>
        <p className="mt-1 text-sm text-zinc-800">
          <span className="font-semibold">{counts.arrivalsNext3Days}</span> in 3d ·{" "}
          <span className="font-semibold">{counts.arrivalsNext7Days}</span> in 7d ·{" "}
          <span className="font-semibold">{counts.arrivalsNext14Days}</span> in 14d
        </p>
        <p className="mt-1 text-xs text-zinc-500">Uses booking ETA when present</p>
      </div>
      {!isCustomerView ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Action queue</p>
          <p className="mt-1 text-sm text-zinc-800">
            <span className="font-semibold">{counts.openAlerts ?? 0}</span> open alerts ·{" "}
            <span className="font-semibold">{counts.openExceptions ?? 0}</span> open exceptions
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-sky-800">Customer view</p>
          <p className="mt-1 text-sm text-sky-950">
            Alerts, exceptions detail, audit, and internal commercial fields stay hidden.
          </p>
        </div>
      )}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-4">
        <p className="text-xs font-semibold uppercase text-zinc-500">By status</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {Object.entries(counts.byStatus).map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-800"
            >
              {k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-4">
        <p className="text-xs font-semibold uppercase text-zinc-500">Route data coverage</p>
        <p className="mt-1 text-sm text-zinc-700">
          <span className="font-semibold">{counts.withLegs}</span> shipments with legs ·{" "}
          <span className="font-semibold">{counts.withContainers}</span> shipments with containers
        </p>
      </div>
      {!isCustomerView ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">Risk spotlight</p>
          <p className="mt-1 text-sm text-zinc-700">
            <span className="font-semibold text-amber-800">{counts.overdueEta}</span> overdue ETA ·{" "}
            <span className="font-semibold">{counts.unassignedOpenAlerts ?? 0}</span> unassigned alerts ·{" "}
            <span className="font-semibold">{counts.unassignedOpenExceptions ?? 0}</span> unassigned exceptions
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-4">
        <p className="text-xs font-semibold uppercase text-zinc-500">Stale spotlight</p>
        {staleTop.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">No stale shipments right now.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {staleTop.map((s) => (
              <li key={s.id}>
                <a className="font-medium text-sky-800 hover:underline" href={`/control-tower/shipments/${s.id}`}>
                  {s.shipmentNo || s.id.slice(0, 8)}
                </a>{" "}
                · {s.orderNumber} · {s.status} · updated {new Date(s.updatedAt).toLocaleDateString()}
                {s.bookingEta ? ` · ETA ${new Date(s.bookingEta).toLocaleDateString()}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
