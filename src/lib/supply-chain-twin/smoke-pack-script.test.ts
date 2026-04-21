import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

describe("sctwin smoke pack script", () => {
  it("classifies unreachable base URL with stable blocker code", () => {
    const root = process.cwd();
    const scriptPath = path.join(root, "scripts", "sctwin-smoke-pack.mjs");
    const run = spawnSync("node", [scriptPath], {
      cwd: root,
      env: {
        ...process.env,
        SCTWIN_SMOKE_BASE_URL: "http://127.0.0.1:1",
        SCTWIN_SMOKE_TIMEOUT_MS: "500",
      },
      encoding: "utf8",
    });

    expect(run.status).toBe(1);
    const payload = JSON.parse(run.stdout);
    expect(payload.ok).toBe(false);
    expect(payload.baseUrlReachable).toBe(false);
    expect(payload.blockingReason).toBe("BASE_URL_UNREACHABLE");
    expect(Array.isArray(payload.steps)).toBe(true);
    expect(payload.steps.length).toBe(5);
    expect(payload.steps.every((step: { error?: string }) => step.error === "BASE_URL_UNREACHABLE")).toBe(true);
  });
});
