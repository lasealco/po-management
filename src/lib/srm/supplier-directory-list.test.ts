import { describe, expect, it } from "vitest";
import {
  buildSupplierDirectoryExtraQuery,
  parseDirectoryActive,
  parseDirectoryApproval,
  parseDirectoryKind,
  parseDirectorySearchQ,
  parseDirectorySort,
  supplierDirectoryWhere,
} from "./supplier-directory-list";

describe("supplier-directory-list", () => {
  it("parses kind, search, approval, active, sort", () => {
    expect(parseDirectoryKind(undefined)).toBe("product");
    expect(parseDirectoryKind("logistics")).toBe("logistics");
    expect(parseDirectorySearchQ("  hi  ")).toBe("hi");
    expect(parseDirectoryApproval("pending")).toBe("pending");
    expect(parseDirectoryApproval("pending_approval")).toBe("pending");
    expect(parseDirectoryActive("inactive")).toBe("inactive");
    expect(parseDirectorySort("updated")).toBe("updated");
  });

  it("buildSupplierDirectoryExtraQuery drops defaults", () => {
    expect(
      buildSupplierDirectoryExtraQuery({
        q: "",
        approval: "all",
        active: "all",
        sort: "name",
      }),
    ).toBeUndefined();
    expect(
      buildSupplierDirectoryExtraQuery({
        q: "acme",
        approval: "pending",
        active: "active",
        sort: "updated",
      }),
    ).toBe("q=acme&approval=pending&active=active&sort=updated");
  });

  it("supplierDirectoryWhere maps filters to Prisma", () => {
    const w = supplierDirectoryWhere("t1", "product", "", "pending", "active");
    expect(w).toMatchObject({
      tenantId: "t1",
      srmCategory: "product",
      approvalStatus: "pending_approval",
      isActive: true,
    });
  });
});
