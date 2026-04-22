import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


async function getContactOr404(
  supplierId: string,
  contactId: string,
  tenantId: string,
) {
  return prisma.supplierContact.findFirst({
    where: { id: contactId, supplierId, tenantId },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; contactId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, contactId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await getContactOr404(supplierId, contactId, tenant.id);
  if (!existing) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }

  const o = body as Record<string, unknown>;
  const data: {
    name?: string;
    title?: string | null;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    isPrimary?: boolean;
  } = {};

  if (o.name !== undefined) {
    if (typeof o.name !== "string" || !o.name.trim()) {
      return toApiErrorResponse({ error: "Invalid name.", code: "BAD_INPUT", status: 400 });
    }
    data.name = o.name.trim();
  }
  const strOrNull = (v: unknown) => {
    if (v === null) return null;
    if (typeof v === "string") {
      const t = v.trim();
      return t.length ? t : null;
    }
    return undefined;
  };
  if (o.title !== undefined) {
    const t = strOrNull(o.title);
    if (t === undefined) {
      return toApiErrorResponse({ error: "Invalid title.", code: "BAD_INPUT", status: 400 });
    }
    data.title = t;
  }
  if (o.role !== undefined) {
    const t = strOrNull(o.role);
    if (t === undefined) {
      return toApiErrorResponse({ error: "Invalid role.", code: "BAD_INPUT", status: 400 });
    }
    data.role = t;
  }
  if (o.email !== undefined) {
    const t = strOrNull(o.email);
    if (t === undefined) {
      return toApiErrorResponse({ error: "Invalid email.", code: "BAD_INPUT", status: 400 });
    }
    data.email = t;
  }
  if (o.phone !== undefined) {
    const t = strOrNull(o.phone);
    if (t === undefined) {
      return toApiErrorResponse({ error: "Invalid phone.", code: "BAD_INPUT", status: 400 });
    }
    data.phone = t;
  }
  if (o.notes !== undefined) {
    const t = strOrNull(o.notes);
    if (t === undefined) {
      return toApiErrorResponse({ error: "Invalid notes.", code: "BAD_INPUT", status: 400 });
    }
    data.notes = t;
  }
  if (o.isPrimary !== undefined) {
    data.isPrimary = Boolean(o.isPrimary);
  }

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No valid fields to update.", code: "BAD_INPUT", status: 400 });
  }

  const contact = await prisma.$transaction(async (tx) => {
    if (data.isPrimary === true) {
      await tx.supplierContact.updateMany({
        where: { supplierId },
        data: { isPrimary: false },
      });
    }
    return tx.supplierContact.update({
      where: { id: contactId },
      data,
    });
  });

  return NextResponse.json({ contact });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; contactId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, contactId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await getContactOr404(supplierId, contactId, tenant.id);
  if (!existing) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  await prisma.supplierContact.delete({ where: { id: contactId } });
  return NextResponse.json({ ok: true });
}
