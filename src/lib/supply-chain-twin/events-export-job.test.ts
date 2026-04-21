import { describe, expect, it, vi } from "vitest";

import { runTwinExportJobWithRetry } from "@/lib/supply-chain-twin/events-export-job";

describe("runTwinExportJobWithRetry", () => {
  it("ends in succeeded state on first-attempt success", async () => {
    const out = await runTwinExportJobWithRetry(async () => "ok");
    expect(out).toMatchObject({
      ok: true,
      attempts: 1,
      state: "succeeded",
      trace: ["pending", "running", "succeeded"],
      result: "ok",
    });
  });

  it("retries retryable failure and then succeeds", async () => {
    const runAttempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("ECONNRESET while reading rows"))
      .mockResolvedValueOnce("ok");

    const out = await runTwinExportJobWithRetry(async () => runAttempt());
    expect(out).toMatchObject({
      ok: true,
      attempts: 2,
      state: "succeeded",
      trace: ["pending", "running", "running", "succeeded"],
      result: "ok",
    });
  });

  it("fails fast for non-retryable errors", async () => {
    const out = await runTwinExportJobWithRetry(
      async () => {
        throw new Error("validation failed");
      },
      {
        shouldRetry: () => false,
      },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.attempts).toBe(1);
    expect(out.state).toBe("failed");
    expect(out.trace).toEqual(["pending", "running", "failed"]);
  });

  it("fails terminally after max retry attempts", async () => {
    const out = await runTwinExportJobWithRetry(
      async () => {
        throw new Error("temporary connection timeout");
      },
      { maxAttempts: 2 },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.attempts).toBe(2);
    expect(out.state).toBe("failed");
    expect(out.trace).toEqual(["pending", "running", "running", "failed"]);
  });
});
