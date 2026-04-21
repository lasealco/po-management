"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getTwinEventsExportErrorMessage } from "@/lib/supply-chain-twin/error-codes";

const EXPORT_FILTER_KEYS = ["since", "until", "type", "eventType", "includePayload"] as const;

type ExportState = "idle" | "loading" | "success" | "error";

export function buildTwinEventsExportUrl(searchParams: URLSearchParams, format: "csv" | "json"): string {
  const params = new URLSearchParams();
  const normalizedType = (searchParams.get("type") ?? "").trim();
  for (const key of EXPORT_FILTER_KEYS) {
    if (key === "eventType" && normalizedType !== "") {
      continue;
    }
    const value = searchParams.get(key);
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized !== "") {
      params.set(key, normalized);
    }
  }
  params.set("format", format);
  return `/api/supply-chain-twin/events/export?${params.toString()}`;
}

export function inferTwinEventsExportFilename(format: "csv" | "json"): string {
  const stamp = new Date().toISOString().replaceAll(":", "").slice(0, 15);
  return `sctwin-events-export-${stamp}.${format}`;
}

export function TwinEventsExportAction({ format = "csv" }: { format?: "csv" | "json" }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ExportState>("idle");
  const [message, setMessage] = useState<string>("");
  const exportUrl = useMemo(() => buildTwinEventsExportUrl(searchParams, format), [searchParams, format]);

  const onExport = useCallback(async () => {
    setState("loading");
    setMessage("Preparing export…");
    try {
      const response = await fetch(exportUrl, { method: "GET", cache: "no-store" });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setState("error");
        setMessage(getTwinEventsExportErrorMessage(body));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = inferTwinEventsExportFilename(format);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setState("success");
      setMessage("Export downloaded.");
    } catch {
      setState("error");
      setMessage("Network error while exporting events.");
    }
  }, [exportUrl, format]);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={state === "loading"}
        className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "loading" ? "Exporting…" : "Export events"}
      </button>
      <p aria-live="polite" className={`text-xs ${state === "error" ? "text-red-700" : "text-zinc-600"}`}>
        {message}
      </p>
    </div>
  );
}
