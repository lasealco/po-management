import Link from "next/link";
import { notFound } from "next/navigation";

import { GeographyGroupTraceBar } from "@/components/tariffs/geography-group-trace-bar";
import { GeographyGroupFormClient, type GeographyGroupFormValues } from "@/components/tariffs/geography-group-form-client";
import { GeographyMembersClient, type GeoMemberRow } from "@/components/tariffs/geography-members-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { tariffGeographyTypeLabel } from "@/lib/tariff/geography-labels";
import { getTariffGeographyGroupById } from "@/lib/tariff/geography-groups";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { TARIFF_GEOGRAPHY_PATH } from "@/lib/tariff/tariff-workbench-urls";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function TariffGeographyGroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  let group: Awaited<ReturnType<typeof getTariffGeographyGroupById>>;
  try {
    group = await getTariffGeographyGroupById(groupId);
  } catch (e) {
    if (e instanceof TariffRepoError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const initial: GeographyGroupFormValues = {
    geographyType: group.geographyType,
    name: group.name,
    code: group.code ?? "",
    aliasSource: group.aliasSource ?? "",
    validFrom: toDateInput(group.validFrom),
    validTo: toDateInput(group.validTo),
    active: group.active,
  };

  const members: GeoMemberRow[] = group.members.map((m) => ({
    id: m.id,
    memberCode: m.memberCode,
    memberName: m.memberName,
    memberType: m.memberType,
    validFrom: m.validFrom ? toDateInput(m.validFrom) : null,
    validTo: m.validTo ? toDateInput(m.validTo) : null,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 text-sm text-zinc-600">
        <Link href={TARIFF_GEOGRAPHY_PATH} className="font-medium text-[var(--arscmp-primary)] hover:underline">
          Geography groups
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        <span className="text-zinc-900">{group.name}</span>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Group</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">{group.name}</h1>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
            {tariffGeographyTypeLabel(group.geographyType)}
          </span>
          {!group.active ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Inactive</span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Valid {toDateInput(group.validFrom) || "—"} → {toDateInput(group.validTo) || "—"} · Created{" "}
          {group.createdAt.toISOString().slice(0, 10)}
        </p>
        <GeographyGroupTraceBar groupId={group.id} />

        <div className="mt-8">
          <GeographyGroupFormClient
            key={group.id}
            mode="edit"
            canEdit={canEdit}
            groupId={group.id}
            initial={initial}
          />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Members</p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">Codes in this group</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {members.length} member{members.length === 1 ? "" : "s"} — ports, countries, or other geography codes.
        </p>
        <div className="mt-6">
          <GeographyMembersClient groupId={group.id} canEdit={canEdit} members={members} />
        </div>
      </section>
    </main>
  );
}
