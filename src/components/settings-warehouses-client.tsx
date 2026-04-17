"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WarehouseRow = {
  id: string;
  code: string | null;
  name: string;
  type: "CFS" | "WAREHOUSE";
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  isActive: boolean;
};

export function SettingsWarehousesClient({ initialRows }: { initialRows: WarehouseRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createType, setCreateType] = useState<"CFS" | "WAREHOUSE">("CFS");
  const [createAddressLine1, setCreateAddressLine1] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function createRow() {
    setError(null);
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createName,
        code: createCode || null,
        type: createType,
        addressLine1: createAddressLine1 || null,
      }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(payload?.error ?? "Create failed.");
      return;
    }
    setCreateName("");
    setCreateCode("");
    setCreateAddressLine1("");
    router.refresh();
  }

  async function save(row: WarehouseRow) {
    setBusyId(row.id);
    const res = await fetch(`/api/warehouses/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusyId(null);
    if (!res.ok) {
      setError(payload?.error ?? "Save failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Create CFS / Warehouse</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Location name"
            className="h-9 rounded border border-zinc-300 px-2 text-sm"
          />
          <input
            value={createCode}
            onChange={(e) => setCreateCode(e.target.value)}
            placeholder="Code (optional)"
            className="h-9 rounded border border-zinc-300 px-2 text-sm"
          />
          <select
            value={createType}
            onChange={(e) => setCreateType(e.target.value as "CFS" | "WAREHOUSE")}
            className="h-9 rounded border border-zinc-300 px-2 text-sm"
          >
            <option value="CFS">CFS</option>
            <option value="WAREHOUSE">Warehouse</option>
          </select>
          <button
            type="button"
            onClick={() => void createRow()}
            className="h-9 rounded bg-arscmp-primary px-3 text-sm font-medium text-white"
          >
            Create
          </button>
          <input
            value={createAddressLine1}
            onChange={(e) => setCreateAddressLine1(e.target.value)}
            placeholder="Address line 1 (optional)"
            className="h-9 rounded border border-zinc-300 px-2 text-sm sm:col-span-5"
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Region</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <input
                    value={row.name}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)),
                      )
                    }
                    className="h-8 rounded border border-zinc-300 px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.code ?? ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, code: e.target.value } : r)),
                      )
                    }
                    className="h-8 rounded border border-zinc-300 px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={row.type}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, type: e.target.value as "CFS" | "WAREHOUSE" } : r,
                        ),
                      )
                    }
                    className="h-8 rounded border border-zinc-300 px-2"
                  >
                    <option value="CFS">CFS</option>
                    <option value="WAREHOUSE">Warehouse</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.addressLine1 ?? ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, addressLine1: e.target.value } : r,
                        ),
                      )
                    }
                    className="h-8 rounded border border-zinc-300 px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.city ?? ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, city: e.target.value } : r)),
                      )
                    }
                    className="h-8 rounded border border-zinc-300 px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.region ?? ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, region: e.target.value } : r)),
                      )
                    }
                    className="h-8 rounded border border-zinc-300 px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.countryCode ?? ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, countryCode: e.target.value.toUpperCase() } : r,
                        ),
                      )
                    }
                    className="h-8 w-16 rounded border border-zinc-300 px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, isActive: e.target.checked } : r)),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void save(row)}
                    disabled={busyId === row.id}
                    className="h-8 rounded border border-arscmp-primary bg-arscmp-primary px-3 text-xs text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
