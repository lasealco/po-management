"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type LocationRow = {
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

type ForwarderRow = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  offices: Array<{
    id: string;
    name: string;
    city: string | null;
    region: string | null;
    countryCode: string | null;
    isActive: boolean;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }>;
};

export function SettingsLogisticsClient({
  initialLocations,
  initialForwarders,
}: {
  initialLocations: LocationRow[];
  initialForwarders: ForwarderRow[];
}) {
  const router = useRouter();
  const [locations] = useState(initialLocations);
  const [forwarders] = useState(initialForwarders);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newForwarderName, setNewForwarderName] = useState("");
  const [newForwarderCode, setNewForwarderCode] = useState("");
  const [newForwarderEmail, setNewForwarderEmail] = useState("");
  const [newForwarderPhone, setNewForwarderPhone] = useState("");

  const [selectedForwarderId, setSelectedForwarderId] = useState(
    initialForwarders[0]?.id ?? "",
  );
  const [officeName, setOfficeName] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeRegion, setOfficeRegion] = useState("");
  const [officeCountry, setOfficeCountry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const selectedForwarder = useMemo(
    () => forwarders.find((f) => f.id === selectedForwarderId) ?? null,
    [forwarders, selectedForwarderId],
  );

  async function createForwarder() {
    if (!newForwarderName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newForwarderName.trim(),
        code: newForwarderCode.trim() || null,
        email: newForwarderEmail.trim() || null,
        phone: newForwarderPhone.trim() || null,
      }),
    });
    const payload = (await res.json().catch(() => null)) as
      | { supplier?: { id: string }; error?: string }
      | null;
    setBusy(false);
    if (!res.ok) {
      setError(payload?.error ?? "Could not create forwarder.");
      return;
    }
    setNewForwarderName("");
    setNewForwarderCode("");
    setNewForwarderEmail("");
    setNewForwarderPhone("");
    router.refresh();
  }

  async function addOffice() {
    if (!selectedForwarderId || !officeName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/suppliers/${selectedForwarderId}/offices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: officeName.trim(),
        city: officeCity.trim() || null,
        region: officeRegion.trim() || null,
        countryCode: officeCountry.trim().toUpperCase() || null,
      }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(payload?.error ?? "Could not create office.");
      return;
    }
    setOfficeName("");
    setOfficeCity("");
    setOfficeRegion("");
    setOfficeCountry("");
    router.refresh();
  }

  async function addContact() {
    if (!selectedForwarderId || !contactName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/suppliers/${selectedForwarderId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contactName.trim(),
        role: "Forwarding",
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        isPrimary: true,
      }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(payload?.error ?? "Could not create contact.");
      return;
    }
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-base font-semibold text-zinc-900">Forwarders</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Manage forwarder companies and create office/contact records used in order planning.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <input
            value={newForwarderName}
            onChange={(e) => setNewForwarderName(e.target.value)}
            placeholder="Forwarder name"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newForwarderCode}
            onChange={(e) => setNewForwarderCode(e.target.value)}
            placeholder="Code"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newForwarderEmail}
            onChange={(e) => setNewForwarderEmail(e.target.value)}
            placeholder="Email"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newForwarderPhone}
            onChange={(e) => setNewForwarderPhone(e.target.value)}
            placeholder="Phone"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createForwarder()}
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Create forwarder
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-base font-semibold text-zinc-900">Forwarder offices & contacts</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <select
            value={selectedForwarderId}
            onChange={(e) => setSelectedForwarderId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select forwarder</option>
            {forwarders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code ? `${f.code} · ` : ""}
                {f.name}
              </option>
            ))}
          </select>
          <input
            value={officeName}
            onChange={(e) => setOfficeName(e.target.value)}
            placeholder="New office name"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={officeCity}
              onChange={(e) => setOfficeCity(e.target.value)}
              placeholder="City"
              className="rounded border border-zinc-300 px-2 py-2 text-sm"
            />
            <input
              value={officeRegion}
              onChange={(e) => setOfficeRegion(e.target.value)}
              placeholder="Region"
              className="rounded border border-zinc-300 px-2 py-2 text-sm"
            />
            <input
              value={officeCountry}
              onChange={(e) => setOfficeCountry(e.target.value)}
              placeholder="CC"
              className="rounded border border-zinc-300 px-2 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={busy || !selectedForwarderId}
            onClick={() => void addOffice()}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
          >
            Add office
          </button>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="New contact name"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Contact email"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Contact phone"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || !selectedForwarderId}
            onClick={() => void addContact()}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
          >
            Add contact
          </button>
        </div>
        {selectedForwarder ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-zinc-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Offices</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {selectedForwarder.offices.length === 0 ? (
                  <li className="text-zinc-500">No offices yet.</li>
                ) : (
                  selectedForwarder.offices.map((o) => (
                    <li key={o.id}>
                      {o.name}
                      {o.city ? ` · ${o.city}` : ""}
                      {o.countryCode ? ` · ${o.countryCode}` : ""}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-md border border-zinc-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contacts</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {selectedForwarder.contacts.length === 0 ? (
                  <li className="text-zinc-500">No contacts yet.</li>
                ) : (
                  selectedForwarder.contacts.map((c) => (
                    <li key={c.id}>
                      {c.name}
                      {c.email ? ` · ${c.email}` : ""}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-base font-semibold text-zinc-900">Location code references</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Use UN/LOCODE for ocean lanes and IATA for air lanes in orders. This list helps
          operational users copy valid references.
        </p>
        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-100">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {locations.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">{l.type}</td>
                  <td className="px-3 py-2">{l.code ?? "—"}</td>
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 text-zinc-600">
                    {[l.addressLine1, l.city, l.region, l.countryCode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

