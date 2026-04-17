import { AccessDenied } from "@/components/access-denied";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getViewerGrantSet();

  if (!access) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-16">
        <AccessDenied
          title="Settings unavailable"
          message="Demo tenant not found. Run npm run db:seed."
        />
      </div>
    );
  }

  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-16">
        <AccessDenied
          title="Settings"
          message="Choose an active demo user first: open Settings → Demo session (/settings/demo), pick who you are acting as, then return here."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.settings", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-16">
        <AccessDenied
          title="Settings"
          message="You do not have permission to view settings (org.settings → view)."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:flex-row lg:gap-12 lg:py-8">
        <SettingsSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
