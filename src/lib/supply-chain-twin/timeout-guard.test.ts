import { describe, expect, it, vi } from "vitest";

import { TWIN_API_ERROR_CODES } from "./error-codes";
import {
  getTwinTimeoutErrorBody,
  runWithTwinTimeoutBudget,
  TwinTimeoutBudgetExceededError,
} from "./timeout-guard";

describe("runWithTwinTimeoutBudget", () => {
  it("returns operation result when operation resolves before timeout", async () => {
    const result = await runWithTwinTimeoutBudget(Promise.resolve("ok"), 100);
    expect(result).toBe("ok");
  });

  it("throws TwinTimeoutBudgetExceededError when timeout is exceeded", async () => {
    const onTimeout = vi.fn();
    await expect(
      runWithTwinTimeoutBudget(
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("late"), 25);
        }),
        1,
        onTimeout,
      ),
    ).rejects.toBeInstanceOf(TwinTimeoutBudgetExceededError);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

describe("getTwinTimeoutErrorBody", () => {
  it("returns stable timeout error contract", () => {
    expect(getTwinTimeoutErrorBody(1500)).toEqual({
      error: "Operation timed out after 1500ms. Please retry with a narrower request scope.",
      code: TWIN_API_ERROR_CODES.TIMEOUT_BUDGET_EXCEEDED,
    });
  });
});
