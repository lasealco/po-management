import { AccessDenied } from "@/components/access-denied";
import { ScriRiskSettingsClient } from "@/components/risk-intelligence/scri-risk-settings-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getScriTuningForTenant } from "@/lib/scri/tuning-repo";
import { listWatchlistRulesForTenant } from "@/lib/scri/watchlist-repo";

export const dynamic = "force-dynamic";

export default async function RiskIntelligenceSettingsPage() {
  const access = await getViewerGrantSet();

  if (!access?.user) {
    return (
      <AccessDenied
        title="Settings"
        message="Choose an active demo user first (Settings → Demo session)."
      />
    );
  }

  if (!viewerHas(access.grantSet, "org.scri", "view")) {
    return (
      <AccessDenied
        title="Risk intelligence settings"
        message="You need org.scri → view to open this page."
      />
    );
  }

  const { row, dto } = await getScriTuningForTenant(access.tenant.id);
  const initialRules = await listWatchlistRulesForTenant(access.tenant.id);
  const users = await prisma.user.findMany({
    where: { tenantId: access.tenant.id, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 120,
  });

  const canEdit = viewerHas(access.grantSet, "org.scri", "edit");

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Risk intelligence</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Watchlist rules, source-trust floors, geography aliases, and optional auto-watch after ingest.
        </p>
      </div>
      {!row ? (
        <p className="text-sm text-zinc-500">
          No saved tuning yet — defaults apply until you save (geo aliases empty, automation off).
        </p>
      ) : null}
      <ScriRiskSettingsClient
        initialTuning={{ ...dto, persisted: Boolean(row) }}
        initialRules={initialRules}
        users={users}
        canEdit={canEdit}
      />
    </div>
  );
}
