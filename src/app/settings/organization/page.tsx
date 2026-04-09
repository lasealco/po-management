import { SettingsOrganizationForm } from "@/components/settings-organization-form";
import { getDemoTenant } from "@/lib/demo-tenant";

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

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Company profile</h2>
      <p className="mt-1 text-sm text-zinc-600">
        How your organization appears in the app. All users share this tenant.
      </p>
      <div className="mt-8">
        <SettingsOrganizationForm
          initialName={tenant.name}
          slug={tenant.slug}
        />
      </div>
    </div>
  );
}
