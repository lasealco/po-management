import { describe, expect, it } from "vitest";

import {
  connectorNameSearchRank,
  sortConnectorListRowsByNameSearch,
  type ConnectorNameSearchSortable,
} from "./connector-search";

function row(partial: Partial<ConnectorNameSearchSortable> & Pick<ConnectorNameSearchSortable, "id" | "name">): ConnectorNameSearchSortable {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
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

describe("sortConnectorListRowsByNameSearch", () => {
  it("ranks exact > prefix > contains with stable createdAt and id tie-breaks", () => {
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-02-01T00:00:00.000Z");
    const rows = [
      row({ id: "c-contains", name: "X foo Y", createdAt: newer }),
      row({ id: "c-prefix", name: "foo bar", createdAt: older }),
      row({ id: "c-exact", name: "foo", createdAt: older }),
      row({ id: "c-prefix-newer", name: "food", createdAt: newer }),
    ];
    const sorted = sortConnectorListRowsByNameSearch(rows, "foo");
    expect(sorted.map((r) => r.id)).toEqual(["c-exact", "c-prefix-newer", "c-prefix", "c-contains"]);
  });
});
