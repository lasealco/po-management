import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  controlTowerShipmentAccessWhere,
  getControlTowerPortalContext,
  type ControlTowerPortalContext,
} from "@/lib/control-tower/viewer";
import { getPurchaseOrderScopeWhere } from "@/lib/org-scope";
import {
  coordinatesFromCityCountry,
  coordinatesFromLaneCode,
  greatCircleInterpolate,
  inferCoordinatesFromLabel,
  jitterLatLng,
  routeProgress,
} from "@/lib/product-trace-geo";

export type ProductTracePoLine = {
  orderId: string;
  orderNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierAddressSummary: string | null;
  lineNo: number;
  quantityOrdered: string;
  uom: string | null;
  requestedDeliveryDate: string | null;
  statusLabel: string;
};

export type ProductTraceShipment = {
  shipmentId: string;
  shipmentNo: string | null;
  status: string;
  quantityShipped: string;
  quantityReceived: string;
  orderNumber: string;
  shippedAt: string | null;
  transportMode: string | null;
  booking: {
    eta: string | null;
    etd: string | null;
    latestEta: string | null;
    originCode: string | null;
    destinationCode: string | null;
    mode: string | null;
  } | null;
  containers: Array<{
    containerNumber: string;
    status: string | null;
    containerType: string | null;
  }>;
  expectedReceiveAt: string | null;
};

export type ProductTraceStockRow = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string | null;
  onHandQty: string;
  allocatedQty: string;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

export type ProductTraceMapPinKind = "supplier" | "warehouse" | "in_transit";

export type ProductTraceMapPin = {
  id: string;
  kind: ProductTraceMapPinKind;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  quantityLabel: string;
  estimatedAvailabilityLabel: string;
  footnote?: string;
  shipmentId?: string;
  warehouseId?: string;
  supplierId?: string;
};

export type ProductTracePayload = {
  product: {
    id: string;
    name: string;
    sku: string | null;
    productCode: string | null;
    unit: string | null;
  };
  purchaseOrderLines: ProductTracePoLine[];
  shipments: ProductTraceShipment[];
  inventory: ProductTraceStockRow[] | null;
  inventoryOmittedReason: "no_wms_grant" | null;
  mapPins: ProductTraceMapPin[];
};

async function purchaseOrderWhereForProductTrace(
  tenantId: string,
  productId: string,
  ctx: ControlTowerPortalContext,
  actorUserId: string,
): Promise<Prisma.PurchaseOrderWhereInput> {
  const w: Prisma.PurchaseOrderWhereInput = {
    tenantId,
    items: { some: { productId } },
  };
  if (ctx.isSupplierPortal) {
    w.workflow = { supplierPortalOn: true };
  }
  if (ctx.customerCrmAccountId) {
    w.shipments = {
      some: { customerCrmAccountId: ctx.customerCrmAccountId },
    };
  }
  const orgScope = await getPurchaseOrderScopeWhere(tenantId, actorUserId, {
    isSupplierPortalUser: ctx.isSupplierPortal,
  });
  if (!orgScope) {
    return w;
  }
  return { AND: [w, orgScope] };
}

async function resolveProduct(tenantId: string, raw: string) {
  const q = raw.trim();
  if (!q) return null;
  const asCuid = /^c[a-z0-9]{24,32}$/i.test(q);
  return prisma.product.findFirst({
    where: {
      tenantId,
      OR: asCuid
        ? [
            { id: q },
            { sku: { equals: q, mode: "insensitive" } },
            { productCode: { equals: q, mode: "insensitive" } },
          ]
        : [
            { sku: { equals: q, mode: "insensitive" } },
            { productCode: { equals: q, mode: "insensitive" } },
          ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      productCode: true,
      unit: true,
    },
  });
}

function sumDecimal(
  rows: Array<{ quantityShipped: Prisma.Decimal; quantityReceived: Prisma.Decimal }>,
  field: "quantityShipped" | "quantityReceived",
): string {
  let n = 0;
  for (const r of rows) {
    n += Number(r[field]);
  }
  if (!Number.isFinite(n)) return "0";
  return String(n);
}

type SupplierGeoSelect = {
  id: string;
  name: string;
  registeredAddressLine1: string | null;
  registeredCity: string | null;
  registeredRegion: string | null;
  registeredCountryCode: string | null;
};

function supplierAddressSummary(s: SupplierGeoSelect): string {
  const cityLine = [s.registeredCity, s.registeredRegion].filter(Boolean).join(", ");
  const parts = [s.registeredAddressLine1, cityLine, s.registeredCountryCode].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : s.name;
}

function formatAvailabilityDate(d: Date | null): string {
  if (!d) return "Date TBD";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

type LineRowForMap = {
  quantity: Prisma.Decimal;
  order: {
    id: string;
    requestedDeliveryDate: Date | null;
    supplier: SupplierGeoSelect | null;
  };
};

type ShipmentRowForMap = {
  id: string;
  shipmentNo: string | null;
  status: string;
  shippedAt: Date;
  expectedReceiveAt: Date | null;
  transportMode: string | null;
  order: { orderNumber: string };
  booking: {
    eta: Date | null;
    etd: Date | null;
    latestEta: Date | null;
    originCode: string | null;
    destinationCode: string | null;
    mode: string | null;
  } | null;
  items: Array<{ quantityShipped: Prisma.Decimal; quantityReceived: Prisma.Decimal }>;
};

type InventoryWarehouseAgg = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string | null;
  onHandQty: number;
  allocatedQty: number;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

function buildProductTraceMapPins(args: {
  now: Date;
  productUnit: string | null;
  lineRows: LineRowForMap[];
  shipmentRows: ShipmentRowForMap[];
  inventoryWarehouses: InventoryWarehouseAgg[];
}): ProductTraceMapPin[] {
  const uom = args.productUnit ? ` ${args.productUnit}` : "";
  const pins: ProductTraceMapPin[] = [];

  const supplierAgg = new Map<
    string,
    {
      supplier: SupplierGeoSelect;
      qty: number;
      earliestReq: Date | null;
    }
  >();

  for (const row of args.lineRows) {
    const s = row.order.supplier;
    if (!s) continue;
    const prev = supplierAgg.get(s.id);
    const q = Number(row.quantity);
    const req = row.order.requestedDeliveryDate;
    if (!prev) {
      supplierAgg.set(s.id, {
        supplier: s,
        qty: Number.isFinite(q) ? q : 0,
        earliestReq: req,
      });
    } else {
      prev.qty += Number.isFinite(q) ? q : 0;
      if (req && (!prev.earliestReq || req < prev.earliestReq)) prev.earliestReq = req;
    }
  }

  for (const [supplierId, agg] of supplierAgg) {
    const s = agg.supplier;
    const coords =
      coordinatesFromCityCountry(
        s.registeredCity,
        s.registeredRegion,
        s.registeredCountryCode,
      ) ?? inferCoordinatesFromLabel(s.name) ?? inferCoordinatesFromLabel(s.registeredAddressLine1);
    if (!coords) continue;
    const j = jitterLatLng(coords.lat, coords.lng, pins.length, supplierId);
    pins.push({
      id: `supplier:${supplierId}`,
      kind: "supplier",
      lat: j.lat,
      lng: j.lng,
      title: s.name,
      subtitle: supplierAddressSummary(s),
      quantityLabel: `${agg.qty}${uom} on open / visible PO lines`,
      estimatedAvailabilityLabel: formatAvailabilityDate(agg.earliestReq),
      footnote: "Supplier position is from registered address (geocoding API can refine).",
      supplierId,
    });
  }

  for (const wh of args.inventoryWarehouses) {
    const coords =
      coordinatesFromCityCountry(wh.city, wh.region, wh.countryCode) ??
      inferCoordinatesFromLabel(wh.warehouseName) ??
      inferCoordinatesFromLabel(wh.addressLine1);
    if (!coords) continue;
    const j = jitterLatLng(coords.lat, coords.lng, pins.length, wh.warehouseId);
    const addr = [wh.addressLine1, [wh.city, wh.region].filter(Boolean).join(", "), wh.countryCode]
      .filter(Boolean)
      .join(" · ");
    pins.push({
      id: `warehouse:${wh.warehouseId}`,
      kind: "warehouse",
      lat: j.lat,
      lng: j.lng,
      title: wh.warehouseName,
      subtitle: addr || "Warehouse",
      quantityLabel: `${wh.onHandQty}${uom} on hand`,
      estimatedAvailabilityLabel:
        wh.onHandQty > wh.allocatedQty ? "Available now (unallocated on hand)" : "Mostly allocated — check WMS",
      footnote: "Coordinates are estimated from warehouse city/country until lat/lng are stored.",
      warehouseId: wh.warehouseId,
    });
  }

  args.shipmentRows.forEach((s, idx) => {
    const oCode = s.booking?.originCode ?? null;
    const dCode = s.booking?.destinationCode ?? null;
    const o = coordinatesFromLaneCode(oCode);
    const d = coordinatesFromLaneCode(dCode);
    if (!o || !d) return;

    const mode = (s.booking?.mode ?? s.transportMode ?? "OCEAN").toString().toUpperCase();
    const atDestination = s.status === "DELIVERED" || s.status === "RECEIVED";
    const atOriginBooking = s.status === "BOOKING_DRAFT" || s.status === "BOOKING_SUBMITTED";

    const etd = s.booking?.etd ?? s.shippedAt;
    const eta = s.booking?.latestEta ?? s.booking?.eta ?? s.expectedReceiveAt;
    const etdMs = etd ? etd.getTime() : null;
    const etaMs = eta ? eta.getTime() : null;
    const frac = atDestination
      ? 1
      : atOriginBooking
        ? 0
        : routeProgress(args.now.getTime(), etdMs, etaMs);

    const pos = greatCircleInterpolate(o.lat, o.lng, d.lat, d.lng, frac);
    const j = jitterLatLng(pos.lat, pos.lng, pins.length + idx, s.id);
    const qty = sumDecimal(s.items, "quantityShipped");
    const lane = oCode && dCode ? `${oCode} → ${dCode}` : "Lane";
    const etaLabel = formatAvailabilityDate(eta ?? null);

    pins.push({
      id: `shipment:${s.id}`,
      kind: "in_transit",
      lat: j.lat,
      lng: j.lng,
      title: s.shipmentNo ?? `Shipment ${s.id.slice(0, 8)}`,
      subtitle: `${lane} · ${mode}${atDestination ? " · arrived" : ""}`,
      quantityLabel: `${qty}${uom} on this shipment`,
      estimatedAvailabilityLabel: atDestination ? `Delivered / received target ${etaLabel}` : `ETA ${etaLabel}`,
      footnote:
        "Position along the lane is simulated from booking dates (AIS / carrier track planned).",
      shipmentId: s.id,
    });
  });

  return pins;
}

export async function getProductTracePayload(input: {
  tenantId: string;
  actorUserId: string;
  query: string;
  includeInventory: boolean;
}): Promise<
  | { ok: true; data: ProductTracePayload }
  | { ok: false; error: "bad_query" | "product_not_found" }
> {
  const trimmed = input.query.trim();
  if (!trimmed) return { ok: false, error: "bad_query" };

  const product = await resolveProduct(input.tenantId, trimmed);
  if (!product) return { ok: false, error: "product_not_found" };

  const ctx = await getControlTowerPortalContext(input.actorUserId);
  const [orderWhere, ctShipmentScope] = await Promise.all([
    purchaseOrderWhereForProductTrace(
      input.tenantId,
      product.id,
      ctx,
      input.actorUserId,
    ),
    controlTowerShipmentAccessWhere(
      input.tenantId,
      ctx,
      input.actorUserId,
    ),
  ]);

  const [lines, shipmentsRaw, inventoryRows] = await Promise.all([
    prisma.purchaseOrderItem.findMany({
      where: {
        productId: product.id,
        order: orderWhere,
      },
      orderBy: [{ order: { orderNumber: "desc" } }, { lineNo: "asc" }],
      select: {
        lineNo: true,
        quantity: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            requestedDeliveryDate: true,
            status: { select: { label: true } },
            supplier: {
              select: {
                id: true,
                name: true,
                registeredAddressLine1: true,
                registeredCity: true,
                registeredRegion: true,
                registeredCountryCode: true,
              },
            },
          },
        },
      },
    }),
    prisma.shipment.findMany({
      where: {
        AND: [
          ctShipmentScope,
          {
            items: {
              some: { orderItem: { productId: product.id } },
            },
          },
        ],
      },
      orderBy: { shippedAt: "desc" },
      take: 50,
      select: {
        id: true,
        shipmentNo: true,
        status: true,
        shippedAt: true,
        expectedReceiveAt: true,
        transportMode: true,
        order: { select: { orderNumber: true } },
        booking: {
          select: {
            eta: true,
            etd: true,
            latestEta: true,
            originCode: true,
            destinationCode: true,
            mode: true,
          },
        },
        ctContainers: {
          select: {
            containerNumber: true,
            status: true,
            containerType: true,
          },
          orderBy: { createdAt: "asc" },
          take: 8,
        },
        items: {
          where: { orderItem: { productId: product.id } },
          select: { quantityShipped: true, quantityReceived: true },
        },
      },
    }),
    input.includeInventory
      ? prisma.inventoryBalance.findMany({
          where: { tenantId: input.tenantId, productId: product.id },
          select: {
            onHandQty: true,
            allocatedQty: true,
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
                addressLine1: true,
                city: true,
                region: true,
                countryCode: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const purchaseOrderLines: ProductTracePoLine[] = lines.map((row) => ({
    orderId: row.order.id,
    orderNumber: row.order.orderNumber,
    supplierId: row.order.supplier?.id ?? null,
    supplierName: row.order.supplier?.name ?? null,
    supplierAddressSummary: row.order.supplier
      ? supplierAddressSummary(row.order.supplier)
      : null,
    lineNo: row.lineNo,
    quantityOrdered: row.quantity.toString(),
    uom: product.unit,
    requestedDeliveryDate: row.order.requestedDeliveryDate?.toISOString() ?? null,
    statusLabel: row.order.status.label,
  }));

  const shipments: ProductTraceShipment[] = shipmentsRaw.map((s) => ({
    shipmentId: s.id,
    shipmentNo: s.shipmentNo,
    status: s.status,
    quantityShipped: sumDecimal(s.items, "quantityShipped"),
    quantityReceived: sumDecimal(s.items, "quantityReceived"),
    orderNumber: s.order.orderNumber,
    shippedAt: s.shippedAt.toISOString(),
    transportMode: s.transportMode,
    booking: s.booking
      ? {
          eta: s.booking.eta?.toISOString() ?? null,
          etd: s.booking.etd?.toISOString() ?? null,
          latestEta: s.booking.latestEta?.toISOString() ?? null,
          originCode: s.booking.originCode,
          destinationCode: s.booking.destinationCode,
          mode: s.booking.mode,
        }
      : null,
    containers: s.ctContainers.map((c) => ({
      containerNumber: c.containerNumber,
      status: c.status,
      containerType: c.containerType,
    })),
    expectedReceiveAt: s.expectedReceiveAt?.toISOString() ?? null,
  }));

  let inventory: ProductTraceStockRow[] | null = null;
  let inventoryOmittedReason: ProductTracePayload["inventoryOmittedReason"] = null;
  const inventoryWarehouseAgg: InventoryWarehouseAgg[] = [];
  if (input.includeInventory) {
    const byWh = new Map<string, InventoryWarehouseAgg>();
    for (const row of inventoryRows) {
      const wid = row.warehouse.id;
      const cur = byWh.get(wid) ?? {
        warehouseId: wid,
        warehouseName: row.warehouse.name,
        warehouseCode: row.warehouse.code,
        onHandQty: 0,
        allocatedQty: 0,
        addressLine1: row.warehouse.addressLine1,
        city: row.warehouse.city,
        region: row.warehouse.region,
        countryCode: row.warehouse.countryCode,
      };
      cur.onHandQty += Number(row.onHandQty);
      cur.allocatedQty += Number(row.allocatedQty);
      byWh.set(wid, cur);
    }
    inventory = [...byWh.values()].map((v) => ({
      warehouseId: v.warehouseId,
      warehouseName: v.warehouseName,
      warehouseCode: v.warehouseCode,
      onHandQty: String(v.onHandQty),
      allocatedQty: String(v.allocatedQty),
      addressLine1: v.addressLine1,
      city: v.city,
      region: v.region,
      countryCode: v.countryCode,
    }));
    inventoryWarehouseAgg.push(...[...byWh.values()]);
  } else {
    inventoryOmittedReason = "no_wms_grant";
  }

  const lineRowsForMap: LineRowForMap[] = lines.map((row) => ({
    quantity: row.quantity,
    order: {
      id: row.order.id,
      requestedDeliveryDate: row.order.requestedDeliveryDate,
      supplier: row.order.supplier,
    },
  }));

  const shipmentRowsForMap: ShipmentRowForMap[] = shipmentsRaw.map((s) => ({
    id: s.id,
    shipmentNo: s.shipmentNo,
    status: s.status,
    shippedAt: s.shippedAt,
    expectedReceiveAt: s.expectedReceiveAt,
    transportMode: s.transportMode,
    order: s.order,
    booking: s.booking,
    items: s.items,
  }));

  const mapPins = buildProductTraceMapPins({
    now: new Date(),
    productUnit: product.unit,
    lineRows: lineRowsForMap,
    shipmentRows: shipmentRowsForMap,
    inventoryWarehouses: inventoryWarehouseAgg,
  });

  return {
    ok: true,
    data: {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        productCode: product.productCode,
        unit: product.unit,
      },
      purchaseOrderLines,
      shipments,
      inventory,
      inventoryOmittedReason,
      mapPins,
    },
  };
}
