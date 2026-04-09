import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsRolesPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run:</p>
        <p className="mt-1 font-mono text-sm">npm run db:seed</p>
      </div>
    );
  }

  const roles = await prisma.role.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isSystem: true,
      createdAt: true,
      _count: {
        select: {
          users: true,
          permissions: true,
        },
      },
    },
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Roles</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Named roles attach permissions (workflow actions, resources). Editing
        rules here is not wired yet.
      </p>

      <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">System</th>
              <th className="px-3 py-2 font-medium text-right">Users</th>
              <th className="px-3 py-2 font-medium text-right">Permissions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {roles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                  No roles yet. Run{" "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                    npm run db:seed
                  </code>{" "}
                  to create demo roles.
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id} className="text-zinc-800">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-zinc-600">
                    {r.isSystem ? "Yes" : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r._count.users}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r._count.permissions}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
