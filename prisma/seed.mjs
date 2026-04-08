import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

async function seed() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-company" },
    update: { name: "Demo Company" },
    create: {
      name: "Demo Company",
      slug: "demo-company",
    },
  });

  const [buyer, approver] = await Promise.all([
    prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: "buyer@demo-company.com" },
      },
      update: { name: "Buyer User", isActive: true },
      create: {
        tenantId: tenant.id,
        email: "buyer@demo-company.com",
        name: "Buyer User",
      },
    }),
    prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: "approver@demo-company.com" },
      },
      update: { name: "Approver User", isActive: true },
      create: {
        tenantId: tenant.id,
        email: "approver@demo-company.com",
        name: "Approver User",
      },
    }),
  ]);

  const supplier = await prisma.supplier.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "SUP-001" } },
    update: { name: "Acme Industrial Supplies", isActive: true },
    create: {
      tenantId: tenant.id,
      code: "SUP-001",
      name: "Acme Industrial Supplies",
      email: "orders@acme.example",
    },
  });

  const simpleWorkflow = await prisma.workflow.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "SIMPLE_INTERNAL" } },
    update: { name: "Simple Internal", isDefault: true },
    create: {
      tenantId: tenant.id,
      name: "Simple Internal",
      code: "SIMPLE_INTERNAL",
      isDefault: true,
      supplierPortalOn: false,
      allowSplitOrders: false,
    },
  });

  const supplierWorkflow = await prisma.workflow.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "SUPPLIER_CONFIRM" } },
    update: { name: "Supplier Confirm", isDefault: false },
    create: {
      tenantId: tenant.id,
      name: "Supplier Confirm",
      code: "SUPPLIER_CONFIRM",
      isDefault: false,
      supplierPortalOn: true,
      allowSplitOrders: true,
    },
  });

  const simpleDraft = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: simpleWorkflow.id, code: "DRAFT" } },
    update: { label: "Draft", sortOrder: 10, isStart: true, isEnd: false },
    create: {
      workflowId: simpleWorkflow.id,
      code: "DRAFT",
      label: "Draft",
      sortOrder: 10,
      isStart: true,
    },
  });
  const simpleOpen = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: simpleWorkflow.id, code: "OPEN" } },
    update: { label: "Open", sortOrder: 20, isEnd: false },
    create: {
      workflowId: simpleWorkflow.id,
      code: "OPEN",
      label: "Open",
      sortOrder: 20,
    },
  });
  const simpleClosed = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: simpleWorkflow.id, code: "CLOSED" } },
    update: { label: "Closed", sortOrder: 30, isEnd: true },
    create: {
      workflowId: simpleWorkflow.id,
      code: "CLOSED",
      label: "Closed",
      sortOrder: 30,
      isEnd: true,
    },
  });

  const supplierSent = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "SENT" } },
    update: { label: "Sent to Supplier", sortOrder: 10, isStart: true, isEnd: false },
    create: {
      workflowId: supplierWorkflow.id,
      code: "SENT",
      label: "Sent to Supplier",
      sortOrder: 10,
      isStart: true,
    },
  });
  const supplierConfirmed = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "CONFIRMED" } },
    update: { label: "Confirmed", sortOrder: 20, isEnd: false },
    create: {
      workflowId: supplierWorkflow.id,
      code: "CONFIRMED",
      label: "Confirmed",
      sortOrder: 20,
    },
  });
  const supplierSplit = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "SPLIT" } },
    update: { label: "Split", sortOrder: 30, isEnd: false },
    create: {
      workflowId: supplierWorkflow.id,
      code: "SPLIT",
      label: "Split",
      sortOrder: 30,
    },
  });
  const supplierDeclined = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "DECLINED" } },
    update: { label: "Declined", sortOrder: 40, isEnd: true },
    create: {
      workflowId: supplierWorkflow.id,
      code: "DECLINED",
      label: "Declined",
      sortOrder: 40,
      isEnd: true,
    },
  });

  const transitionData = [
    {
      workflowId: simpleWorkflow.id,
      fromStatusId: simpleDraft.id,
      toStatusId: simpleOpen.id,
      actionCode: "submit",
      label: "Submit",
      requiresComment: false,
    },
    {
      workflowId: simpleWorkflow.id,
      fromStatusId: simpleOpen.id,
      toStatusId: simpleClosed.id,
      actionCode: "close",
      label: "Close",
      requiresComment: false,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSent.id,
      toStatusId: supplierConfirmed.id,
      actionCode: "confirm",
      label: "Confirm",
      requiresComment: false,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSent.id,
      toStatusId: supplierSplit.id,
      actionCode: "split",
      label: "Split",
      requiresComment: true,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSent.id,
      toStatusId: supplierDeclined.id,
      actionCode: "decline",
      label: "Decline",
      requiresComment: true,
    },
  ];

  for (const transition of transitionData) {
    await prisma.workflowTransition.upsert({
      where: {
        workflowId_fromStatusId_toStatusId_actionCode: {
          workflowId: transition.workflowId,
          fromStatusId: transition.fromStatusId,
          toStatusId: transition.toStatusId,
          actionCode: transition.actionCode,
        },
      },
      update: {
        label: transition.label,
        requiresComment: transition.requiresComment,
      },
      create: transition,
    });
  }

  const demoOrders = [
    {
      orderNumber: "PO-1001",
      title: "Office Consumables",
      workflowId: simpleWorkflow.id,
      statusId: simpleDraft.id,
      requesterId: buyer.id,
      supplierId: supplier.id,
      subtotal: "1250.00",
      taxAmount: "125.00",
      totalAmount: "1375.00",
    },
    {
      orderNumber: "PO-1002",
      title: "Packaging Material",
      workflowId: supplierWorkflow.id,
      statusId: supplierSent.id,
      requesterId: approver.id,
      supplierId: supplier.id,
      subtotal: "5000.00",
      taxAmount: "500.00",
      totalAmount: "5500.00",
    },
  ];

  for (const order of demoOrders) {
    await prisma.purchaseOrder.upsert({
      where: { tenantId_orderNumber: { tenantId: tenant.id, orderNumber: order.orderNumber } },
      update: {
        title: order.title,
        workflowId: order.workflowId,
        statusId: order.statusId,
        requesterId: order.requesterId,
        supplierId: order.supplierId,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
      },
      create: {
        tenantId: tenant.id,
        orderNumber: order.orderNumber,
        title: order.title,
        workflowId: order.workflowId,
        statusId: order.statusId,
        requesterId: order.requesterId,
        supplierId: order.supplierId,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
      },
    });
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
