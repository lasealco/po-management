import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, loadGlobalGrantsForUser, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { canViewSupplierSensitiveFieldsForGrantSet } from "@/lib/srm/permissions";
import { redactSupplierRecordForView } from "@/lib/srm/redact-supplier-sensitive";
import type { SrmSupplierCategory } from "@prisma/client";

export const runtime = "nodejs";

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const kind = url.searchParams.get("kind");
  const where: { tenantId: string; srmCategory?: SrmSupplierCategory } = { tenantId: tenant.id };
  if (kind === "logistics") where.srmCategory = "logistics";
  if (kind === "product") where.srmCategory = "product";

  const rows = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      isActive: true,
      srmCategory: true,
      approvalStatus: true,
      updatedAt: true,
    },
  });

  const actorId = await getActorUserId();
  const grantSet = actorId ? await loadGlobalGrantsForUser(actorId) : new Set<string>();
  const canViewSensitive = canViewSupplierSensitiveFieldsForGrantSet(grantSet);
  const safeRows = rows.map((r) =>
    redactSupplierRecordForView(r as unknown as Record<string, unknown>, canViewSensitive),
  ) as typeof rows;

  if (format === "json") {
    return NextResponse.json({ schemaVersion: 1, kind: kind ?? "all", suppliers: safeRows });
  }

  const header = ["id", "name", "code", "email", "phone", "isActive", "srmCategory", "approvalStatus", "updatedAt"];
  const lines = [
    header.join(","),
    ...safeRows.map((r) =>
      [
        escapeCsvCell(r.id),
        escapeCsvCell(r.name),
        escapeCsvCell(r.code ?? ""),
        escapeCsvCell(r.email ?? ""),
        escapeCsvCell(r.phone ?? ""),
        String(r.isActive),
        escapeCsvCell(r.srmCategory),
        escapeCsvCell(r.approvalStatus),
        escapeCsvCell(r.updatedAt.toISOString()),
      ].join(","),
    ),
  ];
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="srm-suppliers-${kind ?? "all"}.csv"`,
    },
  });
}
