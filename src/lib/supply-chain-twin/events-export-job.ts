export type TwinExportJobState = "pending" | "running" | "succeeded" | "failed";

export type TwinExportJobSuccess<T> = {
  ok: true;
  attempts: number;
  state: "succeeded";
  trace: TwinExportJobState[];
  result: T;
};

export type TwinExportJobFailure = {
  ok: false;
  attempts: number;
  state: "failed";
  trace: TwinExportJobState[];
  error: unknown;
};

export type TwinExportJobResult<T> = TwinExportJobSuccess<T> | TwinExportJobFailure;

function defaultRetryPredicate(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = `${error.name} ${error.message}`.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection") ||
    msg.includes("econnreset") ||
    msg.includes("temporary") ||
    msg.includes("deadlock")
  );
}

/**
 * Runs one export job attempt loop and guarantees terminal end-state (`succeeded` or `failed`).
 * Retry behavior is bounded; no intermediate state is returned to callers.
 */
export async function runTwinExportJobWithRetry<T>(
  runAttempt: (attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<TwinExportJobResult<T>> {
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 2, 1), 5);
  const shouldRetry = options.shouldRetry ?? defaultRetryPredicate;

  const trace: TwinExportJobState[] = ["pending"];
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;
    trace.push("running");
    try {
      const result = await runAttempt(attempts);
      trace.push("succeeded");
      return {
        ok: true,
        attempts,
        state: "succeeded",
        trace,
        result,
      };
    } catch (error) {
      if (attempts < maxAttempts && shouldRetry(error)) {
        continue;
      }
      trace.push("failed");
      return {
        ok: false,
        attempts,
        state: "failed",
        trace,
        error,
      };
    }
  }

  trace.push("failed");
  return {
    ok: false,
    attempts,
    state: "failed",
    trace,
    error: new Error("Export job exhausted attempts without terminal success."),
  };
}
