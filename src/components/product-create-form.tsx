"use client";

import { useState } from "react";

type ProductPayload =
  | { error: string }
  | { product: { id: string; name: string; sku: string | null } };

export function ProductCreateForm() {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setBusy(true);

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, name, description, unit }),
    });

    const payload = (await response.json()) as ProductPayload;

    if (!response.ok || "error" in payload) {
      setBusy(false);
      setErrorMessage(
        "error" in payload ? payload.error : "Failed to create product.",
      );
      return;
    }

    setSuccessMessage(`Product "${payload.product.name}" created successfully.`);
    setSku("");
    setName("");
    setDescription("");
    setUnit("");
    setBusy(false);
  }

  return (
    <section className="w-full max-w-xl">
      <h2 className="text-lg font-semibold text-zinc-900">Add product</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Creates a catalog row for the demo tenant.
      </p>

      {errorMessage ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="mt-4 flex max-w-xl flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            placeholder="e.g. Titanium widget"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">SKU (optional)</span>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            placeholder="Internal code"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Unit (optional)</span>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            placeholder="ea, kg, …"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Create product"}
        </button>
      </form>
    </section>
  );
}
