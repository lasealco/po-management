"use client";

import { useCallback, useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  sortOrder: number;
};

type Division = {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
};

export function CatalogAdminClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [catName, setCatName] = useState("");
  const [catCode, setCatCode] = useState("");
  const [divName, setDivName] = useState("");
  const [divCode, setDivCode] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const [cRes, dRes] = await Promise.all([
      fetch("/api/product-categories", { cache: "no-store" }),
      fetch("/api/product-divisions", { cache: "no-store" }),
    ]);
    if (!cRes.ok || !dRes.ok) {
      setError("Failed to load catalog data.");
      return;
    }
    const cJson = (await cRes.json()) as { categories: Category[] };
    const dJson = (await dRes.json()) as { divisions: Division[] };
    setCategories(cJson.categories);
    setDivisions(dJson.divisions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/product-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: catName.trim(),
        code: catCode.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setBusy(false);
      setError(j.error ?? "Category create failed.");
      return;
    }
    setCatName("");
    setCatCode("");
    setBusy(false);
    await load();
  }

  async function addDivision(e: React.FormEvent) {
    e.preventDefault();
    if (!divName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/product-divisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: divName.trim(),
        code: divCode.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setBusy(false);
      setError(j.error ?? "Division create failed.");
      return;
    }
    setDivName("");
    setDivCode("");
    setBusy(false);
    await load();
  }

  async function deleteCategory(id: string) {
    if (!window.confirm("Delete category? Products will lose this classification.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/product-categories/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setError(j.error ?? "Delete failed.");
      return;
    }
    await load();
  }

  async function deleteDivision(id: string) {
    if (!window.confirm("Delete division? Products will lose this classification.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/product-divisions/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setError(j.error ?? "Delete failed.");
      return;
    }
    await load();
  }

  const f =
    "rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-900";

  return (
    <div className="space-y-12">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Product categories</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Used on product classification and filters.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Sort</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.code ?? "—"}</td>
                  <td className="px-4 py-2">{c.sortOrder}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteCategory(c.id)}
                      className="text-red-700 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={addCategory} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-zinc-700">Name</span>
            <input value={catName} onChange={(e) => setCatName(e.target.value)} className={`${f} mt-1 block w-48`} />
          </label>
          <label className="text-sm">
            <span className="text-zinc-700">Code</span>
            <input value={catCode} onChange={(e) => setCatCode(e.target.value)} className={`${f} mt-1 block w-32`} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Add category
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Divisions</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Organizational grouping for reporting.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Sort</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {divisions.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{d.code ?? "—"}</td>
                  <td className="px-4 py-2">{d.sortOrder}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteDivision(d.id)}
                      className="text-red-700 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={addDivision} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-zinc-700">Name</span>
            <input value={divName} onChange={(e) => setDivName(e.target.value)} className={`${f} mt-1 block w-48`} />
          </label>
          <label className="text-sm">
            <span className="text-zinc-700">Code</span>
            <input value={divCode} onChange={(e) => setDivCode(e.target.value)} className={`${f} mt-1 block w-32`} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Add division
          </button>
        </form>
      </section>
    </div>
  );
}
