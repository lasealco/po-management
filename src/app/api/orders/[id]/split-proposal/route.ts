import { NextRequest, NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { allocateTotals } from "@/lib/split";

type AllocationInput = {
  childIndex: number;
  quantity: string;
  plannedShipDate: string;
};

type LineInput = {
  sourceLineId: string;
  allocations: AllocationInput[];
};

type Body = {
  lines: LineInput[];
  comment?: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "split");
  if (gate) return gate;

  const { id: orderId } = await context.params;
  const body = (await request.json()) as Body;

  if (!body.lines?.length) {
    return NextResponse.json(
      { error: "lines[] is required with allocations per parent line." },
      { status: 400 },
    );
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { lineNo: "asc" } },
      status: true,
      workflow: {
        include: { transitions: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.splitParentId) {
    return NextResponse.json(
      { error: "Split proposals can only be created on a parent purchase order." },
      { status: 400 },
    );
  }

  if (!order.workflow.allowSplitOrders) {
    return NextResponse.json(
      { error: "This workflow does not allow order splits." },
      { status: 400 },
    );
  }

  if (order.status.code !== "SENT") {
    return NextResponse.json(
      {
        error: `Split can only be proposed from status SENT (current: ${order.status.code}).`,
      },
      { status: 400 },
    );
  }

  const existingPending = await prisma.splitProposal.findFirst({
    where: { parentOrderId: order.id, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "A split proposal is already pending for this order." },
      { status: 409 },
    );
  }

  const itemById = new Map(order.items.map((item) => [item.id, item]));
  const childIndices = new Set<number>();

  for (const row of body.lines) {
    const item = itemById.get(row.sourceLineId);
    if (!item) {
      return NextResponse.json(
        { error: `Unknown line id: ${row.sourceLineId}` },
        { status: 400 },
      );
    }
    if (!row.allocations?.length) {
      return NextResponse.json(
        { error: `Allocations required for line ${item.lineNo}.` },
        { status: 400 },
      );
    }
    let sum = 0;
    for (const allocation of row.allocations) {
      if (!allocation.childIndex || allocation.childIndex < 1) {
        return NextResponse.json(
          { error: "childIndex must be >= 1 for each allocation." },
          { status: 400 },
        );
      }
      const qty = Number(allocation.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          { error: "Each allocation quantity must be a positive number." },
          { status: 400 },
        );
      }
      const shipDate = new Date(allocation.plannedShipDate);
      if (Number.isNaN(shipDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid plannedShipDate (use ISO date)." },
          { status: 400 },
        );
      }
      sum += qty;
      childIndices.add(allocation.childIndex);
    }
    const ordered = Number(item.quantity);
    if (Math.abs(sum - ordered) > 1e-6) {
      return NextResponse.json(
        {
          error: `Line ${item.lineNo}: allocated total (${sum}) must equal ordered quantity (${ordered}).`,
        },
        { status: 400 },
      );
    }
  }

  if (body.lines.length !== order.items.length) {
    return NextResponse.json(
      {
        error: "Every order line must appear exactly once in the payload.",
      },
      { status: 400 },
    );
  }

  if (childIndices.size < 2) {
    return NextResponse.json(
      {
        error: "Split requires at least two child orders (distinct childIndex values).",
      },
      { status: 400 },
    );
  }

  const coverIds = new Set(body.lines.map((row) => row.sourceLineId));
  if (coverIds.size !== order.items.length) {
    return NextResponse.json(
      { error: "Duplicate or missing sourceLineId entries." },
      { status: 400 },
    );
  }
  for (const item of order.items) {
    if (!coverIds.has(item.id)) {
      return NextResponse.json(
        { error: `Missing line payload for line ${item.lineNo}.` },
        { status: 400 },
      );
    }
  }

  const transition = order.workflow.transitions.find(
    (candidate) =>
      candidate.fromStatusId === order.statusId &&
      candidate.actionCode === "propose_split",
  );
  if (!transition) {
    return NextResponse.json(
      { error: "No propose_split transition is configured for this status." },
      { status: 400 },
    );
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      { error: "Could not resolve demo actor for this tenant." },
      { status: 403 },
    );
  }
  const isSupplierPortalUser = await userHasRoleNamed(actorId, "Supplier portal");
  if (!isSupplierPortalUser) {
    return NextResponse.json(
      { error: "Only supplier users can propose split allocations." },
      { status: 403 },
    );
  }
  if (!order.workflow.supplierPortalOn) {
    return NextResponse.json(
      { error: "Split proposals are only available on supplier-portal workflows." },
      { status: 403 },
    );
  }

  const pendingChildStatus = await prisma.workflowStatus.findFirst({
    where: { workflowId: order.workflowId, code: "PENDING_BUYER_APPROVAL" },
  });
  if (!pendingChildStatus) {
    return NextResponse.json(
      { error: "Workflow missing PENDING_BUYER_APPROVAL status." },
      { status: 500 },
    );
  }

  const distinctChildren = [...childIndices].sort((a, b) => a - b);

  const result = await prisma.$transaction(async (tx) => {
    const proposal = await tx.splitProposal.create({
      data: {
        parentOrderId: order.id,
        proposedByUserId: actorId,
        comment: body.comment?.trim() || null,
        lines: {
          create: body.lines.flatMap((row) =>
            row.allocations.map((allocation) => ({
              sourceLineId: row.sourceLineId,
              quantity: allocation.quantity,
              plannedShipDate: new Date(allocation.plannedShipDate),
              childIndex: allocation.childIndex,
            })),
          ),
        },
      },
    });

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { statusId: transition.toStatusId },
    });

    await tx.orderTransitionLog.create({
      data: {
        orderId: order.id,
        fromStatusId: order.statusId,
        toStatusId: transition.toStatusId,
        actionCode: "propose_split",
        actorUserId: actorId,
        comment: body.comment?.trim() || null,
      },
    });

    const proposalLines = await tx.splitProposalLine.findMany({
      where: { proposalId: proposal.id },
    });

    for (const childIndex of distinctChildren) {
      const linesForChild = proposalLines.filter(
        (line) => line.childIndex === childIndex,
      );
      const lineTotals: string[] = [];
      const itemCreates: {
        lineNo: number;
        description: string;
        quantity: string;
        unitPrice: string;
        lineTotal: string;
      }[] = [];

      let lineNo = 1;
      for (const proposalLine of linesForChild) {
        const source = itemById.get(proposalLine.sourceLineId)!;
        const qty = Number(proposalLine.quantity);
        const unit = Number(source.unitPrice);
        const lineTotal = (qty * unit).toFixed(2);
        lineTotals.push(lineTotal);
        itemCreates.push({
          lineNo,
          description: source.description,
          quantity: proposalLine.quantity.toString(),
          unitPrice: source.unitPrice.toString(),
          lineTotal,
        });
        lineNo += 1;
      }

      const totals = allocateTotals(
        lineTotals,
        order.subtotal.toString(),
        order.taxAmount.toString(),
      );

      const orderNumber = `${order.orderNumber}/${childIndex}`;

      await tx.purchaseOrder.create({
        data: {
          tenantId: order.tenantId,
          workflowId: order.workflowId,
          orderNumber,
          title: order.title,
          requesterId: order.requesterId,
          supplierId: order.supplierId,
          statusId: pendingChildStatus.id,
          currency: order.currency,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          buyerReference: order.buyerReference,
          supplierReference: order.supplierReference,
          paymentTermsDays: order.paymentTermsDays,
          paymentTermsLabel: order.paymentTermsLabel,
          incoterm: order.incoterm,
          requestedDeliveryDate: order.requestedDeliveryDate,
          shipToName: order.shipToName,
          shipToLine1: order.shipToLine1,
          shipToLine2: order.shipToLine2,
          shipToCity: order.shipToCity,
          shipToRegion: order.shipToRegion,
          shipToPostalCode: order.shipToPostalCode,
          shipToCountryCode: order.shipToCountryCode,
          internalNotes: order.internalNotes,
          notesToSupplier: order.notesToSupplier,
          splitParentId: order.id,
          splitIndex: childIndex,
          splitProposalId: proposal.id,
          items: {
            create: itemCreates,
          },
        },
      });
    }

    return proposal;
  });

  return NextResponse.json({
    ok: true,
    proposalId: result.id,
  });
}
