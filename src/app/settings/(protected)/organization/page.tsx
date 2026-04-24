import { SettingsOrganizationForm } from "@/components/settings-organization-form";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsOrganizationPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  const [userCount, contactCount] = await Promise.all([
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.crmContact.count({ where: { tenantId: tenant.id } }),
  ]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Company profile</h2>
      <p className="mt-1 text-sm text-zinc-600">
        How your organization appears in the app. All users share this tenant. Use the sections below for legal
        identity, address, contact links, and shortcuts to users and CRM contacts.
      </p>
      <div className="mt-8">
        <SettingsOrganizationForm tenant={tenant} userCount={userCount} contactCount={contactCount} />
      </div>
    </div>
  );
}
