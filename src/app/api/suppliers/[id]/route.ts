import { NextResponse } from "next/server";
import { Prisma, SrmOnboardingStage, SrmSupplierCategory, SupplierApprovalStatus } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  getActorUserId,
  loadGlobalGrantsForUser,
  requireApiGrant,
  viewerHas,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { optionalStringField } from "@/lib/supplier-patch";
import { prisma } from "@/lib/prisma";
import { assertSupplierApprovalTransition } from "@/lib/srm/supplier-approval-transitions";

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
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    include: supplierDetailInclude,
  });

  if (!supplier) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = await getActorUserId();
  const grantSet = actorId ? await loadGlobalGrantsForUser(actorId) : new Set<string>();
  const canViewSensitive =
    viewerHas(grantSet, "org.suppliers", "edit") || viewerHas(grantSet, "org.suppliers", "approve");

  const bodySupplier = {
    ...supplier,
    internalNotes: canViewSensitive ? supplier.internalNotes : null,
  };

  return NextResponse.json({ supplier: bodySupplier });
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
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, approvalStatus: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const grantSet = await loadGlobalGrantsForUser(actorId);
  const canApprove = viewerHas(grantSet, "org.suppliers", "approve");

  const o = body as Record<string, unknown>;
  if (
    (o.isActive !== undefined || o.approvalStatus !== undefined) &&
    !canApprove
  ) {
    return toApiErrorResponse({ error: "Changing activation or approval status requires org.suppliers → approve.", code: "FORBIDDEN", status: 403 });
  }

  const data: Prisma.SupplierUpdateInput = {};

  if (o.name !== undefined) {
    if (typeof o.name !== "string" || !o.name.trim()) {
      return toApiErrorResponse({ error: "Invalid name.", code: "BAD_INPUT", status: 400 });
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
        return toApiErrorResponse({ error: "Invalid approvalStatus.", code: "BAD_INPUT", status: 400 });
      }
    } else {
      return toApiErrorResponse({ error: "Invalid approvalStatus.", code: "BAD_INPUT", status: 400 });
    }
  }

  if (o.srmOnboardingStage !== undefined) {
    const v = o.srmOnboardingStage;
    if (v === SrmOnboardingStage.intake || v === "intake") {
      data.srmOnboardingStage = SrmOnboardingStage.intake;
    } else if (v === SrmOnboardingStage.diligence || v === "diligence") {
      data.srmOnboardingStage = SrmOnboardingStage.diligence;
    } else if (v === SrmOnboardingStage.review || v === "review") {
      data.srmOnboardingStage = SrmOnboardingStage.review;
    } else if (v === SrmOnboardingStage.cleared || v === "cleared") {
      data.srmOnboardingStage = SrmOnboardingStage.cleared;
    } else {
      return toApiErrorResponse({
        error: "Invalid srmOnboardingStage (intake, diligence, review, cleared).",
        code: "BAD_INPUT",
        status: 400,
      });
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
        return toApiErrorResponse({ error: "Invalid srmCategory.", code: "BAD_INPUT", status: 400 });
      }
    } else {
      return toApiErrorResponse({ error: "Invalid srmCategory.", code: "BAD_INPUT", status: 400 });
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
      return toApiErrorResponse({ error: "Invalid registeredCountryCode.", code: "BAD_INPUT", status: 400 });
    }
  }

  if ("creditCurrency" in o) {
    const v = o.creditCurrency;
    if (v === null) {
      data.creditCurrency = null;
    } else if (typeof v === "string") {
      const t = v.trim().toUpperCase();
      if (t.length !== 3 && t.length !== 0) {
        return toApiErrorResponse({ error: "creditCurrency must be a 3-letter ISO code.", code: "BAD_INPUT", status: 400 });
      }
      data.creditCurrency = t.length ? t : null;
    } else {
      return toApiErrorResponse({ error: "Invalid creditCurrency.", code: "BAD_INPUT", status: 400 });
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
      return toApiErrorResponse({ error: "Invalid paymentTermsDays.", code: "BAD_INPUT", status: 400 });
    }
  }

  if ("bookingConfirmationSlaHours" in o) {
    const v = o.bookingConfirmationSlaHours;
    if (v === null) {
      data.bookingConfirmationSlaHours = null;
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 8760) {
      data.bookingConfirmationSlaHours = v;
    } else {
      return toApiErrorResponse({
        error: "bookingConfirmationSlaHours must be null or an integer from 1 to 8760.",
        code: "BAD_INPUT",
        status: 400,
      });
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
            return toApiErrorResponse({ error: "creditLimit must be non-negative.", code: "BAD_INPUT", status: 400 });
          }
          data.creditLimit = d;
        } catch {
          return toApiErrorResponse({ error: "Invalid creditLimit.", code: "BAD_INPUT", status: 400 });
        }
      }
    } else {
      return toApiErrorResponse({ error: "Invalid creditLimit.", code: "BAD_INPUT", status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No valid fields to update.", code: "BAD_INPUT", status: 400 });
  }

  if (data.approvalStatus !== undefined) {
    const transition = assertSupplierApprovalTransition(
      existing.approvalStatus,
      data.approvalStatus as SupplierApprovalStatus,
    );
    if (!transition.ok) {
      return toApiErrorResponse({ error: transition.error, code: "BAD_INPUT", status: 400 });
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
      return toApiErrorResponse({ error: "Supplier code must be unique per tenant.", code: "CONFLICT", status: 409 });
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
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      _count: { select: { orders: true } },
    },
  });
  if (!supplier) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }
  if (supplier._count.orders > 0) {
    return toApiErrorResponse({ error: "Supplier has purchase orders and cannot be deleted. Set inactive instead.", code: "BAD_INPUT", status: 400 });
  }

  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
