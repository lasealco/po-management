"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [buyerOffice, setBuyerOffice] = useState("");
  const [forwarder, setForwarder] = useState("");
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
  const [newForwarderOpen, setNewForwarderOpen] = useState(false);
  const [newForwarderName, setNewForwarderName] = useState("");
  const [newForwarderCode, setNewForwarderCode] = useState("");
  const [newForwarderOfficeName, setNewForwarderOfficeName] = useState("");
  const [newForwarderContactName, setNewForwarderContactName] = useState("");
  const [newForwarderContactEmail, setNewForwarderContactEmail] = useState("");
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
    setShipToName(buyerWarehouse?.name ?? "");
    setShipToLine1(buyerWarehouse?.addressLine1 ?? "");
    setShipToCity(buyerWarehouse?.city ?? "");
    setShipToRegion(buyerWarehouse?.region ?? "");
    setShipToCountryCode(buyerWarehouse?.countryCode ?? "");
  }, [buyerWarehouse, useAlternateDelivery]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(mode: "draft" | "send") {
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
        forwarderSupplierId: forwarderSupplierId || null,
        forwarderOfficeId: forwarderOfficeId || null,
        forwarderContactId: forwarderContactId || null,
        buyerOffice,
        forwarder,
        transportMode,
        originCode: originCode.trim() || null,
        destinationCode: destinationCode.trim() || null,
        tags: tagsInput
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        requestedDeliveryDate: requestedDeliveryDate || null,
        deliveryAddress: {
          name: useAlternateDelivery
            ? alternateDeliveryWarehouse?.name || shipToName
            : shipToName,
          line1: useAlternateDelivery
            ? alternateDeliveryWarehouse?.addressLine1 || shipToLine1
            : shipToLine1,
          line2: shipToLine2,
          city: useAlternateDelivery
            ? alternateDeliveryWarehouse?.city || shipToCity
            : shipToCity,
          region: useAlternateDelivery
            ? alternateDeliveryWarehouse?.region || shipToRegion
            : shipToRegion,
          postalCode: shipToPostalCode,
          countryCode: useAlternateDelivery
            ? alternateDeliveryWarehouse?.countryCode || shipToCountryCode
            : shipToCountryCode,
        },
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
    const payload = (await response.json()) as { id?: string; error?: string };
    setBusy(false);
    if (!response.ok || !payload.id) {
      setError(payload.error ?? "Could not create order.");
      return;
    }
    if (mode === "send" && canSendDirect) {
      const sendRes = await fetch(`/api/orders/${payload.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionCode: "send_to_supplier" }),
      });
      if (!sendRes.ok) {
        const sendPayload = (await sendRes.json()) as { error?: string };
        setError(sendPayload.error ?? "Order saved but could not send.");
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
    const payload = (await res.json()) as { id?: string; error?: string };
    if (!res.ok || !payload.id) {
      setError(payload.error ?? "Could not create office/CFS.");
      return;
    }
    router.refresh();
  }

  async function quickCreateForwarder() {
    if (!newForwarderName.trim()) return;
    const createSupplier = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newForwarderName.trim(),
        code: newForwarderCode.trim() || null,
      }),
    });
    const supPayload = (await createSupplier.json()) as {
      supplier?: { id: string; name: string; code: string | null };
      error?: string;
    };
    if (!createSupplier.ok || !supPayload.supplier) {
      setError(supPayload.error ?? "Could not create forwarder.");
      return;
    }
    const supplierId = supPayload.supplier.id;
    if (newForwarderOfficeName.trim()) {
      await fetch(`/api/suppliers/${supplierId}/offices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newForwarderOfficeName.trim() }),
      });
    }
    if (newForwarderContactName.trim()) {
      await fetch(`/api/suppliers/${supplierId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForwarderContactName.trim(),
          email: newForwarderContactEmail.trim() || null,
          role: "Forwarding",
          isPrimary: true,
        }),
      });
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
    const payload = (await res.json()) as {
      product?: { id: string; name: string; productCode: string | null };
      error?: string;
    };
    if (!res.ok || !payload.product) {
      setError(payload.error ?? "Could not create product.");
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
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-zinc-900">Create Purchase Order</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Select supplier, add eligible products, and save draft order.
        </p>
      </header>
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Supplier</span>
          <select
            value={supplierId}
            onChange={(e) => {
              const nextId = e.target.value;
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
            className="rounded-md border border-zinc-300 px-3 py-2"
          >
            {supplierOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} · ` : ""}
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Buyer office location</span>
          <select
            value={buyerWarehouseId}
            onChange={(e) => setBuyerWarehouseId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Select buyer office</option>
            {warehouseOptions
              .filter((w) => w.type === "WAREHOUSE")
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code ? `${w.code} · ` : ""}
                  {w.name}
                  {w.city ? ` · ${w.city}` : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">CFS location</span>
          <select
            value={cfsWarehouseId}
            onChange={(e) => setCfsWarehouseId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Select CFS</option>
            {warehouseOptions
              .filter((w) => w.type === "CFS")
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code ? `${w.code} · ` : ""}
                  {w.name}
                </option>
              ))}
          </select>
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
              className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </div>
        </section>
      ) : null}

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Forwarder</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={forwarderSupplierId}
            onChange={(e) => {
              setForwarderSupplierId(e.target.value);
              setForwarderOfficeId("");
              setForwarderContactId("");
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select forwarder company</option>
            {forwarderOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code ? `${f.code} · ` : ""}
                {f.name}
              </option>
            ))}
          </select>
          <select
            value={forwarderOfficeId}
            onChange={(e) => setForwarderOfficeId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Forwarder office (optional)</option>
            {(forwarderSupplier?.offices ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.addressLine1 ? ` · ${o.addressLine1}` : ""}
                {o.city ? ` · ${o.city}` : ""}
              </option>
            ))}
          </select>
          <select
            value={forwarderContactId}
            onChange={(e) => setForwarderContactId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Forwarder contact (optional)</option>
            {(forwarderSupplier?.contacts ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.email ? ` · ${c.email}` : ""}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
          <input
            value={forwarder}
            onChange={(e) => setForwarder(e.target.value)}
            placeholder="Free-text forwarder note (optional)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-3"
          />
          <input
            value={buyerOffice}
            onChange={(e) => setBuyerOffice(e.target.value)}
            placeholder="Buyer office free-text note (optional)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-3"
          />
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setNewForwarderOpen((v) => !v)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            {newForwarderOpen ? "Close quick add forwarder" : "New forwarder"}
          </button>
        </div>
      </section>

      {newForwarderOpen ? (
        <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Quick add forwarder</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={newForwarderName}
              onChange={(e) => setNewForwarderName(e.target.value)}
              placeholder="Forwarder company"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={newForwarderCode}
              onChange={(e) => setNewForwarderCode(e.target.value)}
              placeholder="Code (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={newForwarderOfficeName}
              onChange={(e) => setNewForwarderOfficeName(e.target.value)}
              placeholder="Office name (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={newForwarderContactName}
              onChange={(e) => setNewForwarderContactName(e.target.value)}
              placeholder="Primary contact name (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={newForwarderContactEmail}
              onChange={(e) => setNewForwarderContactEmail(e.target.value)}
              placeholder="Primary contact email (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void quickCreateForwarder()}
              className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </div>
        </section>
      ) : null}

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
              <select
                value={alternateDeliveryWarehouseId}
                onChange={(e) => {
                  const next = e.target.value;
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
                className="rounded-md border border-zinc-300 px-3 py-2"
              >
                <option value="">Select saved delivery address</option>
                {warehouseOptions
                  .filter((w) => w.type === "WAREHOUSE")
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.city ? ` · ${w.city}` : ""}
                    </option>
                  ))}
              </select>
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
            <input
              value={originCode}
              onChange={(e) => setOriginCode(e.target.value)}
              placeholder={
                transportMode === "OCEAN"
                  ? "CNSZX"
                  : transportMode === "AIR"
                    ? "SZX"
                    : transportMode === "RAIL"
                      ? "SZ-TML-01"
                      : "Shenzhen facility"
              }
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
            <input
              value={destinationCode}
              onChange={(e) => setDestinationCode(e.target.value)}
              placeholder={
                transportMode === "OCEAN"
                  ? "NLRTM"
                  : transportMode === "AIR"
                    ? "LAX"
                    : transportMode === "RAIL"
                      ? "RTM-TML-02"
                      : "Customer DC"
              }
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
              className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Create product
            </button>
          </div>
        ) : null}
        {availableProducts.length === 0 ? (
          <p className="mb-2 text-xs text-amber-700">
            No products are linked to this supplier yet. Use "New product" to add one for this
            supplier.
          </p>
        ) : null}
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]">
              <select
                value={line.productId}
                onChange={(e) => updateLine(idx, { productId: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Select product</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productCode || p.sku || "—"} · {p.name}
                    {p.unit ? ` (${p.unit})` : ""}
                  </option>
                ))}
              </select>
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSubmitMode("draft");
            void submit("draft");
          }}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && submitMode === "draft" ? "Saving…" : "Save draft"}
        </button>
        {canSendDirect ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSubmitMode("send");
              void submit("send");
            }}
            className="rounded-md border border-emerald-700 bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy && submitMode === "send" ? "Sending…" : "Save and send"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}

