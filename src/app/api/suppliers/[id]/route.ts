import { NextResponse } from "next/server";
import { Prisma, SrmSupplierCategory, SupplierApprovalStatus } from "@prisma/client";
import {
  getActorUserId,
  loadGlobalGrantsForUser,
  requireApiGrant,
  viewerHas,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";
import { assertOnboardingCompleteForApprovedActivation } from "@/lib/srm/supplier-onboarding-activation-guard";
import { parseSupplierQualificationFields } from "@/lib/srm/supplier-qualification-patch";
import { optionalStringField } from "@/lib/supplier-patch";
import { prisma } from "@/lib/prisma";

const supplierDetailInclude = {
  offices: { orderBy: { name: "asc" as const } },
  contacts: {
    orderBy: [
      { isPrimary: "desc" as const },
      { name: "asc" as const },
    ],
  },
  _count: { select: { productSuppliers: true, orders: true } },
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    include: supplierDetailInclude,
  });

  if (!supplier) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ supplier });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  const grantSet = await loadGlobalGrantsForUser(actorId);
  const canApprove = viewerHas(grantSet, "org.suppliers", "approve");

  const o = body as Record<string, unknown>;
  if (
    (o.isActive !== undefined || o.approvalStatus !== undefined) &&
    !canApprove
  ) {
    return NextResponse.json(
      {
        error:
          "Changing activation or approval status requires org.suppliers → approve.",
      },
      { status: 403 },
    );
  }

  const data: Prisma.SupplierUpdateInput = {};

  if (o.name !== undefined) {
    if (typeof o.name !== "string" || !o.name.trim()) {
      return NextResponse.json({ error: "Invalid name." }, { status: 400 });
    }
    data.name = o.name.trim();
  }
  if (o.code !== undefined) {
    data.code =
      typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
  }
  if (o.email !== undefined) {
    data.email =
      typeof o.email === "string" && o.email.trim() ? o.email.trim() : null;
  }
  if (o.phone !== undefined) {
    data.phone =
      typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null;
  }
  if (o.isActive !== undefined) {
    data.isActive = Boolean(o.isActive);
  }

  if (o.approvalStatus !== undefined) {
    const v = o.approvalStatus;
    if (v === SupplierApprovalStatus.pending_approval) {
      data.approvalStatus = SupplierApprovalStatus.pending_approval;
    } else if (v === SupplierApprovalStatus.approved) {
      data.approvalStatus = SupplierApprovalStatus.approved;
    } else if (v === SupplierApprovalStatus.rejected) {
      data.approvalStatus = SupplierApprovalStatus.rejected;
    } else if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "pending_approval") {
        data.approvalStatus = SupplierApprovalStatus.pending_approval;
      } else if (t === "approved") {
        data.approvalStatus = SupplierApprovalStatus.approved;
      } else if (t === "rejected") {
        data.approvalStatus = SupplierApprovalStatus.rejected;
      } else {
        return NextResponse.json(
          { error: "Invalid approvalStatus." },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid approvalStatus." },
        { status: 400 },
      );
    }
  }

  if (o.srmCategory !== undefined) {
    const v = o.srmCategory;
    if (v === SrmSupplierCategory.product || v === SrmSupplierCategory.logistics) {
      data.srmCategory = v;
    } else if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "product") data.srmCategory = SrmSupplierCategory.product;
      else if (t === "logistics") data.srmCategory = SrmSupplierCategory.logistics;
      else {
        return NextResponse.json(
          { error: "Invalid srmCategory." },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid srmCategory." },
        { status: 400 },
      );
    }
  }

  const stringKeys = [
    "legalName",
    "taxId",
    "website",
    "registeredAddressLine1",
    "registeredAddressLine2",
    "registeredCity",
    "registeredRegion",
    "registeredPostalCode",
    "paymentTermsLabel",
    "defaultIncoterm",
    "internalNotes",
  ] as const;
  for (const key of stringKeys) {
    const v = optionalStringField(o, key);
    if (v !== undefined) data[key] = v;
  }

  if ("registeredCountryCode" in o) {
    const v = o.registeredCountryCode;
    if (v === null) {
      data.registeredCountryCode = null;
    } else if (typeof v === "string") {
      const t = v.trim().toUpperCase();
      data.registeredCountryCode = t.length === 2 ? t : null;
    } else {
      return NextResponse.json(
        { error: "Invalid registeredCountryCode." },
        { status: 400 },
      );
    }
  }

  if ("creditCurrency" in o) {
    const v = o.creditCurrency;
    if (v === null) {
      data.creditCurrency = null;
    } else if (typeof v === "string") {
      const t = v.trim().toUpperCase();
      if (t.length !== 3 && t.length !== 0) {
        return NextResponse.json(
          { error: "creditCurrency must be a 3-letter ISO code." },
          { status: 400 },
        );
      }
      data.creditCurrency = t.length ? t : null;
    } else {
      return NextResponse.json(
        { error: "Invalid creditCurrency." },
        { status: 400 },
      );
    }
  }

  if ("paymentTermsDays" in o) {
    const v = o.paymentTermsDays;
    if (v === null) {
      data.paymentTermsDays = null;
    } else if (
      typeof v === "number" &&
      Number.isInteger(v) &&
      v >= 0 &&
      v <= 3650
    ) {
      data.paymentTermsDays = v;
    } else {
      return NextResponse.json(
        { error: "Invalid paymentTermsDays." },
        { status: 400 },
      );
    }
  }

  if ("creditLimit" in o) {
    const v = o.creditLimit;
    if (v === null) {
      data.creditLimit = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      data.creditLimit = new Prisma.Decimal(v);
    } else if (typeof v === "string") {
      const t = v.trim();
      if (!t) {
        data.creditLimit = null;
      } else {
        try {
          const d = new Prisma.Decimal(t);
          if (d.lt(0)) {
            return NextResponse.json(
              { error: "creditLimit must be non-negative." },
              { status: 400 },
            );
          }
          data.creditLimit = d;
        } catch {
          return NextResponse.json(
            { error: "Invalid creditLimit." },
            { status: 400 },
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: "Invalid creditLimit." },
        { status: 400 },
      );
    }
  }

  const qualParse = parseSupplierQualificationFields(o);
  if (qualParse.kind === "error") {
    return NextResponse.json({ error: qualParse.message }, { status: 400 });
  }
  if (qualParse.kind === "ok") {
    Object.assign(data, qualParse.data);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 },
    );
  }

  if (canApprove && (data.isActive !== undefined || data.approvalStatus !== undefined)) {
    const current = await prisma.supplier.findFirst({
      where: { id, tenantId: tenant.id },
      select: { isActive: true, approvalStatus: true },
    });
    if (current) {
      const nextActive =
        data.isActive !== undefined ? Boolean(data.isActive) : current.isActive;
      const nextApproval: SupplierApprovalStatus =
        data.approvalStatus !== undefined
          ? (data.approvalStatus as SupplierApprovalStatus)
          : current.approvalStatus;
      const wasFullyActivated =
        current.isActive && current.approvalStatus === SupplierApprovalStatus.approved;
      const willBeFullyActivated =
        nextActive && nextApproval === SupplierApprovalStatus.approved;
      if (willBeFullyActivated && !wasFullyActivated) {
        await ensureSupplierOnboardingTasks(prisma, tenant.id, id);
        const tasks = await prisma.supplierOnboardingTask.findMany({
          where: { supplierId: id, tenantId: tenant.id },
          select: { status: true, taskKey: true, label: true, sortOrder: true },
        });
        const gate = assertOnboardingCompleteForApprovedActivation(tasks);
        if (!gate.ok) {
          return NextResponse.json(
            {
              error: gate.message,
              onboarding: {
                pendingCount: gate.pendingCount,
                pendingTasks: gate.pendingTasks,
              },
            },
            { status: 409 },
          );
        }
      }
    }
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data,
      include: supplierDetailInclude,
    });
    return NextResponse.json({ supplier });
  } catch (e: unknown) {
    const codeErr =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (codeErr === "P2002") {
      return NextResponse.json(
        { error: "Supplier code must be unique per tenant." },
        { status: 409 },
      );
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      _count: { select: { orders: true } },
    },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (supplier._count.orders > 0) {
    return NextResponse.json(
      {
        error:
          "Supplier has purchase orders and cannot be deleted. Set inactive instead.",
      },
      { status: 400 },
    );
  }

  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
