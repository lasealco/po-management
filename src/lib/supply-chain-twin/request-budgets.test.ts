import { describe, expect, it } from "vitest";

import {
  TWIN_EVENTS_EXPORT_MAX_ROWS,
  TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS,
  TWIN_LIST_LIMIT_DEFAULT,
  TWIN_LIST_LIMIT_MAX,
} from "./request-budgets";
import { parseTwinEntitiesQuery } from "./schemas/twin-entities-query";
import { parseTwinEventsQuery } from "./schemas/twin-events-query";
import { parseTwinRiskSignalsListQuery } from "./schemas/twin-risk-signals-list-query";
import { parseTwinScenariosListQuery } from "./schemas/twin-scenarios-list-query";

describe("twin request budgets", () => {
  it("exports stable caps", () => {
    expect(TWIN_LIST_LIMIT_MAX).toBe(100);
    expect(TWIN_LIST_LIMIT_DEFAULT).toBe(50);
    expect(TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS).toBe(31);
    expect(TWIN_EVENTS_EXPORT_MAX_ROWS).toBe(1000);
  });

  it("applies shared list caps/defaults to entities", () => {
    const parsedDefault = parseTwinEntitiesQuery(new URLSearchParams());
    expect(parsedDefault.ok).toBe(true);
    if (!parsedDefault.ok) return;
    expect(parsedDefault.query.limit).toBe(TWIN_LIST_LIMIT_MAX);

    const overCap = parseTwinEntitiesQuery(new URLSearchParams(`limit=${TWIN_LIST_LIMIT_MAX + 1}`));
    expect(overCap.ok).toBe(false);
  });

  it("applies shared list caps/defaults to events", () => {
    const parsedDefault = parseTwinEventsQuery(new URLSearchParams());
    expect(parsedDefault.ok).toBe(true);
    if (!parsedDefault.ok) return;
    expect(parsedDefault.query.limit).toBe(TWIN_LIST_LIMIT_DEFAULT);

    const overCap = parseTwinEventsQuery(new URLSearchParams(`limit=${TWIN_LIST_LIMIT_MAX + 1}`));
    expect(overCap.ok).toBe(false);
  });

  it("applies shared list caps/defaults to risk signals", () => {
    const parsedDefault = parseTwinRiskSignalsListQuery(new URLSearchParams());
    expect(parsedDefault.ok).toBe(true);
    if (!parsedDefault.ok) return;
    expect(parsedDefault.query.limit).toBe(TWIN_LIST_LIMIT_DEFAULT);

    const overCap = parseTwinRiskSignalsListQuery(new URLSearchParams(`limit=${TWIN_LIST_LIMIT_MAX + 1}`));
    expect(overCap.ok).toBe(false);
  });

  it("applies shared list caps/defaults to scenarios", () => {
    const parsedDefault = parseTwinScenariosListQuery(new URLSearchParams());
    expect(parsedDefault.ok).toBe(true);
    if (!parsedDefault.ok) return;
    expect(parsedDefault.query.limit).toBe(TWIN_LIST_LIMIT_DEFAULT);

    const overCap = parseTwinScenariosListQuery(new URLSearchParams(`limit=${TWIN_LIST_LIMIT_MAX + 1}`));
    expect(overCap.ok).toBe(false);
  });

  it("enforces shared events window cap", () => {
    const end = new Date("2026-01-01T00:00:00.000Z");
    const startTooOld = new Date(end.getTime() - (TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS + 1) * 86_400_000);
    const overWindow = parseTwinEventsQuery(
      new URLSearchParams({
        since: startTooOld.toISOString(),
        until: end.toISOString(),
      }),
    );
    expect(overWindow.ok).toBe(false);
  });
});
