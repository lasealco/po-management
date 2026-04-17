import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet } from "@/lib/authz";

export default async function SettingsRootLayout({
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

  return <div className="min-h-screen bg-zinc-50">{children}</div>;
}
