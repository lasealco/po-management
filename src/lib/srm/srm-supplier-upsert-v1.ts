import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";
import {
  buildSupplierCreateDataFromIntegrationJson,
  buildSupplierUpdateInputFromIntegrationJson,
} from "@/lib/srm/srm-supplier-integration-prisma";

export const SRM_SUPPLIER_UPSERT_V1_SCHEMA = "srm_supplier_upsert_v1" as const;

const responseSelect = {
  id: true,
  name: true,
  code: true,
  email: true,
  phone: true,
  isActive: true,
  srmCategory: true,
  approvalStatus: true,
  updatedAt: true,
  legalName: true,
  taxId: true,
  website: true,
  bookingConfirmationSlaHours: true,
} as const;

export type SrmSupplierUpsertV1Body = {
  schemaVersion: 1;
  match?: { id?: string; code?: string };
  supplier: Record<string, unknown>;
};

export function parseSrmSupplierUpsertV1Body(body: unknown):
  | { ok: true; value: SrmSupplierUpsertV1Body }
  | { ok: false; response: NextResponse } {
  if (!body || typeof body !== "object") {
    return { ok: false, response: toApiErrorResponse({ error: "Expected JSON object.", code: "BAD_INPUT", status: 400 }) };
  }
  const o = body as Record<string, unknown>;
  if (o.schemaVersion !== 1) {
    return {
      ok: false,
      response: toApiErrorResponse({ error: "schemaVersion must be 1.", code: "BAD_INPUT", status: 400 }),
    };
  }
  if (!o.supplier || typeof o.supplier !== "object") {
    return { ok: false, response: toApiErrorResponse({ error: "supplier object is required.", code: "BAD_INPUT", status: 400 }) };
  }
  const m = o.match;
  if (m !== undefined) {
    if (m === null || typeof m !== "object") {
      return { ok: false, response: toApiErrorResponse({ error: "match must be an object when provided.", code: "BAD_INPUT", status: 400 }) };
    }
    const { id, code } = m as Record<string, unknown>;
    if (id !== undefined && typeof id !== "string") {
      return { ok: false, response: toApiErrorResponse({ error: "match.id must be a string.", code: "BAD_INPUT", status: 400 }) };
    }
    if (code !== undefined && typeof code !== "string" && code !== null) {
      return { ok: false, response: toApiErrorResponse({ error: "match.code must be a string.", code: "BAD_INPUT", status: 400 }) };
    }
  }
  return { ok: true, value: o as SrmSupplierUpsertV1Body };
}

export async function runSrmSupplierUpsertV1(
  prisma: PrismaClient,
  args: {
    tenantId: string;
    body: SrmSupplierUpsertV1Body;
    canApprove: boolean;
  },
): Promise<NextResponse> {
  const { tenantId, canApprove } = args;
  const { match, supplier: sup } = args.body;
  const o = sup;

  if (match?.id) {
    const existing = await prisma.supplier.findFirst({
      where: { id: match.id, tenantId },
      select: { id: true, approvalStatus: true },
    });
    if (!existing) {
      return toApiErrorResponse({ error: "Supplier not found for match.id.", code: "NOT_FOUND", status: 404 });
    }
    const built = buildSupplierUpdateInputFromIntegrationJson(o, existing.approvalStatus, canApprove);
    if (!built.ok) {
      return toApiErrorResponse(built.err);
    }
    try {
      const supplier = await prisma.supplier.update({
        where: { id: existing.id },
        data: built.data,
        select: responseSelect,
      });
      return NextResponse.json({
        ok: true,
        schema: SRM_SUPPLIER_UPSERT_V1_SCHEMA,
        mode: "updated",
        supplier,
      });
    } catch (e: unknown) {
      const codeErr = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : null;
      if (codeErr === "P2002") {
        return toApiErrorResponse({ error: "Supplier code must be unique per tenant.", code: "CONFLICT", status: 409 });
      }
      throw e;
    }
  }

  if (match && "code" in match && match.code != null) {
    const code = String(match.code).trim();
    if (!code) {
      return toApiErrorResponse({ error: "match.code must be a non-empty string when used.", code: "BAD_INPUT", status: 400 });
    }
    const existing = await prisma.supplier.findFirst({
      where: { tenantId, code },
      select: { id: true, approvalStatus: true },
    });
    if (existing) {
      const built = buildSupplierUpdateInputFromIntegrationJson(o, existing.approvalStatus, canApprove);
      if (!built.ok) {
        return toApiErrorResponse(built.err);
      }
      try {
        const supplier = await prisma.supplier.update({
          where: { id: existing.id },
          data: built.data,
          select: responseSelect,
        });
        return NextResponse.json({
          ok: true,
          schema: SRM_SUPPLIER_UPSERT_V1_SCHEMA,
          mode: "updated",
          supplier,
        });
      } catch (e: unknown) {
        const codeErr = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : null;
        if (codeErr === "P2002") {
          return toApiErrorResponse({ error: "Supplier code must be unique per tenant.", code: "CONFLICT", status: 409 });
        }
        throw e;
      }
    }
    const created = buildSupplierCreateDataFromIntegrationJson(
      { ...o, code, name: o.name !== undefined ? o.name : `Partner ${code}` },
      canApprove,
    );
    if (!created.ok) {
      return toApiErrorResponse(created.err);
    }
    try {
      const supplier = await prisma.supplier.create({
        data: { ...created.data, tenantId },
        select: responseSelect,
      });
      await ensureSupplierOnboardingTasks(prisma, tenantId, supplier.id);
      return NextResponse.json(
        { ok: true, schema: SRM_SUPPLIER_UPSERT_V1_SCHEMA, mode: "created", supplier },
        { status: 201 },
      );
    } catch (e: unknown) {
      const codeErr = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : null;
      if (codeErr === "P2002") {
        return toApiErrorResponse({ error: "Supplier code must be unique per tenant.", code: "CONFLICT", status: 409 });
      }
      throw e;
    }
  }

  // Create without code match
  const created = buildSupplierCreateDataFromIntegrationJson(o, canApprove);
  if (!created.ok) {
    return toApiErrorResponse(created.err);
  }
  try {
    const supplier = await prisma.supplier.create({
      data: { ...created.data, tenantId },
      select: responseSelect,
    });
    await ensureSupplierOnboardingTasks(prisma, tenantId, supplier.id);
    return NextResponse.json(
      { ok: true, schema: SRM_SUPPLIER_UPSERT_V1_SCHEMA, mode: "created", supplier },
      { status: 201 },
    );
  } catch (e: unknown) {
    const codeErr = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : null;
    if (codeErr === "P2002") {
      return toApiErrorResponse({ error: "Supplier code must be unique per tenant.", code: "CONFLICT", status: 409 });
    }
    throw e;
  }
}
