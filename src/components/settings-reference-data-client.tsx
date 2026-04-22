"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useCallback, useEffect, useState } from "react";

import { REFERENCE_MACRO_REGIONS } from "@/lib/reference-data/macro-regions";

type Tab = "countries" | "ocean" | "airlines";

type CountryRow = {
  id: string;
  isoAlpha2: string;
  isoAlpha3: string;
  name: string;
  regionCode: string | null;
  isActive: boolean;
};

type OceanRow = { id: string; scac: string; name: string; notes: string | null; isActive: boolean };

type AirlineRow = {
  id: string;
  iataCode: string;
  icaoCode: string | null;
  awbPrefix3: string;
  name: string;
  notes: string | null;
  isActive: boolean;
};

export function SettingsReferenceDataClient({
  canEdit,
  initialCounts,
}: {
  canEdit: boolean;
  initialCounts: { countries: number; oceanCarriers: number; airlines: number };
}) {
  const [tab, setTab] = useState<Tab>("countries");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [ocean, setOcean] = useState<OceanRow[]>([]);
  const [airlines, setAirlines] = useState<AirlineRow[]>([]);

  const [newOcean, setNewOcean] = useState({ scac: "", name: "", notes: "" });
  const [newAir, setNewAir] = useState({ iataCode: "", icaoCode: "", awbPrefix3: "", name: "", notes: "" });
  const [newCountry, setNewCountry] = useState({ isoAlpha2: "", isoAlpha3: "", name: "", regionCode: "" });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set("q", debouncedQ);
    if (!activeOnly) sp.set("activeOnly", "0");
    try {
      if (tab === "countries") {
        const res = await fetch(`/api/settings/reference-countries?${sp}`);
        const data: unknown = await res.json();
        if (!res.ok) throw new Error(apiClientErrorMessage(data, res.statusText || "Load failed"));
        setCountries((data as { rows?: CountryRow[] }).rows ?? []);
      } else if (tab === "ocean") {
        const res = await fetch(`/api/settings/reference-ocean-carriers?${sp}`);
        const data: unknown = await res.json();
        if (!res.ok) throw new Error(apiClientErrorMessage(data, res.statusText || "Load failed"));
        setOcean((data as { rows?: OceanRow[] }).rows ?? []);
      } else {
        const res = await fetch(`/api/settings/reference-airlines?${sp}`);
        const data: unknown = await res.json();
        if (!res.ok) throw new Error(apiClientErrorMessage(data, res.statusText || "Load failed"));
        setAirlines((data as { rows?: AirlineRow[] }).rows ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQ, activeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchCountry = async (id: string, patch: Partial<{ regionCode: string | null; isActive: boolean; name: string }>) => {
    if (!canEdit) return;
    const res = await fetch(`/api/settings/reference-countries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      window.alert(data.error || "Update failed");
      return;
    }
    void load();
  };

  const patchOcean = async (id: string, patch: Partial<{ isActive: boolean; name: string }>) => {
    if (!canEdit) return;
    const res = await fetch(`/api/settings/reference-ocean-carriers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      window.alert(apiClientErrorMessage(data, "Update failed"));
      return;
    }
    void load();
  };

  const patchAirline = async (id: string, patch: Partial<{ isActive: boolean; name: string; awbPrefix3: string }>) => {
    if (!canEdit) return;
    const res = await fetch(`/api/settings/reference-airlines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      window.alert(apiClientErrorMessage(data, "Update failed"));
      return;
    }
    void load();
  };

  const createOcean = async () => {
    if (!canEdit) return;
    const res = await fetch("/api/settings/reference-ocean-carriers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scac: newOcean.scac,
        name: newOcean.name,
        notes: newOcean.notes || undefined,
      }),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      window.alert(apiClientErrorMessage(data, "Create failed"));
      return;
    }
    setNewOcean({ scac: "", name: "", notes: "" });
    void load();
  };

  const createAirline = async () => {
    if (!canEdit) return;
    const res = await fetch("/api/settings/reference-airlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        iataCode: newAir.iataCode,
        icaoCode: newAir.icaoCode || undefined,
        awbPrefix3: newAir.awbPrefix3,
        name: newAir.name,
        notes: newAir.notes || undefined,
      }),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      window.alert(apiClientErrorMessage(data, "Create failed"));
      return;
    }
    setNewAir({ iataCode: "", icaoCode: "", awbPrefix3: "", name: "", notes: "" });
    void load();
  };

  const createCountry = async () => {
    if (!canEdit) return;
    const res = await fetch("/api/settings/reference-countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isoAlpha2: newCountry.isoAlpha2,
        isoAlpha3: newCountry.isoAlpha3,
        name: newCountry.name,
        regionCode: newCountry.regionCode || undefined,
      }),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      window.alert(apiClientErrorMessage(data, "Create failed"));
      return;
    }
    setNewCountry({ isoAlpha2: "", isoAlpha3: "", name: "", regionCode: "" });
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">Why this exists</p>
        <p className="mt-2">
          Tariffs, RFQs, bookings, and Control Tower still store many lane and party fields as free text (for example{" "}
          <code className="rounded bg-zinc-200 px-1">originCode</code>, <code className="rounded bg-zinc-200 px-1">carrier</code>
          , <code className="rounded bg-zinc-200 px-1">countryCode</code>). This catalog gives you a single place to normalize{" "}
          <strong>ISO countries</strong>, <strong>ocean SCACs</strong>, and <strong>airline IATA + AWB prefixes</strong> before we
          wire FKs and validation into each module.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-600">
          <li>
            <strong>Tariffs / geography:</strong> align <code className="text-xs">TariffGeographyMember.memberCode</code> and
            legal-entity <code className="text-xs">countryCode</code> with ISO alpha-2 from here.
          </li>
          <li>
            <strong>Logistics:</strong> tenant <code className="text-xs">LocationCode.countryCode</code> and warehouse country
            fields should match these codes.
          </li>
          <li>
            <strong>Next steps (not done in this pass):</strong> optional FK from <code className="text-xs">ShipmentBooking</code>{" "}
            to UN/LOCODE rows; carrier SCAC on contracts; AWB validation for air milestones.
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Seeded counts — countries: {initialCounts.countries}, ocean carriers: {initialCounts.oceanCarriers}, airlines:{" "}
          {initialCounts.airlines}. Re-run <code className="rounded bg-zinc-200 px-1">npm run db:seed</code> to refresh catalog
          rows (upserts).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        {(
          [
            ["countries", `Countries (${initialCounts.countries})`],
            ["ocean", `Ocean SCACs (${initialCounts.oceanCarriers})`],
            ["airlines", `Airlines (${initialCounts.airlines})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === k ? "bg-arscmp-primary text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Search</span>
          <input
            className="mt-1 block w-64 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "countries" ? "US, Germany, DEU…" : tab === "ocean" ? "MAEU, Maersk…" : "DL, 006…"}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="rounded" />
          Active only
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Refresh
        </button>
        {loading ? <span className="text-xs text-zinc-500">Loading…</span> : null}
      </div>

      {err ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p> : null}

      {!canEdit ? (
        <p className="text-sm text-amber-900">View-only: ask for org.settings → edit to change catalog rows.</p>
      ) : null}

      {tab === "countries" && canEdit ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-900">Add territory (rare)</p>
          <p className="mt-1 text-xs text-zinc-500">Use only for codes missing from the ISO seed file.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="w-16 rounded border px-2 py-1 text-sm uppercase"
              placeholder="A2"
              maxLength={2}
              value={newCountry.isoAlpha2}
              onChange={(e) => setNewCountry((s) => ({ ...s, isoAlpha2: e.target.value.toUpperCase() }))}
            />
            <input
              className="w-20 rounded border px-2 py-1 text-sm uppercase"
              placeholder="A3"
              maxLength={3}
              value={newCountry.isoAlpha3}
              onChange={(e) => setNewCountry((s) => ({ ...s, isoAlpha3: e.target.value.toUpperCase() }))}
            />
            <input
              className="min-w-[12rem] flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Name"
              value={newCountry.name}
              onChange={(e) => setNewCountry((s) => ({ ...s, name: e.target.value }))}
            />
            <select
              className="rounded border px-2 py-1 text-sm"
              value={newCountry.regionCode}
              onChange={(e) => setNewCountry((s) => ({ ...s, regionCode: e.target.value }))}
            >
              {REFERENCE_MACRO_REGIONS.map((r) => (
                <option key={r || "none"} value={r}>
                  {r === "" ? "— region —" : r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void createCountry()}
              className="rounded-md bg-arscmp-primary px-3 py-1 text-sm font-medium text-white"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}

      {tab === "ocean" && canEdit ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-900">Add ocean carrier</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="w-24 rounded border px-2 py-1 text-sm uppercase"
              placeholder="SCAC"
              maxLength={4}
              value={newOcean.scac}
              onChange={(e) => setNewOcean((s) => ({ ...s, scac: e.target.value.toUpperCase() }))}
            />
            <input
              className="min-w-[14rem] flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Legal / marketing name"
              value={newOcean.name}
              onChange={(e) => setNewOcean((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="min-w-[10rem] flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Notes (optional)"
              value={newOcean.notes}
              onChange={(e) => setNewOcean((s) => ({ ...s, notes: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => void createOcean()}
              className="rounded-md bg-arscmp-primary px-3 py-1 text-sm font-medium text-white"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}

      {tab === "airlines" && canEdit ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-900">Add airline</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="w-14 rounded border px-2 py-1 text-sm uppercase"
              placeholder="IATA"
              maxLength={3}
              value={newAir.iataCode}
              onChange={(e) => setNewAir((s) => ({ ...s, iataCode: e.target.value.toUpperCase() }))}
            />
            <input
              className="w-16 rounded border px-2 py-1 text-sm uppercase"
              placeholder="ICAO"
              maxLength={3}
              value={newAir.icaoCode}
              onChange={(e) => setNewAir((s) => ({ ...s, icaoCode: e.target.value.toUpperCase() }))}
            />
            <input
              className="w-20 rounded border px-2 py-1 text-sm"
              placeholder="AWB"
              maxLength={3}
              value={newAir.awbPrefix3}
              onChange={(e) => setNewAir((s) => ({ ...s, awbPrefix3: e.target.value }))}
            />
            <input
              className="min-w-[12rem] flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Name"
              value={newAir.name}
              onChange={(e) => setNewAir((s) => ({ ...s, name: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => void createAirline()}
              className="rounded-md bg-arscmp-primary px-3 py-1 text-sm font-medium text-white"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        {tab === "countries" ? (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">A2</th>
                <th className="px-3 py-2">A3</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Macro region</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.isoAlpha2}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.isoAlpha3}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input
                        className="w-full min-w-[8rem] rounded border px-1 py-0.5 text-sm"
                        defaultValue={r.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.name) void patchCountry(r.id, { name: v });
                        }}
                      />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select
                        className="rounded border px-1 py-0.5 text-sm"
                        value={r.regionCode ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          void patchCountry(r.id, { regionCode: v === "" ? null : v });
                        }}
                      >
                        {REFERENCE_MACRO_REGIONS.map((code) => (
                          <option key={code || "none"} value={code}>
                            {code === "" ? "—" : code}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (r.regionCode ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      disabled={!canEdit}
                      onChange={(e) => void patchCountry(r.id, { isActive: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === "ocean" ? (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">SCAC</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {ocean.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.scac}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input
                        className="w-full min-w-[10rem] rounded border px-1 py-0.5 text-sm"
                        defaultValue={r.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.name) void patchOcean(r.id, { name: v });
                        }}
                      />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{r.notes ?? "—"}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      disabled={!canEdit}
                      onChange={(e) => void patchOcean(r.id, { isActive: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === "airlines" ? (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">IATA</th>
                <th className="px-3 py-2">ICAO</th>
                <th className="px-3 py-2">AWB prefix</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {airlines.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.iataCode}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.icaoCode ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {canEdit ? (
                      <input
                        className="w-14 rounded border px-1 py-0.5 text-sm"
                        defaultValue={r.awbPrefix3}
                        onBlur={(e) => {
                          const v = e.target.value.replace(/\D/g, "").padStart(3, "0").slice(-3);
                          if (v.length === 3 && v !== r.awbPrefix3) void patchAirline(r.id, { awbPrefix3: v });
                        }}
                      />
                    ) : (
                      r.awbPrefix3
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input
                        className="w-full min-w-[10rem] rounded border px-1 py-0.5 text-sm"
                        defaultValue={r.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.name) void patchAirline(r.id, { name: v });
                        }}
                      />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      disabled={!canEdit}
                      onChange={(e) => void patchAirline(r.id, { isActive: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
