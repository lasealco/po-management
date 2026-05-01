import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { InventorySerialNoError, normalizeInventorySerialNo } from "./inventory-serial-no";
import type { WmsViewReadScope } from "./wms-read-scope";

export type SerialTraceQueryInput = { productId: string; serialNoRaw: string };

export type SerialTracePayload =
  | null
  | { status: "bad_serial"; message: string }
  | { status: "product_denied" }
  | { status: "not_found"; productId: string; serialNo: string }
  | {
      status: "ok";
      serial: {
        id: string;
        serialNo: string;
        note: string | null;
        createdAt: string;
        updatedAt: string;
      };
      product: {
        id: string;
        productCode: string | null;
        sku: string | null;
        name: string;
        cartonLengthMm: number | null;
        cartonWidthMm: number | null;
        cartonHeightMm: number | null;
        cartonUnitsPerMasterCarton: string | null;
      };
      currentBalance: null | {
        id: string;
        lotCode: string;
        onHandQty: string;
        allocatedQty: string;
        warehouse: { id: string; code: string | null; name: string };
        bin: { id: string; code: string; name: string };
      };
      movements: Array<{
        linkedAt: string;
        movement: {
          id: string;
          movementType: string;
          quantity: string;
          referenceType: string | null;
          referenceId: string | null;
          note: string | null;
          createdAt: string;
          warehouse: { id: string; code: string | null; name: string };
          bin: { id: string; code: string; name: string } | null;
          createdBy: { id: string; name: string; email: string };
        };
      }>;
    };

export async function loadInventorySerialTrace(
  tenantId: string,
  viewScope: WmsViewReadScope,
  q: SerialTraceQueryInput,
): Promise<SerialTracePayload> {
  let serialNo: string;
  try {
    serialNo = normalizeInventorySerialNo(q.serialNoRaw);
  } catch (e) {
    return {
      status: "bad_serial",
      message: e instanceof InventorySerialNoError ? e.message : "Invalid serial.",
    };
  }

  const baseProduct: Prisma.ProductWhereInput = { id: q.productId, tenantId };
  const productWhere: Prisma.ProductWhereInput = viewScope.inventoryProduct
    ? { AND: [baseProduct, viewScope.inventoryProduct] }
    : baseProduct;

  const product = await prisma.product.findFirst({
    where: productWhere,
    select: {
      id: true,
      productCode: true,
      sku: true,
      name: true,
      cartonLengthMm: true,
      cartonWidthMm: true,
      cartonHeightMm: true,
      cartonUnitsPerMasterCarton: true,
    },
  });
  if (!product) {
    return { status: "product_denied" };
  }

  const row = await prisma.wmsInventorySerial.findFirst({
    where: { tenantId, productId: product.id, serialNo },
    include: {
      currentBalance: {
        select: {
          id: true,
          lotCode: true,
          onHandQty: true,
          allocatedQty: true,
          warehouse: { select: { id: true, code: true, name: true } },
          bin: { select: { id: true, code: true, name: true } },
        },
      },
      movementLinks: {
        orderBy: { createdAt: "asc" },
        include: {
          inventoryMovement: {
            include: {
              warehouse: { select: { id: true, code: true, name: true } },
              bin: { select: { id: true, code: true, name: true } },
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!row) {
    return { status: "not_found", productId: product.id, serialNo };
  }

  const cb = row.currentBalance;

  return {
    status: "ok",
    serial: {
      id: row.id,
      serialNo: row.serialNo,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    product: {
      id: product.id,
      productCode: product.productCode,
      sku: product.sku,
      name: product.name,
      cartonLengthMm: product.cartonLengthMm,
      cartonWidthMm: product.cartonWidthMm,
      cartonHeightMm: product.cartonHeightMm,
      cartonUnitsPerMasterCarton:
        product.cartonUnitsPerMasterCarton != null
          ? product.cartonUnitsPerMasterCarton.toString()
          : null,
    },
    currentBalance: cb
      ? {
          id: cb.id,
          lotCode: cb.lotCode,
          onHandQty: cb.onHandQty.toString(),
          allocatedQty: cb.allocatedQty.toString(),
          warehouse: cb.warehouse,
          bin: cb.bin,
        }
      : null,
    movements: row.movementLinks.map((link) => ({
      linkedAt: link.createdAt.toISOString(),
      movement: {
        id: link.inventoryMovement.id,
        movementType: link.inventoryMovement.movementType,
        quantity: link.inventoryMovement.quantity.toString(),
        referenceType: link.inventoryMovement.referenceType,
        referenceId: link.inventoryMovement.referenceId,
        note: link.inventoryMovement.note,
        createdAt: link.inventoryMovement.createdAt.toISOString(),
        warehouse: link.inventoryMovement.warehouse,
        bin: link.inventoryMovement.bin,
        createdBy: link.inventoryMovement.createdBy,
      },
    })),
  };
}
