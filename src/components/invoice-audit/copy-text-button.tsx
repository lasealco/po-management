"use client";

import { useCallback, useState } from "react";

export function CopyTextButton(props: {
  text: string;
  /** Short label before copy (e.g. "Copy ID"). */
  label: string;
  /** Announced / shown after a successful copy. */
  copiedLabel?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }, [props.text]);

  const shown =
    state === "copied"
      ? (props.copiedLabel ?? "Copied")
      : state === "error"
        ? "Copy failed"
        : props.label;

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
    >
      {shown}
    </button>
  );
}
