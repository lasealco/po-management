"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierDetailSnapshot = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  offices: Array<{
    id: string;
    name: string;
    city: string | null;
    countryCode: string | null;
    isActive: boolean;
  }>;
  productLinkCount: number;
  orderCount: number;
};

export function SupplierDetailClient({
  initial,
}: {
  initial: SupplierDetailSnapshot;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [isActive, setIsActive] = useState(initial.isActive);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [officeName, setOfficeName] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeCountry, setOfficeCountry] = useState("");

  async function saveSupplier() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        code: code || null,
        email: email || null,
        phone: phone || null,
        isActive,
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Save failed.");
      return;
    }
    setBusy(false);
    router.refresh();
  }

  async function addOffice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!officeName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}/offices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: officeName.trim(),
        city: officeCity.trim() || null,
        countryCode: officeCountry.trim() || null,
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add office.");
      return;
    }
    setOfficeName("");
    setOfficeCity("");
    setOfficeCountry("");
    setBusy(false);
    router.refresh();
  }

  async function removeOffice(officeId: string) {
    if (!window.confirm("Delete this office? Products referencing it will clear the office link.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(
      `/api/suppliers/${initial.id}/offices/${officeId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string };
      setBusy(false);
      setError(payload.error ?? "Delete failed.");
      return;
    }
    setBusy(false);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900";

  return (
    <div className="space-y-10">
      <div>
        <Link href="/suppliers" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Suppliers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Manage supplier</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {initial.productLinkCount} catalog product link
          {initial.productLinkCount === 1 ? "" : "s"} · {initial.orderCount}{" "}
          purchase order
          {initial.orderCount === 1 ? "" : "s"}
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Company</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm">
            <span className="font-medium text-zinc-700">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-zinc-700">Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={f} />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-zinc-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={f}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-zinc-700">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={f} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Active supplier
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveSupplier()}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save supplier"}
        </button>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Offices &amp; sites</h2>
        <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
          {initial.offices.length === 0 ? (
            <li className="px-4 py-6 text-sm text-zinc-500">No offices yet.</li>
          ) : (
            initial.offices.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">{o.name}</p>
                  <p className="text-zinc-600">
                    {[o.city, o.countryCode].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeOffice(o.id)}
                  className="text-red-700 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={addOffice} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Add office</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col text-sm sm:col-span-1">
              <span>Name *</span>
              <input
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                className={f}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span>City</span>
              <input value={officeCity} onChange={(e) => setOfficeCity(e.target.value)} className={f} />
            </label>
            <label className="flex flex-col text-sm">
              <span>Country</span>
              <input value={officeCountry} onChange={(e) => setOfficeCountry(e.target.value)} className={f} />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            Add office
          </button>
        </form>
      </section>
    </div>
  );
}
