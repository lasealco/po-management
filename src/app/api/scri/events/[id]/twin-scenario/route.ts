import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { getScriEventForTenant } from "@/lib/scri/event-repo";
import { buildTwinScenarioDraftFromScriEvent } from "@/lib/scri/twin-bridge/build-twin-scenario-draft-from-scri-event";
import { upsertRiskSignalByCodeForTenant } from "@/lib/supply-chain-twin/risk-signals-repo";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

/**
 * Launch a Supply Chain Twin scenario draft from a SCRI event (R6): upsert twin risk signal,
 * append ingest audit row, create scenario draft with {@link buildTwinScenarioDraftFromScriEvent}.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const scriGate = await requireApiGrant("org.scri", "edit");
  if (scriGate) return scriGate;

  const twinGate = await requireTwinApiAccess();
  if (!twinGate.ok) {
    return toApiErrorResponse({
      error: twinGate.denied.error,
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  if (twinGate.access.tenant.id !== tenant.id) {
    return toApiErrorResponse({ error: "Tenant mismatch for twin session.", code: "FORBIDDEN", status: 403 });
  }

  const { id: eventId } = await ctx.params;
  const event = await getScriEventForTenant(tenant.id, eventId);
  if (!event) {
    return toApiErrorResponse({ error: "Event not found.", code: "NOT_FOUND", status: 404 });
  }

  const built = buildTwinScenarioDraftFromScriEvent(event, event.geographies, event.affectedEntities);

  const actorId = twinGate.access.user.id;

  const { scenario, riskSignal, ingestEventId } = await prisma.$transaction(async (tx) => {
    const riskSignalRow = await upsertRiskSignalByCodeForTenant(
      tenant.id,
      {
        code: built.draft.twin.riskSignalCode,
        severity: event.severity,
        title: built.riskSignalTitle,
        detail: built.riskSignalDetail,
      },
      tx,
    );

    const scenarioRow = await tx.supplyChainTwinScenarioDraft.create({
      data: {
        tenantId: tenant.id,
        title: built.title,
        status: "draft",
        draftJson: built.draft as Prisma.InputJsonValue,
      },
      select: { id: true, title: true, status: true, updatedAt: true },
    });

    await tx.supplyChainTwinScenarioRevision.create({
      data: {
        tenantId: tenant.id,
        scenarioDraftId: scenarioRow.id,
        actorId,
        action: "create",
        titleBefore: null,
        titleAfter: scenarioRow.title,
        statusBefore: null,
        statusAfter: scenarioRow.status,
      },
    });

    const ingestRow = await tx.supplyChainTwinIngestEvent.create({
      data: {
        tenantId: tenant.id,
        type: "scri_scenario_launch",
        payloadJson: {
          scriEventId: event.id,
          scenarioDraftId: scenarioRow.id,
          riskSignalId: riskSignalRow.id,
          riskSignalCode: riskSignalRow.code,
          proto: built.draft.proto,
        },
      },
      select: { id: true },
    });

    return {
      scenario: scenarioRow,
      riskSignal: riskSignalRow,
      ingestEventId: ingestRow.id,
    };
  });

  return NextResponse.json({
    ok: true,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      status: scenario.status,
      updatedAt: scenario.updatedAt.toISOString(),
    },
    riskSignal: { id: riskSignal.id, code: riskSignal.code },
    twinIngestEventId: ingestEventId,
    scenarioPath: `/supply-chain-twin/scenarios/${scenario.id}`,
  });
}
