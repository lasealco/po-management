"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { LocationCodePicker } from "@/components/location-code-picker";
import { SearchableSelectField } from "@/components/searchable-select-field";
import { WorkflowHeader } from "@/components/workflow-header";

type SupplierOption = {
  id: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  registeredAddressLine1: string | null;
  registeredCity: string | null;
  registeredRegion: string | null;
  registeredPostalCode: string | null;
  registeredCountryCode: string | null;
  paymentTermsDays: number | null;
  paymentTermsLabel: string | null;
  defaultIncoterm: string | null;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }>;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  productCode: string | null;
  unit: string | null;
  supplierIds: string[];
};

type WarehouseOption = {
  id: string;
  code: string | null;
  name: string;
  type: "CFS" | "WAREHOUSE";
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

type ForwarderOption = {
  id: string;
  name: string;
  code: string | null;
  offices: Array<{
    id: string;
    name: string;
    addressLine1: string | null;
    city: string | null;
    region: string | null;
    countryCode: string | null;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }>;
};

type LineDraft = {
  productId: string;
  quantity: string;
  unitPrice: string;
};

export function OrderCreateForm({
  buyerUser,
  canSendDirect,
  suppliers,
  warehouses,
  forwarders,
  products,
}: {
  buyerUser: { id: string; name: string; email: string };
  canSendDirect: boolean;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  forwarders: ForwarderOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const supplierOptions = suppliers;
  const [productOptions, setProductOptions] = useState(products);
  const warehouseOptions = warehouses;
  const forwarderOptions = forwarders;
  const [buyerWarehouseId, setBuyerWarehouseId] = useState(
    warehouses.find((w) => w.type === "WAREHOUSE")?.id ?? "",
  );
  const [cfsWarehouseId, setCfsWarehouseId] = useState(
    warehouses.find((w) => w.type === "CFS")?.id ?? "",
  );
  const [forwarderSupplierId, setForwarderSupplierId] = useState(forwarders[0]?.id ?? "");
  const [forwarderOfficeId, setForwarderOfficeId] = useState("");
  const [forwarderContactId, setForwarderContactId] = useState("");
  const [useAlternateDelivery, setUseAlternateDelivery] = useState(false);
  const [alternateDeliveryWarehouseId, setAlternateDeliveryWarehouseId] = useState("");
  const [transportMode, setTransportMode] = useState<"OCEAN" | "AIR" | "ROAD" | "RAIL">("OCEAN");
  const [originCode, setOriginCode] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [shipToName, setShipToName] = useState("");
  const [shipToLine1, setShipToLine1] = useState("");
  const [shipToLine2, setShipToLine2] = useState("");
  const [shipToCity, setShipToCity] = useState("");
  const [shipToRegion, setShipToRegion] = useState("");
  const [shipToPostalCode, setShipToPostalCode] = useState("");
  const [shipToCountryCode, setShipToCountryCode] = useState("");
  const [notesToSupplier, setNotesToSupplier] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    suppliers[0]?.paymentTermsDays != null ? String(suppliers[0].paymentTermsDays) : "",
  );
  const [paymentTermsLabel, setPaymentTermsLabel] = useState(
    suppliers[0]?.paymentTermsLabel ?? "",
  );
  const [incoterm, setIncoterm] = useState(suppliers[0]?.defaultIncoterm ?? "");
  const [taxPercent, setTaxPercent] = useState("8");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [newWarehouseOpen, setNewWarehouseOpen] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseCode, setNewWarehouseCode] = useState("");
  const [newWarehouseType, setNewWarehouseType] = useState<"CFS" | "WAREHOUSE">("WAREHOUSE");
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductCode, setNewProductCode] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("");
  const [submitMode, setSubmitMode] = useState<"draft" | "send">("draft");
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: "", quantity: "1", unitPrice: "0" },
  ]);

  const supplier = useMemo(
    () => supplierOptions.find((s) => s.id === supplierId) ?? null,
    [supplierId, supplierOptions],
  );
  const availableProducts = useMemo(
    () => productOptions.filter((p) => p.supplierIds.includes(supplierId)),
    [productOptions, supplierId],
  );
  const forwarderSupplier = useMemo(
    () => forwarderOptions.find((f) => f.id === forwarderSupplierId) ?? null,
    [forwarderOptions, forwarderSupplierId],
  );
  const supplierSearchOptions = useMemo(
    () =>
      supplierOptions.map((s) => ({
        value: s.id,
        label: `${s.code ? `${s.code} · ` : ""}${s.name}`,
      })),
    [supplierOptions],
  );
  const warehouseSearchOptions = useMemo(
    () =>
      warehouseOptions
        .filter((w) => w.type === "WAREHOUSE")
        .map((w) => ({
          value: w.id,
          label: `${w.code ? `${w.code} · ` : ""}${w.name}${w.city ? ` · ${w.city}` : ""}`,
        })),
    [warehouseOptions],
  );
  const cfsSearchOptions = useMemo(
    () =>
      warehouseOptions
        .filter((w) => w.type === "CFS")
        .map((w) => ({
          value: w.id,
          label: `${w.code ? `${w.code} · ` : ""}${w.name}`,
        })),
    [warehouseOptions],
  );
  const forwarderOptionsSearch = useMemo(
    () =>
      forwarderOptions.map((f) => ({
        value: f.id,
        label: `${f.code ? `${f.code} · ` : ""}${f.name}`,
      })),
    [forwarderOptions],
  );
  const forwarderOfficeOptions = useMemo(
    () =>
      (forwarderSupplier?.offices ?? []).map((o) => ({
        value: o.id,
        label: `${o.name}${o.addressLine1 ? ` · ${o.addressLine1}` : ""}${o.city ? ` · ${o.city}` : ""}`,
      })),
    [forwarderSupplier],
  );
  const forwarderContactOptions = useMemo(
    () =>
      (forwarderSupplier?.contacts ?? []).map((c) => ({
        value: c.id,
        label: `${c.name}${c.email ? ` · ${c.email}` : ""}${c.phone ? ` · ${c.phone}` : ""}`,
      })),
    [forwarderSupplier],
  );
  const alternateAddressOptions = warehouseSearchOptions;
  const availableProductOptions = useMemo(
    () =>
      availableProducts.map((p) => ({
        value: p.id,
        label: `${p.productCode || p.sku || "—"} · ${p.name}${p.unit ? ` (${p.unit})` : ""}`,
      })),
    [availableProducts],
  );
  const alternateDeliveryWarehouse = useMemo(
    () =>
      warehouseOptions.find(
        (w) => w.id === alternateDeliveryWarehouseId && w.type === "WAREHOUSE",
      ) ?? null,
    [alternateDeliveryWarehouseId, warehouseOptions],
  );
  const buyerWarehouse = useMemo(
    () => warehouseOptions.find((w) => w.id === buyerWarehouseId && w.type === "WAREHOUSE") ?? null,
    [buyerWarehouseId, warehouseOptions],
  );
  const subtotal = useMemo(
    () =>
      lines.reduce((sum, row) => {
        const q = Number(row.quantity);
        const p = Number(row.unitPrice);
        if (!Number.isFinite(q) || !Number.isFinite(p)) return sum;
        return sum + q * p;
      }, 0),
    [lines],
  );
  const taxPctNum = Number(taxPercent);
  const discountPctNum = Number(discountPercent);
  const discountAmtNum = Number(discountAmount);
  const discountFromPct =
    Number.isFinite(discountPctNum) && discountPctNum > 0 ? (subtotal * discountPctNum) / 100 : 0;
  const discountFromAmt =
    Number.isFinite(discountAmtNum) && discountAmtNum > 0 ? discountAmtNum : 0;
  const discountTotal = Math.min(subtotal, discountFromPct + discountFromAmt);
  const taxable = Math.max(0, subtotal - discountTotal);
  const tax = taxable * (Number.isFinite(taxPctNum) ? Math.max(0, taxPctNum) / 100 : 0);
  const total = taxable + tax;

  useEffect(() => {
    if (useAlternateDelivery) return;
    startTransition(() => {
      setShipToName(buyerWarehouse?.name ?? "");
      setShipToLine1(buyerWarehouse?.addressLine1 ?? "");
      setShipToCity(buyerWarehouse?.city ?? "");
      setShipToRegion(buyerWarehouse?.region ?? "");
      setShipToCountryCode(buyerWarehouse?.countryCode ?? "");
    });
  }, [buyerWarehouse, useAlternateDelivery]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(mode: "draft" | "send") {
    if (useAlternateDelivery && !alternateDeliveryWarehouse) {
      setError("Select an alternate delivery address from master data.");
      return;
    }
    const deliveryWarehouse = useAlternateDelivery ? alternateDeliveryWarehouse : buyerWarehouse;
    if (!deliveryWarehouse) {
      setError("Select a buyer office / delivery address.");
      return;
    }
    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one line.");
      return;
    }
    const payloadLines = lines
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      }))
      .filter(
        (line) =>
          line.productId &&
          Number.isFinite(line.quantity) &&
          line.quantity > 0 &&
          Number.isFinite(line.unitPrice) &&
          line.unitPrice >= 0,
      );
    if (payloadLines.length !== lines.length) {
      setError("Each line needs product, quantity (>0), and price.");
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        buyerWarehouseId: buyerWarehouseId || null,
        cfsWarehouseId: cfsWarehouseId || null,
        deliveryWarehouseId: deliveryWarehouse.id,
        forwarderSupplierId: forwarderSupplierId || null,
        forwarderOfficeId: forwarderOfficeId || null,
        forwarderContactId: forwarderContactId || null,
        transportMode,
        originCode: originCode.trim() || null,
        destinationCode: destinationCode.trim() || null,
        tags: tagsInput
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        requestedDeliveryDate: requestedDeliveryDate || null,
        notesToSupplier,
        adminNote,
        currency: currency.trim().toUpperCase(),
        paymentTermsDays: paymentTermsDays.trim() === "" ? null : Number(paymentTermsDays),
        paymentTermsLabel: paymentTermsLabel.trim() || null,
        incoterm: incoterm.trim() || null,
        taxPercent: Number(taxPercent),
        discountPercent: Number(discountPercent),
        discountAmount: Number(discountAmount),
        items: payloadLines,
      }),
    });
    const parsed: unknown = await response.json();
    setBusy(false);
    const payload = parsed as { id?: string };
    if (!response.ok || !payload.id) {
      setError(apiClientErrorMessage(parsed, "Could not create order."));
      return;
    }
    if (mode === "send" && canSendDirect) {
      const sendRes = await fetch(`/api/orders/${payload.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionCode: "send_to_supplier" }),
      });
      if (!sendRes.ok) {
        const sendParsed: unknown = await sendRes.json();
        setError(apiClientErrorMessage(sendParsed, "Order saved but could not send."));
      }
    }
    router.push(`/orders/${payload.id}`);
  }

  async function quickCreateWarehouse() {
    if (!newWarehouseName.trim()) return;
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newWarehouseName.trim(),
        code: newWarehouseCode.trim() || null,
        type: newWarehouseType,
      }),
    });
    const parsed: unknown = await res.json();
    const payload = parsed as { id?: string };
    if (!res.ok || !payload.id) {
      setError(apiClientErrorMessage(parsed, "Could not create office/CFS."));
      return;
    }
    router.refresh();
  }

  async function quickCreateProduct() {
    if (!supplierId || !newProductCode.trim() || !newProductName.trim()) return;
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productCode: newProductCode.trim(),
        name: newProductName.trim(),
        unit: newProductUnit.trim() || null,
        supplierIds: [supplierId],
      }),
    });
    const parsed: unknown = await res.json();
    const payload = parsed as {
      product?: { id: string; name: string; productCode: string | null };
    };
    if (!res.ok || !payload.product) {
      setError(apiClientErrorMessage(parsed, "Could not create product."));
      return;
    }
    setProductOptions((prev) => [
      ...prev,
      {
        id: payload.product!.id,
        name: payload.product!.name,
        productCode: payload.product!.productCode,
        sku: null,
        unit: newProductUnit.trim() || null,
        supplierIds: [supplierId],
      },
    ]);
    setNewProductCode("");
    setNewProductName("");
    setNewProductUnit("");
    setNewProductOpen(false);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-6">
        <WorkflowHeader
          eyebrow="PO creation workflow"
          title="Create Purchase Order"
          description="Select supplier, configure delivery and terms, then save draft or send in one consistent workflow."
          steps={["Step 1: Supplier and locations", "Step 2: Line items and routing", "Step 3: Review totals and save"]}
        />
      </header>
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Supplier</span>
          <SearchableSelectField
            value={supplierId}
            onChange={(nextId) => {
              setSupplierId(nextId);
              setLines([{ productId: "", quantity: "1", unitPrice: "0" }]);
              const nextSupplier = supplierOptions.find((s) => s.id === nextId) ?? null;
              setPaymentTermsDays(
                nextSupplier?.paymentTermsDays != null
                  ? String(nextSupplier.paymentTermsDays)
                  : "",
              );
              setPaymentTermsLabel(nextSupplier?.paymentTermsLabel ?? "");
              setIncoterm(nextSupplier?.defaultIncoterm ?? "");
            }}
            options={supplierSearchOptions}
            placeholder="Type to filter supplier..."
            emptyLabel="Select supplier..."
            inputClassName="rounded-md border border-zinc-300 px-3 py-2"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Buyer office location</span>
          <SearchableSelectField
            value={buyerWarehouseId}
            onChange={setBuyerWarehouseId}
            options={warehouseSearchOptions}
            placeholder="Type to filter buyer office..."
            emptyLabel="Select buyer office"
            inputClassName="rounded-md border border-zinc-300 px-3 py-2"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">CFS location</span>
          <SearchableSelectField
            value={cfsWarehouseId}
            onChange={setCfsWarehouseId}
            options={cfsSearchOptions}
            placeholder="Type to filter CFS..."
            emptyLabel="Select CFS"
            inputClassName="rounded-md border border-zinc-300 px-3 py-2"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Requested delivery date</span>
          <input
            type="date"
            value={requestedDeliveryDate}
            onChange={(e) => setRequestedDeliveryDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Currency</span>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            list="currency-options"
            maxLength={3}
            placeholder="USD"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
          <datalist id="currency-options">
            <option value="USD" />
            <option value="EUR" />
            <option value="GBP" />
            <option value="CNY" />
            <option value="JPY" />
            <option value="HKD" />
            <option value="SGD" />
            <option value="AUD" />
            <option value="CAD" />
            <option value="CHF" />
            <option value="AED" />
            <option value="INR" />
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Terms label (editable)</span>
          <input
            value={paymentTermsLabel}
            onChange={(e) => setPaymentTermsLabel(e.target.value)}
            placeholder="Net 30"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Terms days (editable)</span>
          <input
            value={paymentTermsDays}
            onChange={(e) => setPaymentTermsDays(e.target.value)}
            type="number"
            min={0}
            placeholder="30"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Incoterm (editable)</span>
          <input
            value={incoterm}
            onChange={(e) => setIncoterm(e.target.value.toUpperCase())}
            placeholder="FOB"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setNewWarehouseOpen((v) => !v)}
            className="rounded border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700"
          >
            {newWarehouseOpen ? "Close quick add location" : "New buyer/CFS"}
          </button>
        </div>
      </section>

      <section className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
          <p className="mb-1 font-semibold text-zinc-900">Supplier details</p>
          <p>{supplier?.name ?? "—"}</p>
          <p>{supplier?.registeredAddressLine1 ?? "No street"}</p>
          <p>
            {[supplier?.registeredCity, supplier?.registeredRegion, supplier?.registeredPostalCode]
              .filter(Boolean)
              .join(", ") || "No city/region/post code"}
          </p>
          <p>{supplier?.registeredCountryCode ?? "No country"}</p>
          <p className="mt-2 font-medium">Primary contact</p>
          <p>{supplier?.contacts[0]?.name ?? "—"}</p>
          <p>{supplier?.contacts[0]?.email ?? supplier?.email ?? "No email"}</p>
          <p>{supplier?.contacts[0]?.phone ?? supplier?.phone ?? "No phone"}</p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
          <p className="mb-1 font-semibold text-zinc-900">Buyer details</p>
          <p>{buyerWarehouse?.name ?? "No buyer office selected"}</p>
          <p>{buyerWarehouse?.addressLine1 ?? "No street"}</p>
          <p>
            {[buyerWarehouse?.city, buyerWarehouse?.region].filter(Boolean).join(", ") ||
              "No city/region"}
          </p>
          <p>{buyerWarehouse?.countryCode ?? "No country"}</p>
          <p className="mt-2 font-medium">Buyer contact</p>
          <p>{buyerUser.name}</p>
          <p>{buyerUser.email}</p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
          <p className="mb-1 font-semibold text-zinc-900">Forwarder details</p>
          <p>{forwarderSupplier?.name ?? "No forwarder selected"}</p>
          <p>{forwarderSupplier?.offices.find((o) => o.id === forwarderOfficeId)?.name ?? "—"}</p>
          <p>
            {forwarderSupplier?.offices.find((o) => o.id === forwarderOfficeId)?.addressLine1 ??
              "No office street"}
          </p>
          <p>
            {[
              forwarderSupplier?.offices.find((o) => o.id === forwarderOfficeId)?.city,
              forwarderSupplier?.offices.find((o) => o.id === forwarderOfficeId)?.region,
              forwarderSupplier?.offices.find((o) => o.id === forwarderOfficeId)?.countryCode,
            ]
              .filter(Boolean)
              .join(", ") || "No office city/region/country"}
          </p>
          <p>
            {forwarderSupplier?.contacts.find((c) => c.id === forwarderContactId)?.name ??
              forwarderSupplier?.contacts[0]?.name ??
              "No contact"}
          </p>
          <p>
            {forwarderSupplier?.contacts.find((c) => c.id === forwarderContactId)?.email ??
              forwarderSupplier?.contacts[0]?.email ??
              "No email"}
          </p>
          <p>
            {forwarderSupplier?.contacts.find((c) => c.id === forwarderContactId)?.phone ??
              forwarderSupplier?.contacts[0]?.phone ??
              "No phone"}
          </p>
        </div>
      </section>

      {newWarehouseOpen ? (
        <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Quick add buyer office / CFS</h2>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              value={newWarehouseName}
              onChange={(e) => setNewWarehouseName(e.target.value)}
              placeholder="Name"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={newWarehouseCode}
              onChange={(e) => setNewWarehouseCode(e.target.value)}
              placeholder="Code (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              value={newWarehouseType}
              onChange={(e) => setNewWarehouseType(e.target.value as "CFS" | "WAREHOUSE")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="WAREHOUSE">Buyer office</option>
              <option value="CFS">CFS</option>
            </select>
            <button
              type="button"
              onClick={() => void quickCreateWarehouse()}
              className="rounded border border-arscmp-primary bg-arscmp-primary px-3 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </div>
        </section>
      ) : null}

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Forwarder</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <SearchableSelectField
            value={forwarderSupplierId}
            onChange={(next) => {
              setForwarderSupplierId(next);
              setForwarderOfficeId("");
              setForwarderContactId("");
            }}
            options={forwarderOptionsSearch}
            placeholder="Type to filter forwarder..."
            emptyLabel="Select forwarder company"
            inputClassName="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
          <SearchableSelectField
            value={forwarderOfficeId}
            onChange={setForwarderOfficeId}
            options={forwarderOfficeOptions}
            placeholder="Type to filter office..."
            emptyLabel="Forwarder office (optional)"
            inputClassName="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
          <SearchableSelectField
            value={forwarderContactId}
            onChange={setForwarderContactId}
            options={forwarderContactOptions}
            placeholder="Type to filter contact..."
            emptyLabel="Forwarder contact (optional)"
            inputClassName="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
        </div>
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          Forwarders and suppliers are managed in SRM.
          <Link href="/srm" className="ml-1 font-semibold text-[var(--arscmp-primary)] hover:underline">
            Open SRM
          </Link>
          .
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delivery address</h2>
        <label className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={useAlternateDelivery}
            onChange={(e) => {
              const checked = e.target.checked;
              setUseAlternateDelivery(checked);
              if (checked) {
                setAlternateDeliveryWarehouseId("");
                setShipToName("");
                setShipToLine1("");
                setShipToLine2("");
                setShipToCity("");
                setShipToRegion("");
                setShipToPostalCode("");
                setShipToCountryCode("");
              }
            }}
          />
          Ship to alternate delivery address (different from buyer office)
        </label>
        {useAlternateDelivery ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">Delivery address book</span>
              <SearchableSelectField
                value={alternateDeliveryWarehouseId}
                onChange={(next) => {
                  setAlternateDeliveryWarehouseId(next);
                  const selected =
                    warehouseOptions.find((w) => w.id === next && w.type === "WAREHOUSE") ?? null;
                  if (!selected) return;
                  setShipToName(selected.name);
                  setShipToLine1(selected.addressLine1 ?? "");
                  setShipToCity(selected.city ?? "");
                  setShipToRegion(selected.region ?? "");
                  setShipToCountryCode(selected.countryCode ?? "");
                }}
                options={alternateAddressOptions}
                placeholder="Type to filter saved address..."
                emptyLabel="Select saved delivery address"
                inputClassName="rounded-md border border-zinc-300 px-3 py-2"
                listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
              />
            </label>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={shipToName}
            onChange={(e) => setShipToName(e.target.value)}
            placeholder="Receiver name"
            disabled={!useAlternateDelivery}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={shipToLine1}
            onChange={(e) => setShipToLine1(e.target.value)}
            placeholder="Address line 1"
            disabled={!useAlternateDelivery}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={shipToLine2}
            onChange={(e) => setShipToLine2(e.target.value)}
            placeholder="Address line 2"
            disabled={!useAlternateDelivery}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={shipToCity}
            onChange={(e) => setShipToCity(e.target.value)}
            placeholder="City"
            disabled={!useAlternateDelivery}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={shipToRegion}
            onChange={(e) => setShipToRegion(e.target.value)}
            placeholder="Region / state"
            disabled={!useAlternateDelivery}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={shipToPostalCode}
            onChange={(e) => setShipToPostalCode(e.target.value)}
            placeholder="Postal code"
            disabled={!useAlternateDelivery}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={shipToCountryCode}
            onChange={(e) => setShipToCountryCode(e.target.value)}
            placeholder="Country code (US)"
            maxLength={2}
            disabled={!useAlternateDelivery}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Transport plan</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Mode of transport</span>
            <select
              value={transportMode}
              onChange={(e) =>
                setTransportMode(e.target.value as "OCEAN" | "AIR" | "ROAD" | "RAIL")
              }
              className="rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="OCEAN">Ocean</option>
              <option value="AIR">Air</option>
              <option value="ROAD">Road</option>
              <option value="RAIL">Rail</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
              {transportMode === "OCEAN"
                ? "Port of origin (UN/LOCODE)"
                : transportMode === "AIR"
                  ? "Airport of origin (IATA)"
                  : transportMode === "RAIL"
                    ? "Rail terminal origin"
                    : "Road origin"}
            </span>
            <LocationCodePicker
              value={originCode}
              onChange={setOriginCode}
              placeholder={
                transportMode === "OCEAN"
                  ? "CNSZX"
                  : transportMode === "AIR"
                    ? "SZX"
                    : transportMode === "RAIL"
                      ? "SZ-TML-01"
                      : "Shenzhen facility"
              }
              types={["UN_LOCODE", "PORT", "AIRPORT"]}
              emptyLabel="No origin code"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
              {transportMode === "OCEAN"
                ? "Port of destination (UN/LOCODE)"
                : transportMode === "AIR"
                  ? "Airport of destination (IATA)"
                  : transportMode === "RAIL"
                    ? "Rail terminal destination"
                    : "Road destination"}
            </span>
            <LocationCodePicker
              value={destinationCode}
              onChange={setDestinationCode}
              placeholder={
                transportMode === "OCEAN"
                  ? "NLRTM"
                  : transportMode === "AIR"
                    ? "LAX"
                    : transportMode === "RAIL"
                      ? "RTM-TML-02"
                      : "Customer DC"
              }
              types={["UN_LOCODE", "PORT", "AIRPORT"]}
              emptyLabel="No destination code"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Order lines</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewProductOpen((v) => !v)}
              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700"
            >
              {newProductOpen ? "Close quick add product" : "New product"}
            </button>
            <button
              type="button"
              onClick={() =>
                setLines((prev) => [...prev, { productId: "", quantity: "1", unitPrice: "0" }])
              }
              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800"
            >
              Add line
            </button>
          </div>
        </div>
        {newProductOpen ? (
          <div className="mb-3 grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-4">
            <input
              value={newProductCode}
              onChange={(e) => setNewProductCode(e.target.value)}
              placeholder="Product code"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="Product name"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={newProductUnit}
              onChange={(e) => setNewProductUnit(e.target.value)}
              placeholder="Unit (pcs, box...)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void quickCreateProduct()}
              className="rounded border border-arscmp-primary bg-arscmp-primary px-3 py-2 text-sm font-medium text-white"
            >
              Create product
            </button>
          </div>
        ) : null}
        {availableProducts.length === 0 ? (
          <p className="mb-2 text-xs text-amber-700">
            No products are linked to this supplier yet. Use &quot;New product&quot; to add one for this
            supplier.
          </p>
        ) : null}
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]">
              <SearchableSelectField
                value={line.productId}
                onChange={(next) => updateLine(idx, { productId: next })}
                options={availableProductOptions}
                placeholder="Type to filter product..."
                emptyLabel="Select product"
                inputClassName="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
              />
              <input
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                placeholder="Qty"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                value={line.unitPrice}
                onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                placeholder="Unit price"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                disabled={lines.length === 1}
                className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Notes</h2>
        <div className="grid gap-2">
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder='Order tags (comma separated), e.g. "blue moon special, promo"'
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <textarea
            value={notesToSupplier}
            onChange={(e) => setNotesToSupplier(e.target.value)}
            rows={2}
            placeholder="Notes visible to supplier"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
            placeholder="Internal note to admin/team"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Pricing</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Tax %</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Discount %</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Discount amount</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
        <p className="mt-2 text-sm text-zinc-700">Subtotal: {subtotal.toFixed(2)} {currency}</p>
        <p className="text-sm text-zinc-700">
          Discount: {discountTotal.toFixed(2)} {currency}
        </p>
        <p className="text-sm text-zinc-700">
          Tax ({Number.isFinite(taxPctNum) ? taxPctNum : 0}%): {tax.toFixed(2)} {currency}
        </p>
        <p className="text-sm font-semibold text-zinc-900">Total: {total.toFixed(2)} {currency}</p>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <ActionButton
          disabled={busy}
          onClick={() => {
            setSubmitMode("draft");
            void submit("draft");
          }}
        >
          {busy && submitMode === "draft" ? "Saving…" : "Save draft"}
        </ActionButton>
        {canSendDirect ? (
          <ActionButton
            variant="accent"
            disabled={busy}
            onClick={() => {
              setSubmitMode("send");
              void submit("send");
            }}
          >
            {busy && submitMode === "send" ? "Sending…" : "Save and send"}
          </ActionButton>
        ) : null}
        <ActionButton
          variant="secondary"
          onClick={() => router.push("/orders")}
        >
          Cancel
        </ActionButton>
      </div>
    </main>
  );
}

