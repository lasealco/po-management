import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { scryptSync } from "node:crypto";

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

async function seed() {
  const seedPasswordHash = (password, identitySalt) =>
    `${identitySalt.toLowerCase()}:${scryptSync(password, identitySalt.toLowerCase(), 64).toString("hex")}`;
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-company" },
    update: { name: "Demo Company" },
    create: {
      name: "Demo Company",
      slug: "demo-company",
    },
  });

  const [buyer, approver, supplierUser] = await Promise.all([
    prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: "buyer@demo-company.com" },
      },
      update: {
        name: "Buyer User",
        isActive: true,
        passwordHash: seedPasswordHash("demo12345", "buyer@demo-company.com"),
      },
      create: {
        tenantId: tenant.id,
        email: "buyer@demo-company.com",
        name: "Buyer User",
        passwordHash: seedPasswordHash("demo12345", "buyer@demo-company.com"),
      },
    }),
    prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: "approver@demo-company.com" },
      },
      update: {
        name: "Approver User",
        isActive: true,
        passwordHash: seedPasswordHash("demo12345", "approver@demo-company.com"),
      },
      create: {
        tenantId: tenant.id,
        email: "approver@demo-company.com",
        name: "Approver User",
        passwordHash: seedPasswordHash("demo12345", "approver@demo-company.com"),
      },
    }),
    prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: "supplier@demo-company.com" },
      },
      update: {
        name: "Supplier Portal User",
        isActive: true,
        passwordHash: seedPasswordHash("demo12345", "supplier@demo-company.com"),
      },
      create: {
        tenantId: tenant.id,
        email: "supplier@demo-company.com",
        name: "Supplier Portal User",
        passwordHash: seedPasswordHash("demo12345", "supplier@demo-company.com"),
      },
    }),
  ]);

  const roleBuyer = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Buyer" } },
    update: {},
    create: { tenantId: tenant.id, name: "Buyer", isSystem: true },
  });
  const roleApprover = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Approver" } },
    update: {},
    create: { tenantId: tenant.id, name: "Approver", isSystem: true },
  });
  const roleSupplierPortal = await prisma.role.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "Supplier portal" },
    },
    update: {},
    create: { tenantId: tenant.id, name: "Supplier portal", isSystem: true },
  });

  for (const [userId, roleId] of [
    [buyer.id, roleBuyer.id],
    [approver.id, roleApprover.id],
    [supplierUser.id, roleSupplierPortal.id],
  ]) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async function replaceGlobalRolePermissions(roleId, pairs) {
    await prisma.rolePermission.deleteMany({
      where: { roleId, workflowStatusId: null },
    });
    if (pairs.length === 0) return;
    await prisma.rolePermission.createMany({
      data: pairs.map(([resource, action]) => ({
        roleId,
        resource,
        action,
        effect: "allow",
      })),
    });
  }

  const buyerGrants = [
    ["org.orders", "view"],
    ["org.orders", "edit"],
    ["org.orders", "transition"],
    ["org.products", "view"],
    ["org.products", "edit"],
    ["org.suppliers", "view"],
    ["org.settings", "view"],
  ];
  const approverGrants = [
    ...buyerGrants,
    ["org.suppliers", "edit"],
    ["org.settings", "edit"],
  ];
  const supplierGrants = [
    ["org.orders", "view"],
    ["org.orders", "transition"],
    ["org.orders", "split"],
    ["org.products", "view"],
  ];

  await replaceGlobalRolePermissions(roleBuyer.id, buyerGrants);
  await replaceGlobalRolePermissions(roleApprover.id, approverGrants);
  await replaceGlobalRolePermissions(roleSupplierPortal.id, supplierGrants);

  const supplier = await prisma.supplier.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "SUP-001" } },
    update: {
      name: "Acme Industrial Supplies",
      isActive: true,
      phone: "+1 312-555-0100",
      legalName: "Acme Industrial Supplies LLC",
      taxId: "US-EIN-12-3456789",
      website: "https://acme-industrial.example",
      registeredAddressLine1: "100 Industrial Way",
      registeredAddressLine2: "Suite 200",
      registeredCity: "Chicago",
      registeredRegion: "IL",
      registeredPostalCode: "60601",
      registeredCountryCode: "US",
      paymentTermsDays: 30,
      paymentTermsLabel: "Net 30",
      creditLimit: new Prisma.Decimal("250000.00"),
      creditCurrency: "USD",
      defaultIncoterm: "FOB",
      internalNotes:
        "Preferred packaging vendor; annual contract review in Q4. AP: use remit address on invoice.",
    },
    create: {
      tenantId: tenant.id,
      code: "SUP-001",
      name: "Acme Industrial Supplies",
      email: "orders@acme.example",
      phone: "+1 312-555-0100",
      legalName: "Acme Industrial Supplies LLC",
      taxId: "US-EIN-12-3456789",
      website: "https://acme-industrial.example",
      registeredAddressLine1: "100 Industrial Way",
      registeredAddressLine2: "Suite 200",
      registeredCity: "Chicago",
      registeredRegion: "IL",
      registeredPostalCode: "60601",
      registeredCountryCode: "US",
      paymentTermsDays: 30,
      paymentTermsLabel: "Net 30",
      creditLimit: new Prisma.Decimal("250000.00"),
      creditCurrency: "USD",
      defaultIncoterm: "FOB",
      internalNotes:
        "Preferred packaging vendor; annual contract review in Q4. AP: use remit address on invoice.",
    },
  });

  await prisma.supplierContact.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierContact.createMany({
    data: [
      {
        tenantId: tenant.id,
        supplierId: supplier.id,
        name: "Jordan Lee",
        title: "Account Manager",
        role: "Sales",
        email: "jordan.lee@acme.example",
        phone: "+1 312-555-0142",
        notes: "Primary for PO questions and expedites.",
        isPrimary: true,
      },
      {
        tenantId: tenant.id,
        supplierId: supplier.id,
        name: "Sam Rivera",
        title: "AP Specialist",
        role: "Accounts payable",
        email: "ap@acme.example",
        phone: "+1 312-555-0199",
        notes: "Invoice submissions and payment status.",
        isPrimary: false,
      },
    ],
  });

  const [cfsShenzhen, cfsRotterdam, whLosAngeles] = await Promise.all([
    prisma.warehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: "CFS-SZX" } },
      update: {
        name: "CFS Shenzhen",
        type: "CFS",
        city: "Shenzhen",
        region: "Guangdong",
        countryCode: "CN",
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        code: "CFS-SZX",
        name: "CFS Shenzhen",
        type: "CFS",
        city: "Shenzhen",
        region: "Guangdong",
        countryCode: "CN",
      },
    }),
    prisma.warehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: "CFS-RTM" } },
      update: {
        name: "CFS Rotterdam",
        type: "CFS",
        city: "Rotterdam",
        region: "ZH",
        countryCode: "NL",
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        code: "CFS-RTM",
        name: "CFS Rotterdam",
        type: "CFS",
        city: "Rotterdam",
        region: "ZH",
        countryCode: "NL",
      },
    }),
    prisma.warehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: "WH-LAX" } },
      update: {
        name: "Warehouse Los Angeles",
        type: "WAREHOUSE",
        city: "Los Angeles",
        region: "CA",
        countryCode: "US",
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        code: "WH-LAX",
        name: "Warehouse Los Angeles",
        type: "WAREHOUSE",
        city: "Los Angeles",
        region: "CA",
        countryCode: "US",
      },
    }),
  ]);

  const catPackaging = await prisma.productCategory.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "Packaging Supplies" },
    },
    update: { code: "PACK", sortOrder: 10 },
    create: {
      tenantId: tenant.id,
      name: "Packaging Supplies",
      code: "PACK",
      sortOrder: 10,
    },
  });
  const catOffice = await prisma.productCategory.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "Office Consumables" },
    },
    update: { code: "OFFC", sortOrder: 20 },
    create: {
      tenantId: tenant.id,
      name: "Office Consumables",
      code: "OFFC",
      sortOrder: 20,
    },
  });

  const divOperations = await prisma.productDivision.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "Operations" },
    },
    update: { code: "OPS", sortOrder: 10 },
    create: {
      tenantId: tenant.id,
      name: "Operations",
      code: "OPS",
      sortOrder: 10,
    },
  });
  const divProcurement = await prisma.productDivision.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "Procurement" },
    },
    update: { code: "PROC", sortOrder: 20 },
    create: {
      tenantId: tenant.id,
      name: "Procurement",
      code: "PROC",
      sortOrder: 20,
    },
  });

  const hqOffice = await prisma.supplierOffice.upsert({
    where: { supplierId_name: { supplierId: supplier.id, name: "Headquarters" } },
    update: {
      addressLine1: "100 Industrial Way",
      city: "Chicago",
      countryCode: "US",
    },
    create: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      name: "Headquarters",
      addressLine1: "100 Industrial Way",
      city: "Chicago",
      countryCode: "US",
    },
  });

  const prodPaper = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "OFF-PAPER-A4-500" } },
    update: {
      name: "Premium printer paper (A4, 500 sheets)",
      productCode: "PAPER-A4-500",
      unit: "ream",
      categoryId: catOffice.id,
      divisionId: divOperations.id,
      supplierOfficeId: hqOffice.id,
    },
    create: {
      tenantId: tenant.id,
      sku: "OFF-PAPER-A4-500",
      productCode: "PAPER-A4-500",
      name: "Premium printer paper (A4, 500 sheets)",
      description: "Office consumable — A4 white",
      unit: "ream",
      categoryId: catOffice.id,
      divisionId: divOperations.id,
      supplierOfficeId: hqOffice.id,
    },
  });
  const prodToner = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "OFF-TONER-GEN-1" } },
    update: {
      name: "Toner cartridges (generic)",
      productCode: "TONER-GEN",
      unit: "ea",
      categoryId: catOffice.id,
      divisionId: divOperations.id,
      supplierOfficeId: hqOffice.id,
    },
    create: {
      tenantId: tenant.id,
      sku: "OFF-TONER-GEN-1",
      productCode: "TONER-GEN",
      name: "Toner cartridges (generic)",
      description: "Office consumable",
      unit: "ea",
      categoryId: catOffice.id,
      divisionId: divOperations.id,
      supplierOfficeId: hqOffice.id,
    },
  });
  const prodCorrugated = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "PKG-CORR-ROLL" } },
    update: {
      name: "Corrugated rolls",
      productCode: "CORR-ROLL",
      unit: "roll",
      categoryId: catPackaging.id,
      divisionId: divProcurement.id,
      supplierOfficeId: hqOffice.id,
    },
    create: {
      tenantId: tenant.id,
      sku: "PKG-CORR-ROLL",
      productCode: "CORR-ROLL",
      name: "Corrugated rolls",
      description: "Packaging material",
      unit: "roll",
      categoryId: catPackaging.id,
      divisionId: divProcurement.id,
      supplierOfficeId: hqOffice.id,
    },
  });
  const prodPallet = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "PKG-PALLET-48" } },
    update: {
      name: "Standard shipping pallets (48x40)",
      productCode: "PALLET-4840",
      unit: "ea",
      categoryId: catPackaging.id,
      divisionId: divProcurement.id,
      supplierOfficeId: hqOffice.id,
    },
    create: {
      tenantId: tenant.id,
      sku: "PKG-PALLET-48",
      productCode: "PALLET-4840",
      name: "Standard shipping pallets (48x40)",
      description: "Packaging / logistics",
      unit: "ea",
      categoryId: catPackaging.id,
      divisionId: divProcurement.id,
      supplierOfficeId: hqOffice.id,
    },
  });

  for (const p of [prodPaper, prodToner, prodCorrugated, prodPallet]) {
    await prisma.productSupplier.upsert({
      where: {
        productId_supplierId: { productId: p.id, supplierId: supplier.id },
      },
      update: {},
      create: { productId: p.id, supplierId: supplier.id },
    });
  }

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

  const supplierDraft = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "DRAFT" } },
    update: { label: "Draft", sortOrder: 5, isStart: true, isEnd: false },
    create: {
      workflowId: supplierWorkflow.id,
      code: "DRAFT",
      label: "Draft",
      sortOrder: 5,
      isStart: true,
      isEnd: false,
    },
  });

  const supplierSent = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "SENT" } },
    update: { label: "Sent to Supplier", sortOrder: 10, isStart: false, isEnd: false },
    create: {
      workflowId: supplierWorkflow.id,
      code: "SENT",
      label: "Sent to Supplier",
      sortOrder: 10,
      isStart: false,
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
  const supplierFulfilled = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "FULFILLED" } },
    update: { label: "Fulfilled", sortOrder: 21, isEnd: true },
    create: {
      workflowId: supplierWorkflow.id,
      code: "FULFILLED",
      label: "Fulfilled",
      sortOrder: 21,
      isEnd: true,
    },
  });
  const supplierSplitPending = await prisma.workflowStatus.upsert({
    where: {
      workflowId_code: { workflowId: supplierWorkflow.id, code: "SPLIT_PENDING_BUYER" },
    },
    update: { label: "Split pending buyer", sortOrder: 25, isEnd: false },
    create: {
      workflowId: supplierWorkflow.id,
      code: "SPLIT_PENDING_BUYER",
      label: "Split pending buyer",
      sortOrder: 25,
    },
  });
  const supplierParentSplitComplete = await prisma.workflowStatus.upsert({
    where: {
      workflowId_code: { workflowId: supplierWorkflow.id, code: "PARENT_SPLIT_COMPLETE" },
    },
    update: { label: "Fulfilled via split children", sortOrder: 28, isEnd: true },
    create: {
      workflowId: supplierWorkflow.id,
      code: "PARENT_SPLIT_COMPLETE",
      label: "Fulfilled via split children",
      sortOrder: 28,
      isEnd: true,
    },
  });
  const supplierPendingChild = await prisma.workflowStatus.upsert({
    where: {
      workflowId_code: { workflowId: supplierWorkflow.id, code: "PENDING_BUYER_APPROVAL" },
    },
    update: { label: "Pending buyer approval (split)", sortOrder: 30, isEnd: false },
    create: {
      workflowId: supplierWorkflow.id,
      code: "PENDING_BUYER_APPROVAL",
      label: "Pending buyer approval (split)",
      sortOrder: 30,
    },
  });
  const supplierCancelled = await prisma.workflowStatus.upsert({
    where: { workflowId_code: { workflowId: supplierWorkflow.id, code: "CANCELLED" } },
    update: { label: "Cancelled", sortOrder: 35, isEnd: true },
    create: {
      workflowId: supplierWorkflow.id,
      code: "CANCELLED",
      label: "Cancelled",
      sortOrder: 35,
      isEnd: true,
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
      fromStatusId: supplierDraft.id,
      toStatusId: supplierSent.id,
      actionCode: "send_to_supplier",
      label: "Send to supplier",
      requiresComment: false,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierDraft.id,
      toStatusId: supplierCancelled.id,
      actionCode: "buyer_cancel",
      label: "Cancel order",
      requiresComment: true,
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
      toStatusId: supplierSplitPending.id,
      actionCode: "propose_split",
      label: "Propose split (detail)",
      requiresComment: false,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSent.id,
      toStatusId: supplierDeclined.id,
      actionCode: "decline",
      label: "Decline",
      requiresComment: true,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierConfirmed.id,
      toStatusId: supplierFulfilled.id,
      actionCode: "mark_fulfilled",
      label: "Mark fulfilled",
      requiresComment: false,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSent.id,
      toStatusId: supplierCancelled.id,
      actionCode: "buyer_cancel",
      label: "Cancel order",
      requiresComment: true,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierConfirmed.id,
      toStatusId: supplierCancelled.id,
      actionCode: "buyer_cancel",
      label: "Cancel order",
      requiresComment: true,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSplitPending.id,
      toStatusId: supplierSent.id,
      actionCode: "buyer_reject_proposal",
      label: "Reject split (buyer)",
      requiresComment: false,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSplitPending.id,
      toStatusId: supplierCancelled.id,
      actionCode: "buyer_cancel",
      label: "Cancel order",
      requiresComment: true,
    },
    {
      workflowId: supplierWorkflow.id,
      fromStatusId: supplierSplitPending.id,
      toStatusId: supplierParentSplitComplete.id,
      actionCode: "buyer_accept_split",
      label: "Accept split (buyer)",
      requiresComment: false,
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

  await prisma.workflowTransition.deleteMany({
    where: {
      workflowId: supplierWorkflow.id,
      actionCode: "split",
    },
  });

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
      buyerReference: "REQ-2026-0042",
      paymentTermsDays: 30,
      paymentTermsLabel: "Net 30",
      incoterm: "DDP",
      requestedDeliveryDate: new Date("2026-04-30T12:00:00.000Z"),
      shipToName: "Demo Company — Chicago HQ",
      shipToLine1: "200 Commerce Drive",
      shipToCity: "Chicago",
      shipToRegion: "IL",
      shipToPostalCode: "60654",
      shipToCountryCode: "US",
      internalNotes: "Budget owner: Operations. Split ship OK if backordered.",
      notesToSupplier: "Deliver to receiving dock B; call 30 min before arrival.",
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
      buyerReference: "CAPEX-PKG-18",
      supplierReference: "ACME-SO-77821",
      paymentTermsDays: 30,
      paymentTermsLabel: "Net 30",
      incoterm: "FOB",
      requestedDeliveryDate: new Date("2026-05-15T12:00:00.000Z"),
      shipToName: "Demo Company — Warehouse North",
      shipToLine1: "1 Logistics Way",
      shipToLine2: "Gate 3",
      shipToCity: "Milwaukee",
      shipToRegion: "WI",
      shipToPostalCode: "53202",
      shipToCountryCode: "US",
      internalNotes: "Q2 packaging stock-up; confirm pallet count before ship.",
      notesToSupplier: "FOB Chicago; use our carrier account # on BOL.",
    },
    {
      orderNumber: "PO-1003",
      title: "Contract Components (split proposal demo)",
      workflowId: supplierWorkflow.id,
      statusId: supplierSplitPending.id,
      requesterId: buyer.id,
      supplierId: supplier.id,
      subtotal: "3600.00",
      taxAmount: "360.00",
      totalAmount: "3960.00",
      buyerReference: "OPS-SPLIT-03",
      supplierReference: "ACME-SPLIT-991",
      paymentTermsDays: 30,
      paymentTermsLabel: "Net 30",
      incoterm: "FOB",
      requestedDeliveryDate: new Date("2026-05-20T12:00:00.000Z"),
      shipToName: "Demo Company — Assembly Plant",
      shipToLine1: "44 Manufacturing Ave",
      shipToCity: "Detroit",
      shipToRegion: "MI",
      shipToPostalCode: "48201",
      shipToCountryCode: "US",
      internalNotes: "Demonstrates pending split review for buyer.",
      notesToSupplier: "Propose split if partial shipments are required.",
    },
    {
      orderNumber: "PO-1004",
      title: "Hardware Fasteners (send demo)",
      workflowId: supplierWorkflow.id,
      statusId: supplierDraft.id,
      requesterId: buyer.id,
      supplierId: supplier.id,
      subtotal: "1800.00",
      taxAmount: "180.00",
      totalAmount: "1980.00",
      buyerReference: "MRO-FAST-17",
      paymentTermsDays: 30,
      paymentTermsLabel: "Net 30",
      incoterm: "EXW",
      requestedDeliveryDate: new Date("2026-05-10T12:00:00.000Z"),
      shipToName: "Demo Company — MRO Cage",
      shipToLine1: "200 Commerce Drive",
      shipToCity: "Chicago",
      shipToRegion: "IL",
      shipToPostalCode: "60654",
      shipToCountryCode: "US",
      internalNotes: "Use this order to demo Send to supplier action.",
      notesToSupplier: "Please acknowledge within 24h of receiving PO.",
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
        buyerReference: order.buyerReference ?? null,
        supplierReference: order.supplierReference ?? null,
        paymentTermsDays: order.paymentTermsDays ?? null,
        paymentTermsLabel: order.paymentTermsLabel ?? null,
        incoterm: order.incoterm ?? null,
        requestedDeliveryDate: order.requestedDeliveryDate ?? null,
        shipToName: order.shipToName ?? null,
        shipToLine1: order.shipToLine1 ?? null,
        shipToLine2: order.shipToLine2 ?? null,
        shipToCity: order.shipToCity ?? null,
        shipToRegion: order.shipToRegion ?? null,
        shipToPostalCode: order.shipToPostalCode ?? null,
        shipToCountryCode: order.shipToCountryCode ?? null,
        internalNotes: order.internalNotes ?? null,
        notesToSupplier: order.notesToSupplier ?? null,
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
        buyerReference: order.buyerReference ?? null,
        supplierReference: order.supplierReference ?? null,
        paymentTermsDays: order.paymentTermsDays ?? null,
        paymentTermsLabel: order.paymentTermsLabel ?? null,
        incoterm: order.incoterm ?? null,
        requestedDeliveryDate: order.requestedDeliveryDate ?? null,
        shipToName: order.shipToName ?? null,
        shipToLine1: order.shipToLine1 ?? null,
        shipToLine2: order.shipToLine2 ?? null,
        shipToCity: order.shipToCity ?? null,
        shipToRegion: order.shipToRegion ?? null,
        shipToPostalCode: order.shipToPostalCode ?? null,
        shipToCountryCode: order.shipToCountryCode ?? null,
        internalNotes: order.internalNotes ?? null,
        notesToSupplier: order.notesToSupplier ?? null,
      },
    });
  }

  const po1001 = await prisma.purchaseOrder.findFirst({
    where: { tenantId: tenant.id, orderNumber: "PO-1001" },
    select: { id: true },
  });
  const po1002 = await prisma.purchaseOrder.findFirst({
    where: { tenantId: tenant.id, orderNumber: "PO-1002" },
    select: { id: true },
  });
  const po1003 = await prisma.purchaseOrder.findFirst({
    where: { tenantId: tenant.id, orderNumber: "PO-1003" },
    select: { id: true },
  });
  const po1004 = await prisma.purchaseOrder.findFirst({
    where: { tenantId: tenant.id, orderNumber: "PO-1004" },
    select: { id: true },
  });

  if (po1001) {
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1001.id, lineNo: 1 } },
      update: {
        productId: prodPaper.id,
        description: "Printer paper (A4)",
        quantity: "100",
        unitPrice: "10.0000",
        lineTotal: "1000.00",
      },
      create: {
        orderId: po1001.id,
        lineNo: 1,
        productId: prodPaper.id,
        description: "Printer paper (A4)",
        quantity: "100",
        unitPrice: "10.0000",
        lineTotal: "1000.00",
      },
    });
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1001.id, lineNo: 2 } },
      update: {
        productId: prodToner.id,
        description: "Toner cartridges",
        quantity: "25",
        unitPrice: "10.0000",
        lineTotal: "250.00",
      },
      create: {
        orderId: po1001.id,
        lineNo: 2,
        productId: prodToner.id,
        description: "Toner cartridges",
        quantity: "25",
        unitPrice: "10.0000",
        lineTotal: "250.00",
      },
    });
  }

  if (po1002) {
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1002.id, lineNo: 1 } },
      update: {
        productId: prodCorrugated.id,
        description: "Corrugated rolls",
        quantity: "100",
        unitPrice: "25.0000",
        lineTotal: "2500.00",
      },
      create: {
        orderId: po1002.id,
        lineNo: 1,
        productId: prodCorrugated.id,
        description: "Corrugated rolls",
        quantity: "100",
        unitPrice: "25.0000",
        lineTotal: "2500.00",
      },
    });
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1002.id, lineNo: 2 } },
      update: {
        productId: prodPallet.id,
        description: "Pallets",
        quantity: "50",
        unitPrice: "50.0000",
        lineTotal: "2500.00",
      },
      create: {
        orderId: po1002.id,
        lineNo: 2,
        productId: prodPallet.id,
        description: "Pallets",
        quantity: "50",
        unitPrice: "50.0000",
        lineTotal: "2500.00",
      },
    });

    await prisma.orderChatMessage.deleteMany({ where: { orderId: po1002.id } });
    await prisma.orderChatMessage.createMany({
      data: [
        {
          orderId: po1002.id,
          authorUserId: buyer.id,
          body: "Please confirm corrugated spec matches last year's order.",
          isInternal: false,
        },
        {
          orderId: po1002.id,
          authorUserId: approver.id,
          body: "Internal: pricing approved under the annual frame agreement.",
          isInternal: true,
        },
      ],
    });

    await prisma.shipment.deleteMany({ where: { orderId: po1002.id } });
    const seededShipment = await prisma.shipment.create({
      data: {
        orderId: po1002.id,
        shipmentNo: "ASN-PO1002-1",
        shippedAt: new Date("2026-05-10T12:00:00.000Z"),
        carrier: "Demo Freight",
        trackingNo: "DF-77821-1",
        transportMode: "OCEAN",
        estimatedVolumeCbm: "18.500",
        estimatedWeightKg: "6200.000",
        notes: "Partial shipment for urgent demand.",
        createdById: supplierUser.id,
      },
      select: { id: true },
    });
    const po1002Line1 = await prisma.purchaseOrderItem.findUnique({
      where: { orderId_lineNo: { orderId: po1002.id, lineNo: 1 } },
      select: { id: true },
    });
    const po1002Line2 = await prisma.purchaseOrderItem.findUnique({
      where: { orderId_lineNo: { orderId: po1002.id, lineNo: 2 } },
      select: { id: true },
    });
    if (po1002Line1 && po1002Line2) {
      await prisma.shipmentItem.createMany({
        data: [
          {
            shipmentId: seededShipment.id,
            orderItemId: po1002Line1.id,
            quantityShipped: "40",
            quantityReceived: "0",
            plannedShipDate: new Date("2026-05-10T12:00:00.000Z"),
          },
          {
            shipmentId: seededShipment.id,
            orderItemId: po1002Line2.id,
            quantityShipped: "20",
            quantityReceived: "0",
            plannedShipDate: new Date("2026-05-10T12:00:00.000Z"),
          },
        ],
      });
    }
  }

  if (po1003) {
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1003.id, lineNo: 1 } },
      update: {
        productId: prodCorrugated.id,
        description: "Corrugated rolls",
        quantity: "80",
        unitPrice: "30.0000",
        lineTotal: "2400.00",
      },
      create: {
        orderId: po1003.id,
        lineNo: 1,
        productId: prodCorrugated.id,
        description: "Corrugated rolls",
        quantity: "80",
        unitPrice: "30.0000",
        lineTotal: "2400.00",
      },
    });
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1003.id, lineNo: 2 } },
      update: {
        productId: prodPallet.id,
        description: "Pallets",
        quantity: "24",
        unitPrice: "50.0000",
        lineTotal: "1200.00",
      },
      create: {
        orderId: po1003.id,
        lineNo: 2,
        productId: prodPallet.id,
        description: "Pallets",
        quantity: "24",
        unitPrice: "50.0000",
        lineTotal: "1200.00",
      },
    });

    await prisma.splitProposal.deleteMany({ where: { parentOrderId: po1003.id } });
    const proposal = await prisma.splitProposal.create({
      data: {
        parentOrderId: po1003.id,
        proposedByUserId: supplierUser.id,
        status: "PENDING",
        comment: "Can ship in two waves due to pallet lead time.",
      },
    });
    const po1003Line1 = await prisma.purchaseOrderItem.findUnique({
      where: { orderId_lineNo: { orderId: po1003.id, lineNo: 1 } },
      select: { id: true },
    });
    const po1003Line2 = await prisma.purchaseOrderItem.findUnique({
      where: { orderId_lineNo: { orderId: po1003.id, lineNo: 2 } },
      select: { id: true },
    });
    if (po1003Line1 && po1003Line2) {
      await prisma.splitProposalLine.createMany({
        data: [
          {
            proposalId: proposal.id,
            sourceLineId: po1003Line1.id,
            quantity: "50",
            childIndex: 1,
            plannedShipDate: new Date("2026-05-14T12:00:00.000Z"),
          },
          {
            proposalId: proposal.id,
            sourceLineId: po1003Line1.id,
            quantity: "30",
            childIndex: 2,
            plannedShipDate: new Date("2026-05-28T12:00:00.000Z"),
          },
          {
            proposalId: proposal.id,
            sourceLineId: po1003Line2.id,
            quantity: "12",
            childIndex: 1,
            plannedShipDate: new Date("2026-05-14T12:00:00.000Z"),
          },
          {
            proposalId: proposal.id,
            sourceLineId: po1003Line2.id,
            quantity: "12",
            childIndex: 2,
            plannedShipDate: new Date("2026-05-28T12:00:00.000Z"),
          },
        ],
      });
    }

    await prisma.orderTransitionLog.deleteMany({ where: { orderId: po1003.id } });
    await prisma.orderTransitionLog.createMany({
      data: [
        {
          orderId: po1003.id,
          fromStatusId: supplierDraft.id,
          toStatusId: supplierSent.id,
          actionCode: "send_to_supplier",
          actorUserId: buyer.id,
          comment: "Sent to supplier portal.",
        },
        {
          orderId: po1003.id,
          fromStatusId: supplierSent.id,
          toStatusId: supplierSplitPending.id,
          actionCode: "propose_split",
          actorUserId: supplierUser.id,
          comment: "Requesting two partial shipments.",
        },
      ],
    });

    await prisma.orderChatMessage.deleteMany({ where: { orderId: po1003.id } });
    await prisma.orderChatMessage.createMany({
      data: [
        {
          orderId: po1003.id,
          authorUserId: buyer.id,
          body: "Can you split this across two ship windows if needed?",
          isInternal: false,
        },
        {
          orderId: po1003.id,
          authorUserId: supplierUser.id,
          body: "Yes — proposed split submitted with dates.",
          isInternal: false,
        },
      ],
    });
  }

  if (po1004) {
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1004.id, lineNo: 1 } },
      update: {
        productId: prodPallet.id,
        description: "Fastener kit A",
        quantity: "300",
        unitPrice: "4.0000",
        lineTotal: "1200.00",
      },
      create: {
        orderId: po1004.id,
        lineNo: 1,
        productId: prodPallet.id,
        description: "Fastener kit A",
        quantity: "300",
        unitPrice: "4.0000",
        lineTotal: "1200.00",
      },
    });
    await prisma.purchaseOrderItem.upsert({
      where: { orderId_lineNo: { orderId: po1004.id, lineNo: 2 } },
      update: {
        productId: prodCorrugated.id,
        description: "Fastener kit B",
        quantity: "120",
        unitPrice: "5.0000",
        lineTotal: "600.00",
      },
      create: {
        orderId: po1004.id,
        lineNo: 2,
        productId: prodCorrugated.id,
        description: "Fastener kit B",
        quantity: "120",
        unitPrice: "5.0000",
        lineTotal: "600.00",
      },
    });

    await prisma.orderTransitionLog.deleteMany({ where: { orderId: po1004.id } });
    await prisma.orderChatMessage.deleteMany({ where: { orderId: po1004.id } });
    await prisma.orderChatMessage.create({
      data: {
        orderId: po1004.id,
        authorUserId: buyer.id,
        body: "Draft ready. Will send once final count is validated.",
        isInternal: false,
      },
    });
  }

  const primaryDraftLoad = await prisma.loadPlan.upsert({
    where: { tenantId_reference: { tenantId: tenant.id, reference: "LOAD-2026-001" } },
    update: {
      warehouseId: cfsShenzhen.id,
      transportMode: "OCEAN",
      containerSize: "FCL_20",
      plannedEta: new Date("2026-05-25T00:00:00.000Z"),
      status: "DRAFT",
      createdById: buyer.id,
    },
    create: {
      tenantId: tenant.id,
      reference: "LOAD-2026-001",
      warehouseId: cfsShenzhen.id,
      transportMode: "OCEAN",
      containerSize: "FCL_20",
      plannedEta: new Date("2026-05-25T00:00:00.000Z"),
      status: "DRAFT",
      createdById: buyer.id,
      notes: "Starter draft load for consolidation demo.",
    },
    select: { id: true },
  });
  await prisma.loadPlan.upsert({
    where: { tenantId_reference: { tenantId: tenant.id, reference: "LOAD-2026-002" } },
    update: {
      warehouseId: cfsRotterdam.id,
      transportMode: "OCEAN",
      containerSize: "FCL_40",
      plannedEta: new Date("2026-06-02T00:00:00.000Z"),
      status: "DRAFT",
      createdById: approver.id,
    },
    create: {
      tenantId: tenant.id,
      reference: "LOAD-2026-002",
      warehouseId: cfsRotterdam.id,
      transportMode: "OCEAN",
      containerSize: "FCL_40",
      plannedEta: new Date("2026-06-02T00:00:00.000Z"),
      status: "DRAFT",
      createdById: approver.id,
      notes: "Secondary draft for EU inbound planning.",
    },
  });
  await prisma.loadPlan.upsert({
    where: { tenantId_reference: { tenantId: tenant.id, reference: "LOAD-2026-003" } },
    update: {
      warehouseId: whLosAngeles.id,
      transportMode: "ROAD",
      containerSize: "TRUCK_13_6",
      plannedEta: new Date("2026-06-08T00:00:00.000Z"),
      status: "DRAFT",
      createdById: buyer.id,
    },
    create: {
      tenantId: tenant.id,
      reference: "LOAD-2026-003",
      warehouseId: whLosAngeles.id,
      transportMode: "ROAD",
      containerSize: "TRUCK_13_6",
      plannedEta: new Date("2026-06-08T00:00:00.000Z"),
      status: "DRAFT",
      createdById: buyer.id,
      notes: "US cross-dock placeholder.",
    },
  });

  // Ensure starter load has no stale assignment collisions.
  await prisma.loadPlanShipment.deleteMany({
    where: { loadPlan: { tenantId: tenant.id }, loadPlanId: primaryDraftLoad.id },
  });
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
