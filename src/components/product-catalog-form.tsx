"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MAX_DESC = 2000;
const MAX_EAN = 32;

export type ProductFormOptions = {
  categories: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
  supplierOffices: { id: string; label: string }[];
  suppliers: { id: string; name: string }[];
};

export type ProductFormInitial = {
  productCode: string;
  name: string;
  description: string;
  sku: string;
  unit: string;
  categoryId: string;
  divisionId: string;
  ean: string;
  customerName: string;
  primaryImageUrl: string;
  hsCode: string;
  isDangerousGoods: boolean;
  dangerousGoodsClass: string;
  unNumber: string;
  properShippingName: string;
  packingGroup: string;
  flashPoint: string;
  flashPointUnit: string;
  msdsUrl: string;
  isTemperatureControlled: boolean;
  temperatureRangeText: string;
  temperatureUnit: string;
  coolingType: string;
  packagingNotes: string;
  humidityRequirements: string;
  storageDescription: string;
  isForReexport: boolean;
  supplierOfficeId: string;
  linkedSupplierIds: string[];
  isActive: boolean;
};

type ProductPayload =
  | { error: string }
  | { product: { id: string; name: string; productCode: string | null } };

type Props = ProductFormOptions & {
  mode: "create" | "edit";
  productId?: string;
  initial?: ProductFormInitial | null;
  onSuccess?: () => void;
};

function supplierMapFromIds(ids: string[]) {
  const m: Record<string, boolean> = {};
  for (const id of ids) m[id] = true;
  return m;
}

export function ProductCatalogForm({
  mode,
  productId,
  initial,
  categories,
  divisions,
  supplierOffices,
  suppliers,
  onSuccess,
}: Props) {
  const i = initial ?? undefined;
  const [productCode, setProductCode] = useState(i?.productCode ?? "");
  const [name, setName] = useState(i?.name ?? "");
  const [description, setDescription] = useState(i?.description ?? "");
  const [sku, setSku] = useState(i?.sku ?? "");
  const [unit, setUnit] = useState(i?.unit ?? "");
  const [categoryId, setCategoryId] = useState(i?.categoryId ?? "");
  const [divisionId, setDivisionId] = useState(i?.divisionId ?? "");
  const [ean, setEan] = useState(i?.ean ?? "");
  const [customerName, setCustomerName] = useState(i?.customerName ?? "");
  const [primaryImageUrl, setPrimaryImageUrl] = useState(
    i?.primaryImageUrl ?? "",
  );
  const [hsCode, setHsCode] = useState(i?.hsCode ?? "");
  const [isDangerousGoods, setIsDangerousGoods] = useState(
    i?.isDangerousGoods ?? false,
  );
  const [dangerousGoodsClass, setDangerousGoodsClass] = useState(
    i?.dangerousGoodsClass ?? "",
  );
  const [unNumber, setUnNumber] = useState(i?.unNumber ?? "");
  const [properShippingName, setProperShippingName] = useState(
    i?.properShippingName ?? "",
  );
  const [packingGroup, setPackingGroup] = useState(i?.packingGroup ?? "");
  const [flashPoint, setFlashPoint] = useState(i?.flashPoint ?? "");
  const [flashPointUnit, setFlashPointUnit] = useState(i?.flashPointUnit ?? "");
  const [msdsUrl, setMsdsUrl] = useState(i?.msdsUrl ?? "");
  const [isTemperatureControlled, setIsTemperatureControlled] = useState(
    i?.isTemperatureControlled ?? false,
  );
  const [temperatureRangeText, setTemperatureRangeText] = useState(
    i?.temperatureRangeText ?? "",
  );
  const [temperatureUnit, setTemperatureUnit] = useState(
    i?.temperatureUnit ?? "",
  );
  const [coolingType, setCoolingType] = useState(i?.coolingType ?? "");
  const [packagingNotes, setPackagingNotes] = useState(i?.packagingNotes ?? "");
  const [humidityRequirements, setHumidityRequirements] = useState(
    i?.humidityRequirements ?? "",
  );
  const [storageDescription, setStorageDescription] = useState(
    i?.storageDescription ?? "",
  );
  const [isForReexport, setIsForReexport] = useState(i?.isForReexport ?? false);
  const [supplierOfficeId, setSupplierOfficeId] = useState(
    i?.supplierOfficeId ?? "",
  );
  const [supplierIds, setSupplierIds] = useState<Record<string, boolean>>(() =>
    supplierMapFromIds(i?.linkedSupplierIds ?? []),
  );
  const [isActive, setIsActive] = useState(i?.isActive ?? true);
  const [openDangerous, setOpenDangerous] = useState(
    () => i?.isDangerousGoods ?? false,
  );
  const [openTemperature, setOpenTemperature] = useState(
    () => i?.isTemperatureControlled ?? false,
  );

  useEffect(() => {
    if (isDangerousGoods) setOpenDangerous(true);
  }, [isDangerousGoods]);
  useEffect(() => {
    if (isTemperatureControlled) setOpenTemperature(true);
  }, [isTemperatureControlled]);

  const router = useRouter();

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
    if (mode === "edit" && !productId) {
      setErrorMessage("Missing product id.");
      return;
    }
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
      isActive: mode === "edit" ? isActive : true,
    };

    const url =
      mode === "create" ? "/api/products" : `/api/products/${productId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as ProductPayload;

    if (!response.ok || "error" in payload) {
      setBusy(false);
      setErrorMessage(
        "error" in payload
          ? payload.error
          : mode === "create"
            ? "Failed to create product."
            : "Failed to update product.",
      );
      return;
    }

    setSuccessMessage(
      mode === "create"
        ? `Product "${payload.product.productCode ?? payload.product.name}" created.`
        : `Product "${payload.product.productCode ?? payload.product.name}" saved.`,
    );
    setBusy(false);
    onSuccess?.();

    if (mode === "create") {
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
      setIsActive(true);
    }
  }

  async function onRemove() {
    if (mode !== "edit" || !productId) return;
    if (
      !window.confirm(
        "Remove this product? If it is used on order lines it will be deactivated instead of deleted.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    const response = await fetch(`/api/products/${productId}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as {
      error?: string;
      deactivated?: boolean;
      deleted?: boolean;
    };
    if (!response.ok) {
      setBusy(false);
      setErrorMessage(payload.error ?? "Remove failed.");
      return;
    }
    router.push("/products");
    router.refresh();
  }

  const field =
    "mt-0.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-900 w-full leading-normal";
  const label = "flex flex-col gap-0.5 text-sm";

  return (
    <section className="w-full max-w-4xl">
      <h2 className="text-lg font-semibold text-zinc-900">
        {mode === "create" ? "Create product" : "Edit product"}
      </h2>
      <p className="mt-0.5 text-xs leading-snug text-zinc-600">
        Uses URL fields for files until storage is connected. Expand DG /
        temperature when needed.
      </p>

      {errorMessage ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="mt-4 space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Basic identification
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
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
                rows={2}
                className={`${field} min-h-[2.75rem]`}
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

        <fieldset className="space-y-3 border-t border-zinc-100 pt-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Classification
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
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
                rows={1}
                className={`${field} min-h-[2.25rem]`}
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

        <details
          className="rounded-md border border-zinc-200 bg-zinc-50/60 [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden"
          open={openDangerous}
          onToggle={(e) =>
            setOpenDangerous((e.target as HTMLDetailsElement).open)
          }
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100/80">
            Dangerous goods
            <span className="ml-2 font-normal normal-case text-zinc-500">
              (click to expand)
            </span>
          </summary>
          <div className="space-y-3 border-t border-zinc-200 bg-white px-3 pb-3 pt-2">
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
            <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </details>

        <details
          className="rounded-md border border-zinc-200 bg-zinc-50/60 [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden"
          open={openTemperature}
          onToggle={(e) =>
            setOpenTemperature((e.target as HTMLDetailsElement).open)
          }
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100/80">
            Temperature &amp; storage
            <span className="ml-2 font-normal normal-case text-zinc-500">
              (click to expand)
            </span>
          </summary>
          <div className="space-y-3 border-t border-zinc-200 bg-white px-3 pb-3 pt-2">
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
            <div className="grid gap-3 sm:grid-cols-2">
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
                  rows={1}
                  className={`${field} min-h-[2.25rem]`}
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
                  className={`${field} min-h-[2.75rem]`}
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
          </div>
        </details>

        <fieldset className="space-y-3 border-t border-zinc-100 pt-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
            <ul className="mt-1.5 max-h-36 overflow-y-auto flex flex-col gap-1.5 rounded-md border border-zinc-100 bg-zinc-50 p-2 text-sm">
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

        {mode === "edit" ? (
          <fieldset className="space-y-2 border-t border-zinc-100 pt-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Catalog status
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span className="text-zinc-800">Active in catalog</span>
            </label>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
          </button>
          {mode === "edit" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRemove()}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-60"
            >
              Deactivate or delete…
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
