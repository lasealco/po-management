import { TWIN_API_ERROR_CODES } from "./error-codes";

export class TwinTimeoutBudgetExceededError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Operation exceeded timeout budget (${timeoutMs}ms).`);
    this.name = "TwinTimeoutBudgetExceededError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Enforces a timeout budget for expensive Twin operations.
 * Throws `TwinTimeoutBudgetExceededError` when the budget is exceeded.
 */
export async function runWithTwinTimeoutBudget<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        onTimeout?.();
        reject(new TwinTimeoutBudgetExceededError(timeoutMs));
      }, timeoutMs);
    });
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function getTwinTimeoutErrorBody(timeoutMs: number): { error: string; code: string } {
  return {
    error: `Operation timed out after ${timeoutMs}ms. Please retry with a narrower request scope.`,
    code: TWIN_API_ERROR_CODES.TIMEOUT_BUDGET_EXCEEDED,
  };
}
