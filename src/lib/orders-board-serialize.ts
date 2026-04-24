import { visibleOnBoard } from "@/lib/workflow-actions";

import {
  buildConversationSla,
  buildImpactTags,
  buildLogisticsRollup,
  buildSupplierSignals,
  computeLogisticsBlocked,
  computeWorkbenchNextStep,
  type BoardViewerMode,
  type ShipmentForBoardRollup,
} from "@/lib/orders-board-workbench";

export type OrderBoardTransition = {
  fromStatusId: string;
  actionCode: string;
  label: string;
  requiresComment: boolean;
  toStatus: { id: string; code: string; label: string };
};

export type OrderBoardSerialized = {
  id: string;
  orderNumber: string;
  title: string | null;
  buyerReference: string | null;
  requestedDeliveryDate: string | null;
  totalAmount: string;
  currency: string;
  status: { id: string; code: string; label: string };
  supplier: {
    id: string;
    name: string;
    srmCategory: "product" | "logistics";
    approvalStatus: "pending_approval" | "approved" | "rejected";
  } | null;
  requester: { id: string; name: string; email: string };
  /** Org this PO is for (optional). */
  servedOrg: { id: string; name: string; code: string; kind: string } | null;
  workflow: { id: string; name: string };
  allowedActions: {
    actionCode: string;
    label: string;
    requiresComment: boolean;
    toStatus: { id: string; code: string; label: string };
  }[];
  conversationSla: {
    awaitingReplyFrom: "buyer" | "supplier" | null;
    daysSinceLastShared: number | null;
    lastSharedAt: string | null;
  };
  logisticsStatus: "NONE" | "SHIPPED" | "PARTIALLY_RECEIVED" | "RECEIVED";
  logisticsDetail: string | null;
  linkedToSalesOrder: boolean;
  logisticsBlocked: boolean;
  impactTags: string[];
  supplierSignals: string[];
  workbench: {
    nextOwner: "buyer" | "supplier" | "operations" | "system";
    nextActionLabel: string;
    nextActionDetail: string;
  };
  createdAt: string;
};

type LatestShared = { createdAt: Date; authorRoleNames: string[] } | undefined;

export function serializeOrderForBoard(params: {
  order: {
    id: string;
    orderNumber: string;
    title: string | null;
    buyerReference: string | null;
    requestedDeliveryDate: Date | null;
    totalAmount: { toString(): string };
    currency: string;
    statusId: string;
    status: { id: string; code: string; label: string };
    supplier: {
      id: string;
      name: string;
      srmCategory: "product" | "logistics";
      approvalStatus: "pending_approval" | "approved" | "rejected";
    } | null;
    requester: { id: string; name: string; email: string };
    servedOrgUnit?: { id: string; name: string; code: string; kind: string } | null;
    workflow: {
      id: string;
      name: string;
      transitions: OrderBoardTransition[];
    };
    shipments: ShipmentForBoardRollup[];
    createdAt: Date;
  };
  latestShared: LatestShared;
  isSupplierPortalUser: boolean;
  supplierOnlyActionCodes: Set<string>;
  buyerOnlyActionCodes: Set<string>;
}): OrderBoardSerialized {
  const { order, latestShared, isSupplierPortalUser, supplierOnlyActionCodes, buyerOnlyActionCodes } = params;

  const allowedActions = order.workflow.transitions
    .filter(
      (transition) =>
        transition.fromStatusId === order.statusId && visibleOnBoard(transition.actionCode),
    )
    .filter((transition) => {
      if (supplierOnlyActionCodes.has(transition.actionCode)) {
        return isSupplierPortalUser;
      }
      if (buyerOnlyActionCodes.has(transition.actionCode)) {
        return !isSupplierPortalUser;
      }
      return true;
    })
    .map((transition) => ({
      actionCode: transition.actionCode,
      label: transition.label,
      requiresComment: transition.requiresComment,
      toStatus: transition.toStatus,
    }));

  const conversationSla = buildConversationSla(latestShared);
  const rollup = buildLogisticsRollup(order.shipments);
  const now = Date.now();
  const dueMs = order.requestedDeliveryDate ? order.requestedDeliveryDate.getTime() : NaN;
  const requestedDeliveryOverdue = !Number.isNaN(dueMs) && dueMs < now;

  const impactTags = buildImpactTags({
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    linkedToSalesOrder: rollup.linkedToSalesOrder,
    requestedDeliveryOverdue,
    bookingPending: rollup.bookingPending,
  });

  const supplierSignals = buildSupplierSignals(order.supplier);

  const viewerMode: BoardViewerMode = isSupplierPortalUser ? "supplier" : "buyer";
  const workbench = computeWorkbenchNextStep({
    statusCode: order.status.code,
    viewerMode,
    allowedActionLabels: allowedActions.map((a) => a.label),
    conversationSla,
    logisticsStatus: rollup.logisticsStatus,
    bookingPending: rollup.bookingPending,
  });

  const logisticsBlocked = computeLogisticsBlocked({
    statusCode: order.status.code,
    logisticsStatus: rollup.logisticsStatus,
    bookingPending: rollup.bookingPending,
    missingAsnOnActiveShipment: rollup.missingAsnOnActiveShipment,
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    title: order.title,
    buyerReference: order.buyerReference,
    requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    status: order.status,
    supplier: order.supplier,
    requester: order.requester,
    servedOrg: order.servedOrgUnit
      ? {
          id: order.servedOrgUnit.id,
          name: order.servedOrgUnit.name,
          code: order.servedOrgUnit.code,
          kind: order.servedOrgUnit.kind,
        }
      : null,
    workflow: {
      id: order.workflow.id,
      name: order.workflow.name,
    },
    allowedActions,
    conversationSla,
    logisticsStatus: rollup.logisticsStatus,
    logisticsDetail: rollup.logisticsDetail,
    linkedToSalesOrder: rollup.linkedToSalesOrder,
    logisticsBlocked,
    impactTags,
    supplierSignals,
    workbench,
    createdAt: order.createdAt.toISOString(),
  };
}
