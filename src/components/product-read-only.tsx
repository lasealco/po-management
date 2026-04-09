import type { ReactNode } from "react";

/** View-only catalog detail for users with org.products → view but not edit. */

type ReadProduct = {
  productCode: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  isActive: boolean;
  category: { name: string } | null;
  division: { name: string } | null;
  ean: string | null;
  customerName: string | null;
  primaryImageUrl: string | null;
  hsCode: string | null;
  isDangerousGoods: boolean;
  dangerousGoodsClass: string | null;
  unNumber: string | null;
  properShippingName: string | null;
  packingGroup: string | null;
  flashPoint: string | null;
  flashPointUnit: string | null;
  msdsUrl: string | null;
  isTemperatureControlled: boolean;
  temperatureRangeText: string | null;
  temperatureUnit: string | null;
  coolingType: string | null;
  packagingNotes: string | null;
  humidityRequirements: string | null;
  storageDescription: string | null;
  isForReexport: boolean;
  supplierOffice:
    | {
        name: string;
        supplier: { name: string };
      }
    | null;
  linkedSuppliers: Array<{ name: string }>;
};

function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="text-sm">
      <dt className="text-xs font-medium uppercase text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-900">{value ?? "—"}</dd>
    </div>
  );
}

export function ProductReadOnly({ product }: { product: ReadProduct }) {
  const hasDg =
    product.isDangerousGoods ||
    product.dangerousGoodsClass ||
    product.unNumber;
  const hasTemp = product.isTemperatureControlled || product.temperatureRangeText;
  const hasCompliance = hasDg || hasTemp || product.hsCode || product.isForReexport;

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Identity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Row label="Name" value={product.name} />
          <Row label="Status" value={product.isActive ? "Active" : "Inactive"} />
          <Row label="Product code" value={product.productCode} />
          <Row label="SKU" value={product.sku} />
          <Row label="Unit" value={product.unit} />
          <Row label="EAN" value={product.ean} />
          <div className="sm:col-span-2">
            <Row label="Description" value={product.description} />
          </div>
          {product.customerName ? (
            <div className="sm:col-span-2">
              <Row label="Customer name" value={product.customerName} />
            </div>
          ) : null}
        </div>
        {product.primaryImageUrl ? (
          <p className="mt-4 text-sm">
            <span className="text-xs font-medium uppercase text-zinc-500">
              Image
            </span>
            <a
              href={product.primaryImageUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-amber-800 underline"
            >
              Open link
            </a>
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Classification</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Row label="Category" value={product.category?.name} />
          <Row label="Division" value={product.division?.name} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Supply</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Row
              label="Default ship-from office"
              value={
                product.supplierOffice
                  ? `${product.supplierOffice.supplier.name} — ${product.supplierOffice.name}`
                  : "—"
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Row
              label="Linked suppliers"
              value={
                product.linkedSuppliers.length === 0
                  ? "—"
                  : product.linkedSuppliers.map((s) => s.name).join(", ")
              }
            />
          </div>
        </div>
      </section>

      {hasCompliance ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">
            Compliance &amp; logistics
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Row label="HS code" value={product.hsCode} />
            <Row
              label="For re-export"
              value={product.isForReexport ? "Yes" : "No"}
            />
            {hasDg ? (
              <>
                <Row
                  label="Dangerous goods"
                  value={product.isDangerousGoods ? "Yes" : "No"}
                />
                <Row label="DG class" value={product.dangerousGoodsClass} />
                <Row label="UN number" value={product.unNumber} />
                <Row label="Proper shipping name" value={product.properShippingName} />
                <Row label="Packing group" value={product.packingGroup} />
                <Row
                  label="Flash point"
                  value={
                    product.flashPoint
                      ? `${product.flashPoint} ${product.flashPointUnit ?? ""}`.trim()
                      : "—"
                  }
                />
                <div className="sm:col-span-2">
                  <Row label="MSDS URL" value={product.msdsUrl} />
                </div>
              </>
            ) : null}
            {hasTemp ? (
              <>
                <Row
                  label="Temperature controlled"
                  value={product.isTemperatureControlled ? "Yes" : "No"}
                />
                <Row label="Temperature range" value={product.temperatureRangeText} />
                <Row label="Temperature unit" value={product.temperatureUnit} />
                <Row label="Cooling type" value={product.coolingType} />
              </>
            ) : null}
            {product.packagingNotes ? (
              <div className="sm:col-span-2">
                <Row label="Packaging notes" value={product.packagingNotes} />
              </div>
            ) : null}
            {product.humidityRequirements ? (
              <div className="sm:col-span-2">
                <Row label="Humidity" value={product.humidityRequirements} />
              </div>
            ) : null}
            {product.storageDescription ? (
              <div className="sm:col-span-2">
                <Row label="Storage" value={product.storageDescription} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
