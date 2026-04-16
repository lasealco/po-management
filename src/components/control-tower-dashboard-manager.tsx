"use client";

import { Suspense } from "react";

import { ControlTowerDashboardManagerInner } from "@/components/control-tower-dashboard-manager-inner";

export function ControlTowerDashboardManager({ canEdit }: { canEdit: boolean }) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading dashboard…</p>}>
      <ControlTowerDashboardManagerInner canEdit={canEdit} />
    </Suspense>
  );
}
