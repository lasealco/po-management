"use client";

import { useSyncExternalStore } from "react";

type AsyncStatus = "pending" | "resolved" | "rejected";

type TwinAsyncSnapshot<T> =
  | { status: "pending"; data: undefined; error: undefined }
  | { status: "resolved"; data: T; error: undefined }
  | { status: "rejected"; data: undefined; error: unknown };

type TwinAsyncEntry<T> = {
  status: AsyncStatus;
  data?: T;
  error?: unknown;
  promise: Promise<T>;
  listeners: Set<() => void>;
  snapshot: TwinAsyncSnapshot<T>;
};

const twinAsyncByKey = new Map<string, TwinAsyncEntry<unknown>>();

function notify(listeners: Set<() => void>) {
  for (const l of listeners) {
    l();
  }
}

function setSnapshot<T>(entry: TwinAsyncEntry<T>, snapshot: TwinAsyncSnapshot<T>) {
  entry.snapshot = snapshot;
  notify(entry.listeners);
}

function ensureTwinAsyncEntry<T>(key: string, createPromise: () => Promise<T>): TwinAsyncEntry<T> {
  const existing = twinAsyncByKey.get(key) as TwinAsyncEntry<T> | undefined;
  if (existing) {
    return existing;
  }

  const listeners = new Set<() => void>();
  const pendingSnapshot: TwinAsyncSnapshot<T> = Object.freeze({
    status: "pending",
    data: undefined,
    error: undefined,
  });

  const entry: TwinAsyncEntry<T> = {
    status: "pending",
    promise: Promise.resolve()
      .then(() => createPromise())
      .then(
        (data) => {
          entry.status = "resolved";
          entry.data = data;
          entry.error = undefined;
          setSnapshot(entry, Object.freeze({ status: "resolved", data, error: undefined }));
          return data;
        },
        (error) => {
          entry.status = "rejected";
          entry.data = undefined;
          entry.error = error;
          setSnapshot(entry, Object.freeze({ status: "rejected", data: undefined, error }));
          return Promise.reject(error);
        },
      ),
    listeners,
    snapshot: pendingSnapshot,
  };

  twinAsyncByKey.set(key, entry as TwinAsyncEntry<unknown>);
  return entry;
}

/**
 * Deduplicated async fetch for Supply Chain Twin client widgets.
 *
 * Why: several Twin components previously used `use(useMemo(() => fetch…))`, which can
 * thrash requests under remount/suspense transitions. This hook shares a single in-flight
 * promise per `loadKey` for the lifetime of the page session.
 */
export function useTwinCachedAsync<T>(loadKey: string, createPromise: () => Promise<T>): TwinAsyncSnapshot<T> {
  // Note: `createPromise` is intentionally not a dependency — the `loadKey` must fully describe the
  // request identity. The module cache dedupes in-flight work across remounts and multiple widgets.
  const entry = ensureTwinAsyncEntry(loadKey, createPromise);

  return useSyncExternalStore(
    (onStoreChange) => {
      entry.listeners.add(onStoreChange);
      return () => {
        entry.listeners.delete(onStoreChange);
      };
    },
    () => entry.snapshot,
    () =>
      Object.freeze({
        status: "pending",
        data: undefined,
        error: undefined,
      }) as TwinAsyncSnapshot<T>,
  );
}
