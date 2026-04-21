export type ApiHubRunRetryCountersDto = {
  /** `retryOfRunId` chain depth (0 for first attempt). */
  retryDepth: number;
  /** Root run id for the chain (first attempt). */
  rootRunId: string;
  /** Remaining attempts given current row `attempt` and `maxAttempts` (never negative). */
  remainingAttempts: number;
};

export type ApiHubRunDerivedTimingsDto = {
  /** ms from enqueue → start, or null when not started. */
  queueWaitMs: number | null;
  /** ms from start → finish, or null when not finished. */
  runMs: number | null;
  /** ms from enqueue → finish, or null when not finished. */
  totalMs: number | null;
  /** ms from enqueue → now (or finish if finished). */
  ageMs: number;
};

export type ApiHubRunObservabilityDto = {
  timings: ApiHubRunDerivedTimingsDto;
  retries: ApiHubRunRetryCountersDto;
};

export type ApiHubRunObservabilityRowInput = {
  id: string;
  attempt: number;
  maxAttempts: number;
  enqueuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}

export function computeApiHubRunDerivedTimings(row: ApiHubRunObservabilityRowInput, now = new Date()): ApiHubRunDerivedTimingsDto {
  const end = row.finishedAt ?? now;
  const ageMs = clampNonNegative(end.getTime() - row.enqueuedAt.getTime());
  const queueWaitMs =
    row.startedAt != null ? clampNonNegative(row.startedAt.getTime() - row.enqueuedAt.getTime()) : null;
  const runMs =
    row.startedAt != null && row.finishedAt != null
      ? clampNonNegative(row.finishedAt.getTime() - row.startedAt.getTime())
      : null;
  const totalMs = row.finishedAt != null ? clampNonNegative(row.finishedAt.getTime() - row.enqueuedAt.getTime()) : null;
  return { queueWaitMs, runMs, totalMs, ageMs };
}

export function computeApiHubRunRetryCounters(input: {
  id: string;
  attempt: number;
  maxAttempts: number;
  retryDepth: number;
  rootRunId: string;
}): ApiHubRunRetryCountersDto {
  const remainingAttempts = clampNonNegative(input.maxAttempts - input.attempt);
  return { retryDepth: clampNonNegative(input.retryDepth), rootRunId: input.rootRunId, remainingAttempts };
}

export function buildApiHubRunObservability(opts: {
  row: ApiHubRunObservabilityRowInput;
  retryDepth: number;
  rootRunId: string;
  now?: Date;
}): ApiHubRunObservabilityDto {
  return {
    timings: computeApiHubRunDerivedTimings(opts.row, opts.now),
    retries: computeApiHubRunRetryCounters({
      id: opts.row.id,
      attempt: opts.row.attempt,
      maxAttempts: opts.row.maxAttempts,
      retryDepth: opts.retryDepth,
      rootRunId: opts.rootRunId,
    }),
  };
}

type RunLike = {
  status: string;
  enqueuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  attempt: number;
  maxAttempts: number;
};

export function buildRunTiming(run: RunLike, now = new Date()) {
  const queuedMs = run.startedAt ? Math.max(run.startedAt.getTime() - run.enqueuedAt.getTime(), 0) : null;
  const runtimeMs =
    run.startedAt && run.finishedAt ? Math.max(run.finishedAt.getTime() - run.startedAt.getTime(), 0) : null;
  const elapsedMs = run.finishedAt
    ? Math.max(run.finishedAt.getTime() - run.enqueuedAt.getTime(), 0)
    : Math.max(now.getTime() - run.enqueuedAt.getTime(), 0);

  return {
    queuedMs,
    runtimeMs,
    elapsedMs,
    isTerminal: run.status === "succeeded" || run.status === "failed",
  };
}

export function buildRunCounters(run: RunLike) {
  const remainingAttempts = Math.max(run.maxAttempts - run.attempt, 0);
  return {
    remainingAttempts,
    canRetry: run.status === "failed" && remainingAttempts > 0,
  };
}

export function summarizeRunStatuses(
  runs: Array<{ status: string; finishedAt: Date | null; enqueuedAt: Date; startedAt: Date | null }>,
) {
  const counts = { queued: 0, running: 0, succeeded: 0, failed: 0 };
  let completed = 0;
  let totalElapsedMs = 0;

  for (const run of runs) {
    if (run.status === "queued") counts.queued += 1;
    if (run.status === "running") counts.running += 1;
    if (run.status === "succeeded") counts.succeeded += 1;
    if (run.status === "failed") counts.failed += 1;
    if (run.finishedAt) {
      totalElapsedMs += Math.max(run.finishedAt.getTime() - run.enqueuedAt.getTime(), 0);
      completed += 1;
    }
  }

  return {
    totalRuns: runs.length,
    counts,
    avgCompletedElapsedMs: completed > 0 ? Math.round(totalElapsedMs / completed) : null,
  };
}
