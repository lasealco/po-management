"use client";

import { useState } from "react";
import type { ProductFormOptions } from "@/components/product-create-panel";

const MAX_DESC = 2000;
const MAX_EAN = 32;

type ProductPayload =
  | { error: string }
  | { product: { id: string; name: string; productCode: string | null } };

type Props = ProductFormOptions & {
  onSuccess?: () => void;
};

export function ProductCreateForm({
  categories,
  divisions,
  supplierOffices,
  suppliers,
  onSuccess,
}: Props) {
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [ean, setEan] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [primaryImageUrl, setPrimaryImageUrl] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [isDangerousGoods, setIsDangerousGoods] = useState(false);
  const [dangerousGoodsClass, setDangerousGoodsClass] = useState("");
  const [unNumber, setUnNumber] = useState("");
  const [properShippingName, setProperShippingName] = useState("");
  const [packingGroup, setPackingGroup] = useState("");
  const [flashPoint, setFlashPoint] = useState("");
  const [flashPointUnit, setFlashPointUnit] = useState("");
  const [msdsUrl, setMsdsUrl] = useState("");
  const [isTemperatureControlled, setIsTemperatureControlled] = useState(false);
  const [temperatureRangeText, setTemperatureRangeText] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState("");
  const [coolingType, setCoolingType] = useState("");
  const [packagingNotes, setPackagingNotes] = useState("");
  const [humidityRequirements, setHumidityRequirements] = useState("");
  const [storageDescription, setStorageDescription] = useState("");
  const [isForReexport, setIsForReexport] = useState(false);
  const [supplierOfficeId, setSupplierOfficeId] = useState("");
  const [supplierIds, setSupplierIds] = useState<Record<string, boolean>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleSupplier(id: string, checked: boolean) {
    setSupplierIds((prev) => ({ ...prev, [id]: checked }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setBusy(true);

    const body = {
      productCode,
      name,
      sku: sku || null,
      unit: unit || null,
      description: description || null,
      categoryId: categoryId || null,
      divisionId: divisionId || null,
      ean: ean || null,
      customerName: customerName || null,
      primaryImageUrl: primaryImageUrl || null,
      hsCode: hsCode || null,
      isDangerousGoods,
      dangerousGoodsClass: dangerousGoodsClass || null,
      unNumber: unNumber || null,
      properShippingName: properShippingName || null,
      packingGroup: packingGroup || null,
      flashPoint: flashPoint || null,
      flashPointUnit: flashPointUnit || null,
      msdsUrl: msdsUrl || null,
      isTemperatureControlled,
      temperatureRangeText: temperatureRangeText || null,
      temperatureUnit: temperatureUnit || null,
      coolingType: coolingType || null,
      packagingNotes: packagingNotes || null,
      humidityRequirements: humidityRequirements || null,
      storageDescription: storageDescription || null,
      isForReexport,
      supplierOfficeId: supplierOfficeId || null,
      supplierIds: Object.entries(supplierIds)
        .filter(([, v]) => v)
        .map(([id]) => id),
      documents: [] as const,
    };

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as ProductPayload;

    if (!response.ok || "error" in payload) {
      setBusy(false);
      setErrorMessage(
        "error" in payload ? payload.error : "Failed to create product.",
      );
      return;
    }

    setSuccessMessage(
      `Product "${payload.product.productCode ?? payload.product.name}" created.`,
    );
    setBusy(false);
    onSuccess?.();

    setProductCode("");
    setName("");
    setDescription("");
    setSku("");
    setUnit("");
    setCategoryId("");
    setDivisionId("");
    setEan("");
    setCustomerName("");
    setPrimaryImageUrl("");
    setHsCode("");
    setIsDangerousGoods(false);
    setDangerousGoodsClass("");
    setUnNumber("");
    setProperShippingName("");
    setPackingGroup("");
    setFlashPoint("");
    setFlashPointUnit("");
    setMsdsUrl("");
    setIsTemperatureControlled(false);
    setTemperatureRangeText("");
    setTemperatureUnit("");
    setCoolingType("");
    setPackagingNotes("");
    setHumidityRequirements("");
    setStorageDescription("");
    setIsForReexport(false);
    setSupplierOfficeId("");
    setSupplierIds({});
  }

  const field =
    "mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 w-full";
  const label = "flex flex-col gap-1 text-sm";

  return (
    <section className="w-full max-w-4xl">
      <h2 className="text-lg font-semibold text-zinc-900">Create product</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Modeled after the legacy catalog (codes, classification, compliance,
        temperature, suppliers). File uploads can attach URLs until blob
        storage is connected.
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
        className="mt-6 space-y-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Basic identification
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              <span className="font-medium text-zinc-700">Product code *</span>
              <input
                required
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                className={field}
                placeholder="e.g. BC-CB40"
              />
            </label>
            <label className={label}>
              <span className="font-medium text-zinc-700">Name *</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </label>
            <label className={`${label} sm:col-span-2`}>
              <span className="font-medium text-zinc-700">
                Description ({description.length}/{MAX_DESC})
              </span>
              <textarea
                value={description}
                maxLength={MAX_DESC}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={field}
              />
            </label>
            <label className={label}>
              <span className="font-medium text-zinc-700">SKU (optional)</span>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              <span className="font-medium text-zinc-700">Unit (optional)</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={field}
                placeholder="ea, kg"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Classification
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              <span className="font-medium text-zinc-700">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={field}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className="font-medium text-zinc-700">Division</span>
              <select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                className={field}
              >
                <option value="">— None —</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className="font-medium text-zinc-700">
                EAN ({ean.length}/{MAX_EAN})
              </span>
              <input
                value={ean}
                maxLength={MAX_EAN}
                onChange={(e) => setEan(e.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              <span className="font-medium text-zinc-700">HS code</span>
              <input
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
                className={field}
              />
            </label>
            <label className={`${label} sm:col-span-2`}>
              <span className="font-medium text-zinc-700">Customer name</span>
              <textarea
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                rows={2}
                className={field}
              />
            </label>
            <label className={`${label} sm:col-span-2`}>
              <span className="font-medium text-zinc-700">
                Primary image URL
              </span>
              <input
                value={primaryImageUrl}
                onChange={(e) => setPrimaryImageUrl(e.target.value)}
                className={field}
                placeholder="https://…"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Dangerous goods
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDangerousGoods}
              onChange={(e) => setIsDangerousGoods(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-zinc-800">Dangerous goods</span>
          </label>
          {isDangerousGoods ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                <span className="font-medium text-zinc-700">Class</span>
                <input
                  value={dangerousGoodsClass}
                  onChange={(e) => setDangerousGoodsClass(e.target.value)}
                  className={field}
                />
              </label>
              <label className={label}>
                <span className="font-medium text-zinc-700">Packing group</span>
                <select
                  value={packingGroup}
                  onChange={(e) => setPackingGroup(e.target.value)}
                  className={field}
                >
                  <option value="">—</option>
                  <option value="I">I</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                </select>
              </label>
              <label className={label}>
                <span className="font-medium text-zinc-700">UN number *</span>
                <input
                  value={unNumber}
                  onChange={(e) => setUnNumber(e.target.value)}
                  className={field}
                />
              </label>
              <label className={`${label} sm:col-span-2`}>
                <span className="font-medium text-zinc-700">
                  Proper shipping name *
                </span>
                <input
                  value={properShippingName}
                  onChange={(e) => setProperShippingName(e.target.value)}
                  className={field}
                />
              </label>
              <label className={label}>
                <span className="font-medium text-zinc-700">Flash point</span>
                <input
                  value={flashPoint}
                  onChange={(e) => setFlashPoint(e.target.value)}
                  className={field}
                  inputMode="decimal"
                />
              </label>
              <label className={label}>
                <span className="font-medium text-zinc-700">Flash point unit</span>
                <select
                  value={flashPointUnit}
                  onChange={(e) => setFlashPointUnit(e.target.value)}
                  className={field}
                >
                  <option value="">—</option>
                  <option value="°C">°C</option>
                  <option value="°F">°F</option>
                </select>
              </label>
              <label className={`${label} sm:col-span-2`}>
                <span className="font-medium text-zinc-700">MSDS URL</span>
                <input
                  value={msdsUrl}
                  onChange={(e) => setMsdsUrl(e.target.value)}
                  className={field}
                  placeholder="https://…"
                />
              </label>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Temperature &amp; storage
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isTemperatureControlled}
              onChange={(e) => setIsTemperatureControlled(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-zinc-800">Temperature-controlled</span>
          </label>
          {isTemperatureControlled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                <span className="font-medium text-zinc-700">
                  Temperature range *
                </span>
                <input
                  value={temperatureRangeText}
                  onChange={(e) => setTemperatureRangeText(e.target.value)}
                  className={field}
                  placeholder="e.g. 2–8"
                />
              </label>
              <label className={label}>
                <span className="font-medium text-zinc-700">Range unit *</span>
                <input
                  value={temperatureUnit}
                  onChange={(e) => setTemperatureUnit(e.target.value)}
                  className={field}
                  placeholder="°C"
                />
              </label>
              <label className={label}>
                <span className="font-medium text-zinc-700">Cooling</span>
                <input
                  value={coolingType}
                  onChange={(e) => setCoolingType(e.target.value)}
                  className={field}
                />
              </label>
              <label className={label}>
                <span className="font-medium text-zinc-700">Humidity</span>
                <input
                  value={humidityRequirements}
                  onChange={(e) => setHumidityRequirements(e.target.value)}
                  className={field}
                />
              </label>
              <label className={`${label} sm:col-span-2`}>
                <span className="font-medium text-zinc-700">Packaging</span>
                <textarea
                  value={packagingNotes}
                  onChange={(e) => setPackagingNotes(e.target.value)}
                  rows={2}
                  className={field}
                />
              </label>
              <label className={`${label} sm:col-span-2`}>
                <span className="font-medium text-zinc-700">
                  Storage description *
                </span>
                <textarea
                  value={storageDescription}
                  onChange={(e) => setStorageDescription(e.target.value)}
                  rows={2}
                  className={field}
                />
              </label>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isForReexport}
              onChange={(e) => setIsForReexport(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-zinc-800">Product is for re-export</span>
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Suppliers
          </legend>
          <label className={label}>
            <span className="font-medium text-zinc-700">Supplier office</span>
            <select
              value={supplierOfficeId}
              onChange={(e) => setSupplierOfficeId(e.target.value)}
              className={field}
            >
              <option value="">— None —</option>
              {supplierOffices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-sm font-medium text-zinc-700">
              Linked suppliers
            </p>
            <ul className="mt-2 flex flex-col gap-2 rounded-md border border-zinc-100 bg-zinc-50 p-3">
              {suppliers.length === 0 ? (
                <li className="text-sm text-zinc-500">No suppliers in tenant.</li>
              ) : (
                suppliers.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-center gap-2 text-sm text-zinc-800">
                      <input
                        type="checkbox"
                        checked={!!supplierIds[s.id]}
                        onChange={(e) =>
                          toggleSupplier(s.id, e.target.checked)
                        }
                        className="rounded border-zinc-300"
                      />
                      {s.name}
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Create product"}
        </button>
      </form>
    </section>
  );
}
