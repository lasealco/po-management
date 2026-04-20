import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet } from "@/lib/authz";

export async function ApihubGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="API hub"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  return <>{children}</>;
}
