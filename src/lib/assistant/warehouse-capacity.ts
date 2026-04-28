export type WarehouseCapacityTaskSignal = {
  id: string;
  taskType: string;
  quantity: number;
  ageHours: number;
  productName: string | null;
  orderNumber: string | null;
};

export type WarehouseCapacityInputs = {
  openTasks: WarehouseCapacityTaskSignal[];
  heldBalanceCount: number;
  releasedOutboundCount: number;
};

export function scoreWarehouseCapacity(input: WarehouseCapacityInputs) {
  const openTaskPenalty = Math.min(45, input.openTasks.length * 4);
  const agedPenalty = Math.min(25, input.openTasks.filter((task) => task.ageHours >= 24).length * 8);
  const holdPenalty = Math.min(20, input.heldBalanceCount * 5);
  const outboundPenalty = Math.min(20, input.releasedOutboundCount * 5);
  return Math.max(0, Math.min(100, 100 - openTaskPenalty - agedPenalty - holdPenalty - outboundPenalty));
}

export function summarizeTaskBottlenecks(tasks: WarehouseCapacityTaskSignal[]) {
  const byType = new Map<string, { count: number; quantity: number; aged: number }>();
  for (const task of tasks) {
    const row = byType.get(task.taskType) ?? { count: 0, quantity: 0, aged: 0 };
    row.count += 1;
    row.quantity += task.quantity;
    if (task.ageHours >= 24) row.aged += 1;
    byType.set(task.taskType, row);
  }
  return Array.from(byType.entries())
    .map(([taskType, row]) => ({ taskType, ...row }))
    .sort((a, b) => b.count - a.count || a.taskType.localeCompare(b.taskType));
}

export function buildWarehouseRecoveryPlan(input: WarehouseCapacityInputs & { warehouseName: string }) {
  const score = scoreWarehouseCapacity(input);
  const bottlenecks = summarizeTaskBottlenecks(input.openTasks);
  const top = bottlenecks[0] ?? null;
  return {
    status: score >= 75 ? "CAPACITY_READY" : score >= 45 ? "RECOVERY_NEEDED" : "OVERLOADED",
    score,
    warehouseName: input.warehouseName,
    bottlenecks,
    actions: [
      top ? `Prioritize ${top.taskType} backlog (${top.count} open task${top.count === 1 ? "" : "s"}).` : "No open WMS task backlog is visible.",
      input.heldBalanceCount > 0 ? `Review ${input.heldBalanceCount} held inventory balance${input.heldBalanceCount === 1 ? "" : "s"} before promising capacity.` : "No held inventory blocker in current snapshot.",
      input.releasedOutboundCount > 0 ? `Sequence ${input.releasedOutboundCount} released outbound order${input.releasedOutboundCount === 1 ? "" : "s"} against pick/pack capacity.` : "No released outbound order pressure in current snapshot.",
      "Queue recovery work for supervisor approval. Do not complete WMS tasks, move stock, or allocate inventory silently.",
    ],
  };
}

export function buildWarehouseCapacitySummary(plan: ReturnType<typeof buildWarehouseRecoveryPlan>) {
  return [
    `${plan.warehouseName} capacity score is ${plan.score}/100 (${plan.status}).`,
    plan.bottlenecks.length > 0
      ? `Top bottleneck: ${plan.bottlenecks[0]?.taskType} with ${plan.bottlenecks[0]?.count} open tasks.`
      : "No WMS task bottleneck detected.",
    "Recovery requires human approval before WMS task completion, stock movement, or allocation changes.",
  ].join("\n");
}
