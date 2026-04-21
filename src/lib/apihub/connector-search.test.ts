import { describe, expect, it } from "vitest";

import {
  compareConnectorListSortFields,
  connectorNameSearchRank,
  sortConnectorListRowsByNameSearch,
  type ConnectorNameSearchSortable,
} from "./connector-search";

function row(
  partial: Partial<ConnectorNameSearchSortable> & Pick<ConnectorNameSearchSortable, "id" | "name">,
): ConnectorNameSearchSortable {
  const t = new Date("2026-01-01T00:00:00.000Z");
  return {
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

describe("connectorNameSearchRank", () => {
  it("orders exact before prefix before contains", () => {
    expect(connectorNameSearchRank("Acme", "acme")).toBe(0);
    expect(connectorNameSearchRank("Acme East", "acme")).toBe(1);
    expect(connectorNameSearchRank("East Acme Hub", "acme")).toBe(2);
  });
});

describe("compareConnectorListSortFields", () => {
  it("compares name ascending", () => {
    const a = row({ id: "a", name: "B" });
    const b = row({ id: "b", name: "A" });
    expect(compareConnectorListSortFields(a, b, "name", "asc")).toBeGreaterThan(0);
  });
});

describe("sortConnectorListRowsByNameSearch", () => {
  it("ranks exact > prefix > contains with stable createdAt and id tie-breaks", () => {
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-02-01T00:00:00.000Z");
    const rows = [
      row({ id: "c-contains", name: "X foo Y", createdAt: newer, updatedAt: newer }),
      row({ id: "c-prefix", name: "foo bar", createdAt: older, updatedAt: older }),
      row({ id: "c-exact", name: "foo", createdAt: older, updatedAt: older }),
      row({ id: "c-prefix-newer", name: "food", createdAt: newer, updatedAt: newer }),
    ];
    const sorted = sortConnectorListRowsByNameSearch(rows, "foo");
    expect(sorted.map((r) => r.id)).toEqual(["c-exact", "c-prefix-newer", "c-prefix", "c-contains"]);
  });

  it("applies name asc within the same search rank", () => {
    const t = new Date("2026-01-01T00:00:00.000Z");
    const rows = [
      row({ id: "c2", name: "foo-b", createdAt: t, updatedAt: t }),
      row({ id: "c1", name: "foo-a", createdAt: t, updatedAt: t }),
    ];
    const sorted = sortConnectorListRowsByNameSearch(rows, "foo", { field: "name", order: "asc" });
    expect(sorted.map((r) => r.id)).toEqual(["c1", "c2"]);
  });
});
