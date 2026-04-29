export type WarehouseFulfillmentInputs = {
  warehouses: Array<{ id: string; code: string | null; name: string; isActive: boolean }>;
  tasks: Array<{
    id: string;
    warehouseId: string;
    warehouseName: string;
    taskType: string;
    status: string;
    quantity: number;
    ageHours: number;
    productName: string | null;
    shipmentNo: string | null;
    orderNumber: string | null;
    waveNo: string | null;
  }>;
  waves: Array<{ id: string; warehouseId: string; warehouseName: string; waveNo: string; status: string; taskCount: number; openTaskCount: number; ageHours: number }>;
  outboundOrders: Array<{ id: string; warehouseId: string; warehouseName: string; outboundNo: string; status: string; requestedShipDate: string | null; lineCount: number; pickedQty: number; packedQty: number; shippedQty: number; totalQty: number }>;
  inventory: Array<{ id: string; warehouseId: string; warehouseName: string; onHandQty: number; allocatedQty: number; onHold: boolean; holdReason: string | null }>;
  shipments: Array<{ id: string; shipmentNo: string | null; status: string; expectedReceiveAt: string | null; receivedAt: string | null; exceptionCount: number }>;
  capacityPlans: Array<{ id: string; title: string; status: string; capacityScore: number; warehouseId: string | null }>;
  networkPackets: Array<{ id: string; title: string; status: string; twinScore: number; bottleneckCount: number; disruptionRiskCount: number; recoveryActionCount: number }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function overdue(date: string | null) {
  return Boolean(date && Date.parse(date) < Date.now());
}

export function buildCapacityPosture(inputs: WarehouseFulfillmentInputs) {
  const openTasks = inputs.tasks.filter((task) => task.status === "OPEN");
  const heldBalances = inputs.inventory.filter((row) => row.onHold);
  const activeCapacityPlans = inputs.capacityPlans.filter((plan) => plan.status !== "CAPACITY_READY" && plan.status !== "APPROVED");
  const byWarehouse = inputs.warehouses
    .filter((warehouse) => warehouse.isActive)
    .map((warehouse) => {
      const warehouseTasks = openTasks.filter((task) => task.warehouseId === warehouse.id);
      const warehouseInventory = inputs.inventory.filter((row) => row.warehouseId === warehouse.id);
      const onHandQty = warehouseInventory.reduce((sum, row) => sum + row.onHandQty, 0);
      const allocatedQty = warehouseInventory.reduce((sum, row) => sum + row.allocatedQty, 0);
      const heldCount = warehouseInventory.filter((row) => row.onHold).length;
      const taskPressure = Math.min(50, warehouseTasks.length * 4);
      const agedPressure = Math.min(25, warehouseTasks.filter((task) => task.ageHours >= 24).length * 8);
      const allocationPressure = Math.min(15, Math.max(0, pct(allocatedQty, onHandQty) - 80));
      const holdPressure = Math.min(15, heldCount * 5);
      return {
        warehouseId: warehouse.id,
        label: warehouse.code ? `${warehouse.name} (${warehouse.code})` : warehouse.name,
        openTaskCount: warehouseTasks.length,
        agedTaskCount: warehouseTasks.filter((task) => task.ageHours >= 24).length,
        heldBalanceCount: heldCount,
        allocationPct: pct(allocatedQty, onHandQty),
        capacityScore: clamp(100 - taskPressure - agedPressure - allocationPressure - holdPressure),
      };
    });
  return {
    warehouseCount: byWarehouse.length,
    openTaskCount: openTasks.length,
    agedTaskCount: openTasks.filter((task) => task.ageHours >= 24).length,
    heldBalanceCount: heldBalances.length,
    activeCapacityPlanCount: activeCapacityPlans.length,
    byWarehouse: byWarehouse.toSorted((a, b) => a.capacityScore - b.capacityScore || b.openTaskCount - a.openTaskCount),
    guardrail: "Capacity posture is advisory and does not assign labor, complete WMS tasks, move stock, reserve inventory, or release waves automatically.",
  };
}

export function buildTaskRecovery(inputs: WarehouseFulfillmentInputs) {
  const openTasks = inputs.tasks.filter((task) => task.status === "OPEN");
  const taskGroups = openTasks.reduce<Record<string, { count: number; quantity: number; aged: number }>>((acc, task) => {
    const row = acc[task.taskType] ?? { count: 0, quantity: 0, aged: 0 };
    row.count += 1;
    row.quantity += task.quantity;
    if (task.ageHours >= 24) row.aged += 1;
    acc[task.taskType] = row;
    return acc;
  }, {});
  const riskyTasks = openTasks
    .filter((task) => task.ageHours >= 24 || task.taskType === "PICK" || task.taskType === "PUTAWAY")
    .toSorted((a, b) => b.ageHours - a.ageHours || a.taskType.localeCompare(b.taskType))
    .slice(0, 20)
    .map((task) => ({
      taskId: task.id,
      warehouseName: task.warehouseName,
      taskType: task.taskType,
      ageHours: task.ageHours,
      quantity: task.quantity,
      productName: task.productName,
      shipmentNo: task.shipmentNo,
      orderNumber: task.orderNumber,
      waveNo: task.waveNo,
      proposedAction: task.taskType === "PICK" ? "Supervisor reviews pick priority before mobile work sequencing." : task.taskType === "PUTAWAY" ? "Supervisor reviews putaway congestion before slot or replenishment changes." : "Supervisor reviews task backlog before assignment changes.",
    }));
  return {
    openTaskCount: openTasks.length,
    agedTaskCount: openTasks.filter((task) => task.ageHours >= 24).length,
    taskGroups: Object.entries(taskGroups).map(([taskType, row]) => ({ taskType, ...row })).toSorted((a, b) => b.count - a.count || a.taskType.localeCompare(b.taskType)),
    riskyTasks,
    guardrail: "Task recovery proposals do not complete, cancel, assign, reprioritize, or create WMS tasks without supervisor approval.",
  };
}

export function buildWaveHealth(inputs: WarehouseFulfillmentInputs) {
  const waveRisks = inputs.waves
    .filter((wave) => wave.status !== "DONE" && wave.status !== "CANCELLED")
    .map((wave) => {
      const riskReasons = [
        ...(wave.status === "RELEASED" && wave.openTaskCount > 0 ? ["released_with_open_tasks"] : []),
        ...(wave.ageHours >= 24 ? ["aged_wave"] : []),
        ...(wave.taskCount === 0 ? ["empty_wave"] : []),
      ];
      return {
        waveId: wave.id,
        warehouseName: wave.warehouseName,
        waveNo: wave.waveNo,
        status: wave.status,
        taskCount: wave.taskCount,
        openTaskCount: wave.openTaskCount,
        ageHours: wave.ageHours,
        riskReasons,
      };
    })
    .filter((wave) => wave.riskReasons.length > 0);
  return {
    waveCount: inputs.waves.length,
    waveRiskCount: waveRisks.length,
    waveRisks: waveRisks.slice(0, 20),
    guardrail: "Wave health does not release, close, cancel, resequence, or edit waves automatically.",
  };
}

export function buildOutboundFulfillment(inputs: WarehouseFulfillmentInputs) {
  const risks = inputs.outboundOrders
    .filter((order) => order.status === "RELEASED" || order.status === "PICKING" || order.status === "PACKED")
    .map((order) => {
      const pickPct = pct(order.pickedQty, order.totalQty);
      const packPct = pct(order.packedQty, order.totalQty);
      const shipPct = pct(order.shippedQty, order.totalQty);
      const riskReasons = [
        ...(order.status === "RELEASED" && pickPct === 0 ? ["released_not_picked"] : []),
        ...(order.status === "PICKING" && packPct < pickPct ? ["pack_lag"] : []),
        ...(order.status === "PACKED" && shipPct < packPct ? ["ship_lag"] : []),
        ...(overdue(order.requestedShipDate) && order.status !== "SHIPPED" ? ["requested_ship_date_overdue"] : []),
      ];
      return { outboundOrderId: order.id, warehouseName: order.warehouseName, outboundNo: order.outboundNo, status: order.status, lineCount: order.lineCount, pickPct, packPct, shipPct, riskReasons };
    })
    .filter((order) => order.riskReasons.length > 0);
  return {
    outboundCount: inputs.outboundOrders.length,
    outboundRiskCount: risks.length,
    risks: risks.slice(0, 20),
    guardrail: "Outbound fulfillment review does not pick, pack, ship, close, cancel, allocate, or communicate outbound orders automatically.",
  };
}

export function buildExceptionEvidence(inputs: WarehouseFulfillmentInputs) {
  const shipmentExceptions = inputs.shipments
    .filter((shipment) => shipment.exceptionCount > 0 || (shipment.expectedReceiveAt && !shipment.receivedAt && overdue(shipment.expectedReceiveAt)))
    .map((shipment) => ({
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      status: shipment.status,
      exceptionCount: shipment.exceptionCount,
      lateReceiving: Boolean(shipment.expectedReceiveAt && !shipment.receivedAt && overdue(shipment.expectedReceiveAt)),
    }));
  const networkLinks = inputs.networkPackets
    .filter((packet) => packet.bottleneckCount > 0 || packet.disruptionRiskCount > 0 || packet.recoveryActionCount > 0)
    .slice(0, 10)
    .map((packet) => ({ packetId: packet.id, title: packet.title, twinScore: packet.twinScore, bottleneckCount: packet.bottleneckCount, disruptionRiskCount: packet.disruptionRiskCount }));
  return {
    exceptionCount: shipmentExceptions.reduce((sum, shipment) => sum + shipment.exceptionCount, 0) + shipmentExceptions.filter((shipment) => shipment.lateReceiving).length,
    shipmentExceptions: shipmentExceptions.slice(0, 20),
    networkLinks,
    guardrail: "Exception evidence does not resolve exceptions, update shipment status, receive cargo, or notify customers automatically.",
  };
}

export function buildSupervisorActions(
  inputs: WarehouseFulfillmentInputs,
  taskRecovery = buildTaskRecovery(inputs),
  waveHealth = buildWaveHealth(inputs),
  outboundFulfillment = buildOutboundFulfillment(inputs),
  exceptionEvidence = buildExceptionEvidence(inputs),
) {
  const pending = inputs.actionQueue.filter((item) => item.status === "PENDING" && /warehouse|wms|task|wave|pick|pack|ship|fulfillment|capacity|recovery/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  const actions = [
    ...(taskRecovery.agedTaskCount > 0 ? [{ owner: "Warehouse supervisor", priority: "HIGH", action: "Review aged WMS task backlog and approve mobile work sequencing." }] : []),
    ...(waveHealth.waveRiskCount > 0 ? [{ owner: "Wave planner", priority: "HIGH", action: "Review wave risk before release, resequence, or close decisions." }] : []),
    ...(outboundFulfillment.outboundRiskCount > 0 ? [{ owner: "Fulfillment lead", priority: "HIGH", action: "Review outbound pick/pack/ship lag before customer promise updates." }] : []),
    ...(exceptionEvidence.exceptionCount > 0 ? [{ owner: "Control Tower", priority: "MEDIUM", action: "Review shipment/receiving exception evidence before recovery execution." }] : []),
    { owner: "Operations manager", priority: "MEDIUM", action: "Create downstream approved WMS work for any task completion, inventory movement, wave release, outbound shipment, or staffing change." },
  ];
  return {
    recoveryActionCount: actions.length + pending.length,
    actions,
    pendingActions: pending.slice(0, 12).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Supervisor actions queue review work only and do not mutate WMS tasks, waves, inventory, shipments, outbound orders, staffing, or customer promises.",
  };
}

export function buildMobileWork(inputs: WarehouseFulfillmentInputs, taskRecovery = buildTaskRecovery(inputs)) {
  const mobileCandidates = taskRecovery.riskyTasks.slice(0, 12).map((task) => ({
    taskId: task.taskId,
    warehouseName: task.warehouseName,
    taskType: task.taskType,
    label: [task.taskType, task.productName, task.shipmentNo, task.orderNumber].filter(Boolean).join(" / "),
    priority: task.ageHours >= 24 || task.taskType === "PICK" ? "HIGH" : "MEDIUM",
    offlineSafe: false,
    requiresSupervisorApproval: true,
  }));
  return {
    mobileCandidateCount: mobileCandidates.length,
    mobileCandidates,
    guardrail: "Mobile work cards are drafts; the assistant does not dispatch, complete, or cancel mobile WMS tasks automatically.",
  };
}

export function buildWarehouseFulfillmentPacket(inputs: WarehouseFulfillmentInputs) {
  const capacityPosture = buildCapacityPosture(inputs);
  const taskRecovery = buildTaskRecovery(inputs);
  const waveHealth = buildWaveHealth(inputs);
  const outboundFulfillment = buildOutboundFulfillment(inputs);
  const exceptionEvidence = buildExceptionEvidence(inputs);
  const supervisorAction = buildSupervisorActions(inputs, taskRecovery, waveHealth, outboundFulfillment, exceptionEvidence);
  const mobileWork = buildMobileWork(inputs, taskRecovery);
  const sourceSummary = {
    warehouses: inputs.warehouses.length,
    tasks: inputs.tasks.length,
    waves: inputs.waves.length,
    outboundOrders: inputs.outboundOrders.length,
    inventoryBalances: inputs.inventory.length,
    shipments: inputs.shipments.length,
    capacityPlans: inputs.capacityPlans.length,
    networkPackets: inputs.networkPackets.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const autonomyScore = clamp(
    92 -
      Math.min(28, taskRecovery.openTaskCount * 3) -
      Math.min(22, taskRecovery.agedTaskCount * 6) -
      Math.min(16, waveHealth.waveRiskCount * 5) -
      Math.min(16, outboundFulfillment.outboundRiskCount * 4) -
      Math.min(18, exceptionEvidence.exceptionCount * 3) -
      Math.min(12, capacityPosture.heldBalanceCount * 4) +
      Math.min(8, capacityPosture.warehouseCount),
  );
  const responsePlan = {
    status: autonomyScore < 60 ? "SUPERVISOR_RECOVERY_REQUIRED" : autonomyScore < 82 ? "FULFILLMENT_REVIEW" : "MONITOR",
    owners: ["Warehouse supervisor", "Wave planner", "Fulfillment lead", "Control Tower", "Operations manager"],
    steps: [
      "Review capacity posture by warehouse and active capacity plan evidence.",
      "Validate aged task, pick/putaway, and wave health risks before mobile work dispatch.",
      "Review outbound pick/pack/ship lag and shipment exceptions before customer promise changes.",
      "Queue separate approved WMS work for task completion, wave release, stock movement, outbound shipment, staffing, or recovery execution.",
    ],
  };
  const rollbackPlan = {
    steps: [
      "Keep WMS tasks, waves, inventory balances, inventory movements, outbound orders, shipments, warehouse staffing, load plans, customer promises, and mobile work assignments unchanged until downstream approval.",
      "If a packet is rejected, preserve the packet and action queue notes as decision evidence without executing recovery actions.",
      "Create a fresh Sprint 8 packet when task backlog, wave status, inventory holds, outbound demand, exceptions, or supervisor capacity changes materially.",
      "Use object-specific WMS, fulfillment, shipment, and action queue workflows before execution.",
    ],
  };
  const leadershipSummary = [
    `Sprint 8 Warehouse & Fulfillment Autonomy score is ${autonomyScore}/100 across ${capacityPosture.warehouseCount} active warehouse(s), ${taskRecovery.openTaskCount} open task(s), and ${waveHealth.waveRiskCount} wave risk(s).`,
    `${taskRecovery.agedTaskCount} aged task(s), ${outboundFulfillment.outboundRiskCount} outbound fulfillment risk(s), ${exceptionEvidence.exceptionCount} exception signal(s), and ${supervisorAction.recoveryActionCount} supervisor action(s) need review.`,
    "Packet creation does not mutate WMS tasks, waves, inventory, inventory movements, outbound orders, shipments, warehouse staffing, mobile work, or customer promises.",
  ].join("\n\n");
  return {
    title: `Sprint 8 Warehouse Fulfillment packet: score ${autonomyScore}/100`,
    status: "DRAFT",
    autonomyScore,
    sourceSummary,
    capacityPosture,
    taskRecovery,
    waveHealth,
    outboundFulfillment,
    exceptionEvidence,
    supervisorAction,
    mobileWork,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
