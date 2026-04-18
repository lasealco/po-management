"use client";

import { useCallback } from "react";

export type DigestExportCsvRow = {
  id: string;
  shipmentNo: string | null;
  status: string;
  originCode: string | null;
  destinationCode: string | null;
  eta: string | null;
  milestoneCode: string | null;
  milestoneHasActual: boolean | null;
};

function escCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export function ControlTowerDigestExportCsvButton({
  rows,
  digestLimit,
  itemCount,
  truncated,
  generatedAt,
}: {
  rows: DigestExportCsvRow[];
  digestLimit: number;
  itemCount: number;
  truncated: boolean;
  generatedAt: string;
}) {
  const onClick = useCallback(() => {
    const meta = `# control-tower-digest: digestLimit=${digestLimit}; itemCount=${itemCount}; truncated=${truncated}; generatedAt=${generatedAt}`;
    const header = [
      "shipmentId",
      "shipmentNo",
      "status",
      "originCode",
      "destinationCode",
      "eta",
      "milestoneCode",
      "milestoneHasActual",
    ];
    const lines = [
      meta,
      header.join(","),
      ...rows.map((r) =>
        [
          escCell(r.id),
          escCell(r.shipmentNo?.trim() || ""),
          escCell(r.status),
          escCell(r.originCode || ""),
          escCell(r.destinationCode || ""),
          escCell(r.eta || ""),
          escCell(r.milestoneCode || ""),
          escCell(r.milestoneHasActual == null ? "" : r.milestoneHasActual ? "true" : "false"),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-tower-digest-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, digestLimit, itemCount, truncated, generatedAt]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={rows.length === 0}
      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Download CSV
    </button>
  );
}
