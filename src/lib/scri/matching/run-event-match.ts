import { prisma } from "@/lib/prisma";

import {
  buildGeoSignalsFromGeographies,
  normCountry,
  normUnloc,
  regionLooselyMatches,
} from "@/lib/scri/matching/geo-signals";
import { resolveShipmentCandidates } from "@/lib/scri/matching/resolve-shipment-candidates";
import { R2_MATCH_LIMITS } from "@/lib/scri/matching/run-event-match-limits";

export type MatchRow = {
  tenantId: string;
  eventId: string;
  objectType: string;
  objectId: string;
  matchType: string;
  matchConfidence: number;
  impactLevel: string | null;
  rationale: string;
};

/**
 * Replace all affected-entity rows for an event with a fresh deterministic pass (R2).
 * Uses indexed shipment candidates (UN/LOC, country), booking / legs, PO geo, suppliers,
 * warehouses, inventory balances, and linked sales orders.
 */
export async function runScriEventMatching(tenantId: string, eventId: string): Promise<number> {
  const eventRow = await prisma.scriExternalEvent.findFirst({
    where: { id: eventId, tenantId },
    include: { geographies: true },
  });
  if (!eventRow) return 0;

  const signals = buildGeoSignalsFromGeographies(eventRow.geographies);
  const hasGeo =
    signals.countries.size > 0 || signals.unlocs.size > 0 || signals.regionTerms.length > 0;
  if (!hasGeo) {
    await prisma.scriEventAffectedEntity.deleteMany({ where: { eventId } });
    return 0;
  }

  const matches: MatchRow[] = [];
  const push = (m: Omit<MatchRow, "tenantId" | "eventId">) => {
    matches.push({ tenantId, eventId, ...m });
  };

  const candidateIds = await resolveShipmentCandidates(tenantId, signals);
  const shipments =
    candidateIds.length === 0
      ? []
      : await prisma.shipment.findMany({
          where: { id: { in: candidateIds }, order: { tenantId } },
          select: {
            id: true,
            salesOrderId: true,
            booking: { select: { originCode: true, destinationCode: true } },
            order: {
              select: {
                id: true,
                shipToCountryCode: true,
                shipToRegion: true,
                supplierId: true,
                supplier: { select: { id: true, registeredCountryCode: true, name: true } },
              },
            },
          },
        });

  const byShipmentId = new Map(shipments.map((s) => [s.id, s]));
  const orderedShipments = candidateIds
    .map((id) => byShipmentId.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const legs =
    candidateIds.length === 0
      ? []
      : await prisma.ctShipmentLeg.findMany({
          where: { tenantId, shipmentId: { in: candidateIds } },
          select: { shipmentId: true, originCode: true, destinationCode: true },
        });

  const legCodesByShipment = new Map<string, Set<string>>();
  for (const leg of legs) {
    let set = legCodesByShipment.get(leg.shipmentId);
    if (!set) {
      set = new Set<string>();
      legCodesByShipment.set(leg.shipmentId, set);
    }
    const o = normUnloc(leg.originCode);
    const d = normUnloc(leg.destinationCode);
    if (o) set.add(o);
    if (d) set.add(d);
  }

  const matchedShipmentIds = new Set<string>();

  for (const s of orderedShipments) {
    const locCodes = new Set<string>();
    const bo = normUnloc(s.booking?.originCode);
    const bd = normUnloc(s.booking?.destinationCode);
    if (bo) locCodes.add(bo);
    if (bd) locCodes.add(bd);
    const legSet = legCodesByShipment.get(s.id);
    if (legSet) for (const c of legSet) locCodes.add(c);

    for (const code of locCodes) {
      if (signals.unlocs.has(code)) {
        push({
          objectType: "SHIPMENT",
          objectId: s.id,
          matchType: "PORT_UNLOC",
          matchConfidence: 88,
          impactLevel: "HIGH",
          rationale: `Shipment booking or route references UN/LOC ${code}, which appears on this event.`,
        });
        matchedShipmentIds.add(s.id);
        break;
      }
    }

    const shipCountry = normCountry(s.order.shipToCountryCode);
    if (shipCountry && signals.countries.has(shipCountry)) {
      push({
        objectType: "SHIPMENT",
        objectId: s.id,
        matchType: "PO_SHIP_TO_COUNTRY",
        matchConfidence: 72,
        impactLevel: "MEDIUM",
        rationale: `Purchase order ship-to country ${shipCountry} overlaps event geography.`,
      });
      matchedShipmentIds.add(s.id);
    }

    if (regionLooselyMatches(s.order.shipToRegion, signals.regionTerms)) {
      push({
        objectType: "SHIPMENT",
        objectId: s.id,
        matchType: "PO_SHIP_TO_REGION",
        matchConfidence: 48,
        impactLevel: "LOW",
        rationale: `Purchase order ship-to region may overlap event region keywords.`,
      });
      matchedShipmentIds.add(s.id);
    }

    const supCountry = normCountry(s.order.supplier?.registeredCountryCode ?? null);
    if (supCountry && signals.countries.has(supCountry)) {
      push({
        objectType: "SHIPMENT",
        objectId: s.id,
        matchType: "SUPPLIER_REGISTERED_COUNTRY",
        matchConfidence: 62,
        impactLevel: "LOW",
        rationale: `Supplier (${s.order.supplier?.name ?? s.order.supplierId}) registered in ${supCountry}, listed on event.`,
      });
      matchedShipmentIds.add(s.id);
    }
  }

  const countryList = [...signals.countries];
  if (countryList.length > 0) {
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId, registeredCountryCode: { in: countryList } },
      select: { id: true, name: true, registeredCountryCode: true },
      take: R2_MATCH_LIMITS.maxSuppliersByCountry,
    });
    for (const sup of suppliers) {
      const c = normCountry(sup.registeredCountryCode);
      if (!c) continue;
      push({
        objectType: "SUPPLIER",
        objectId: sup.id,
        matchType: "REGISTERED_COUNTRY",
        matchConfidence: 70,
        impactLevel: "LOW",
        rationale: `Supplier ${sup.name} registered in ${c}, which appears on this event.`,
      });
    }

    const pos = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        splitParentId: null,
        OR: [
          { shipToCountryCode: { in: countryList } },
          { supplier: { is: { registeredCountryCode: { in: countryList } } } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        shipToCountryCode: true,
        supplierId: true,
        supplier: { select: { registeredCountryCode: true } },
      },
      take: R2_MATCH_LIMITS.maxPurchaseOrdersScan,
    });

    for (const p of pos) {
      const st = normCountry(p.shipToCountryCode);
      if (st && signals.countries.has(st)) {
        push({
          objectType: "PURCHASE_ORDER",
          objectId: p.id,
          matchType: "PO_SHIP_TO_COUNTRY",
          matchConfidence: 74,
          impactLevel: "MEDIUM",
          rationale: `PO ${p.orderNumber} ships to ${st}, which appears on this event.`,
        });
      }
      const rc = normCountry(p.supplier?.registeredCountryCode ?? null);
      if (rc && signals.countries.has(rc)) {
        push({
          objectType: "PURCHASE_ORDER",
          objectId: p.id,
          matchType: "PO_SUPPLIER_REGISTERED_COUNTRY",
          matchConfidence: 64,
          impactLevel: "LOW",
          rationale: `PO ${p.orderNumber} supplier is registered in ${rc}, which appears on this event.`,
        });
      }
    }
  }

  const warehouseIdsForInventory = new Set<string>();
  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId, isActive: true },
    orderBy: { updatedAt: "desc" },
    take: R2_MATCH_LIMITS.maxWarehouses,
    select: {
      id: true,
      name: true,
      code: true,
      countryCode: true,
      region: true,
    },
  });
  for (const w of warehouses) {
    const wc = normCountry(w.countryCode);
    let hit = false;
    if (wc && signals.countries.has(wc)) {
      push({
        objectType: "WAREHOUSE",
        objectId: w.id,
        matchType: "WAREHOUSE_COUNTRY",
        matchConfidence: 68,
        impactLevel: "MEDIUM",
        rationale: `Warehouse ${w.code ? `${w.code} — ` : ""}${w.name} is in ${wc}, which appears on this event.`,
      });
      hit = true;
    }
    if (regionLooselyMatches(w.region, signals.regionTerms)) {
      push({
        objectType: "WAREHOUSE",
        objectId: w.id,
        matchType: "WAREHOUSE_REGION",
        matchConfidence: 46,
        impactLevel: "LOW",
        rationale: `Warehouse ${w.code ? `${w.code} — ` : ""}${w.name} region may overlap event region keywords.`,
      });
      hit = true;
    }
    if (hit) warehouseIdsForInventory.add(w.id);
  }

  if (warehouseIdsForInventory.size > 0) {
    const balances = await prisma.inventoryBalance.findMany({
      where: {
        tenantId,
        warehouseId: { in: [...warehouseIdsForInventory] },
        onHandQty: { gt: 0 },
      },
      select: { id: true, warehouseId: true, productId: true },
      orderBy: { updatedAt: "desc" },
      take: R2_MATCH_LIMITS.maxInventoryBalances,
    });
    for (const b of balances) {
      push({
        objectType: "INVENTORY_BALANCE",
        objectId: b.id,
        matchType: "STOCK_AT_AFFECTED_SITE",
        matchConfidence: 55,
        impactLevel: "LOW",
        rationale: `On-hand inventory at an affected warehouse includes product ${b.productId} (balance ${b.id}).`,
      });
    }
  }

  const shipmentById = new Map(orderedShipments.map((s) => [s.id, s]));
  const salesOrderIds = new Set<string>();
  for (const sid of matchedShipmentIds) {
    const sh = shipmentById.get(sid);
    if (sh?.salesOrderId) salesOrderIds.add(sh.salesOrderId);
  }
  for (const soId of salesOrderIds) {
    push({
      objectType: "SALES_ORDER",
      objectId: soId,
      matchType: "LINKED_SHIPMENT",
      matchConfidence: 60,
      impactLevel: "MEDIUM",
      rationale: "Sales order is linked to a shipment that matched this event’s geography.",
    });
  }

  const dedup = new Map<string, MatchRow>();
  for (const m of matches) {
    const k = `${m.objectType}\0${m.objectId}\0${m.matchType}`;
    dedup.set(k, m);
  }
  const finalRows = [...dedup.values()];

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.scriEventAffectedEntity.deleteMany({ where: { eventId } });
    const chunkSize = R2_MATCH_LIMITS.createManyChunk;
    for (let i = 0; i < finalRows.length; i += chunkSize) {
      const chunk = finalRows.slice(i, i + chunkSize).map((row) => ({
        ...row,
        createdAt: now,
        updatedAt: now,
      }));
      await tx.scriEventAffectedEntity.createMany({ data: chunk });
    }
  });

  return finalRows.length;
}
