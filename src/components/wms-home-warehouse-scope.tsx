"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type WmsHomeWarehouseOption = { id: string; code: string | null; name: string };

export function WmsHomeWarehouseScope({
  warehouses,
  scopedWarehouseId,
}: {
  warehouses: WmsHomeWarehouseOption[];
  scopedWarehouseId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (warehouses.length === 0) return null;

  const value = scopedWarehouseId ?? "";

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <label className="text-xs font-semibold text-zinc-600" htmlFor="wms-home-wh-scope">
        Warehouse scope
      </label>
      <select
        id="wms-home-wh-scope"
        className="max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(searchParams.toString());
          const id = e.target.value;
          if (id) next.set("wh", id);
          else next.delete("wh");
          const qs = next.toString();
          router.push(qs ? `/wms?${qs}` : "/wms");
        }}
      >
        <option value="">All warehouses</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.code ?? w.name ?? w.id}
            {w.code && w.name && w.code !== w.name ? ` — ${w.name}` : ""}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-500">
        Tiles and most executive KPIs respect scope; receiving pipeline stays tenant-wide.
      </p>
    </div>
  );
}
