import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchaseOrder: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authz")>();
  return {
    ...actual,
    actorIsSupplierPortalRestricted: vi.fn(),
  };
});

import type { ViewerAccess } from "@/lib/authz";
import { actorIsSupplierPortalRestricted } from "@/lib/authz";
import { executeHelpDoAction } from "@/lib/help-actions";
import { prisma } from "@/lib/prisma";

const findFirst = vi.mocked(prisma.purchaseOrder.findFirst);
const supplierPortalRestricted = vi.mocked(actorIsSupplierPortalRestricted);

function mkAccess(grantPairs: [string, string][]): ViewerAccess {
  return {
    tenant: { id: "tenant-1", name: "Demo", slug: "demo" },
    user: { id: "user-1", email: "actor@test", name: "Actor" },
    grantSet: new Set(grantPairs.map(([r, a]) => `${r}\0${a}`)),
  };
}

describe("executeHelpDoAction open_order", () => {
  beforeEach(() => {
    findFirst.mockReset();
    supplierPortalRestricted.mockReset();
    supplierPortalRestricted.mockResolvedValue(false);
  });

  it("requires org.orders view", async () => {
    const access = mkAccess([["org.reports", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_order",
      label: "Open",
      payload: { orderNumber: "PO-1" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/permission to view orders/i);
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rejects empty order number", async () => {
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_order",
      label: "Open",
      payload: { orderNumber: "   " },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Missing or invalid order number/i);
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns href to /orders/:id when a PO matches", async () => {
    findFirst.mockResolvedValue({
      id: "ord-cuid",
      orderNumber: "PO-100",
      workflow: { supplierPortalOn: true },
    } as never);
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_order",
      label: "Open",
      payload: { orderNumber: "po-100" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toBe("/orders/ord-cuid");
      expect(r.message).toContain("PO-100");
    }
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("includes focus and playbook query params when valid", async () => {
    findFirst.mockResolvedValue({
      id: "x",
      orderNumber: "PO-2",
      workflow: { supplierPortalOn: false },
    } as never);
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_order",
      label: "Open",
      payload: {
        orderNumber: "PO-2",
        focus: "workflow",
        guide: "create_order",
        step: 2,
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.href).toContain("/orders/x?");
      expect(r.href).toContain("focus=workflow");
      expect(r.href).toContain("guide=create_order");
      expect(r.href).toContain("step=2");
    }
  });

  it("returns not found when prisma finds no order", async () => {
    findFirst.mockResolvedValue(null);
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_order",
      label: "Open",
      payload: { orderNumber: "PO-999" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/No order matched/i);
    }
  });

  it("blocks supplier portal users when the order is not portal-enabled", async () => {
    findFirst.mockResolvedValue({
      id: "x",
      orderNumber: "PO-3",
      workflow: { supplierPortalOn: false },
    } as never);
    supplierPortalRestricted.mockResolvedValue(true);
    const access = mkAccess([["org.orders", "view"]]);
    const r = await executeHelpDoAction(access, {
      type: "open_order",
      label: "Open",
      payload: { orderNumber: "PO-3" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/supplier portal/i);
    }
  });
});
