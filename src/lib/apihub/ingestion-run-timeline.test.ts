import { describe, expect, it } from "vitest";

import { decodeIngestionRunTimelineCursor } from "@/lib/apihub/ingestion-run-timeline-cursor";

import {
  buildSortedIngestionRunTimelineEvents,
  paginateIngestionRunTimelineEvents,
} from "./ingestion-run-timeline";

describe("buildSortedIngestionRunTimelineEvents", () => {
  it("emits queued, running, and terminal from timestamps", () => {
    const events = buildSortedIngestionRunTimelineEvents([
      {
        id: "r1",
        attempt: 1,
        status: "succeeded",
        enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
        startedAt: new Date("2026-04-22T10:00:05.000Z"),
        finishedAt: new Date("2026-04-22T10:00:20.000Z"),
      },
    ]);
    expect(events).toEqual([
      {
        runId: "r1",
        attempt: 1,
        status: "queued",
        at: "2026-04-22T10:00:00.000Z",
      },
      {
        runId: "r1",
        attempt: 1,
        status: "running",
        at: "2026-04-22T10:00:05.000Z",
      },
      {
        runId: "r1",
        attempt: 1,
        status: "succeeded",
        at: "2026-04-22T10:00:20.000Z",
      },
    ]);
  });

  it("supports failed without a running phase", () => {
    const events = buildSortedIngestionRunTimelineEvents([
      {
        id: "r1",
        attempt: 1,
        status: "failed",
        enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
        startedAt: null,
        finishedAt: new Date("2026-04-22T10:00:02.000Z"),
      },
    ]);
    expect(events.map((e) => e.status)).toEqual(["queued", "failed"]);
  });

  it("merges multiple runs in chronological order", () => {
    const events = buildSortedIngestionRunTimelineEvents([
      {
        id: "r2",
        attempt: 2,
        status: "queued",
        enqueuedAt: new Date("2026-04-22T10:01:00.000Z"),
        startedAt: null,
        finishedAt: null,
      },
      {
        id: "r1",
        attempt: 1,
        status: "failed",
        enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
        startedAt: new Date("2026-04-22T10:00:01.000Z"),
        finishedAt: new Date("2026-04-22T10:00:30.000Z"),
      },
    ]);
    expect(events[0]!.status).toBe("queued");
    expect(events[0]!.runId).toBe("r1");
    expect(events[events.length - 1]!.runId).toBe("r2");
  });
});

describe("paginateIngestionRunTimelineEvents", () => {
  const sorted = buildSortedIngestionRunTimelineEvents([
    {
      id: "r1",
      attempt: 1,
      status: "succeeded",
      enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
      startedAt: new Date("2026-04-22T10:00:05.000Z"),
      finishedAt: new Date("2026-04-22T10:00:20.000Z"),
    },
  ]);

  it("pages with nextCursor", () => {
    const first = paginateIngestionRunTimelineEvents(sorted, 0, 2);
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const decoded = decodeIngestionRunTimelineCursor(first.nextCursor!);
    expect(decoded).toEqual({ ok: true, offset: 2 });
    const second = paginateIngestionRunTimelineEvents(sorted, decoded.ok ? decoded.offset : 0, 10);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });
});
