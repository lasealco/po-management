import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { WorkflowHeader } from "@/components/workflow-header";
import { listAdvancedProgramConfigs } from "@/lib/assistant/advanced-programs";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { AdvancedProgramsCatalogClient } from "./advanced-programs-catalog-client";

export const dynamic = "force-dynamic";

export default async function AdvancedProgramsCatalogPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view"));

  if (!access?.user) {
    return (
      <AccessDenied title="Advanced programs" message="Choose an active demo user: open Settings → Demo session (/settings/demo)." />
    );
  }
  if (!canOpen) {
    return (
      <AccessDenied
        title="Advanced programs"
        message="You need operational view access (orders, WMS, suppliers, control tower, or settings) to open AMP workspaces."
      />
    );
  }

  const programs = listAdvancedProgramConfigs().map((p) => ({
    slug: p.slug,
    navLabel: p.navLabel,
    ampNumber: p.ampNumber,
    title: p.title,
  }));

  return (
    <div>
      <p className="text-sm">
        <Link href="/assistant" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          ← Assistant
        </Link>
      </p>

      <div className="mt-4">
        <WorkflowHeader
          eyebrow="Assistant catalog"
          title="Advanced programs"
          description="AMP review workspaces are listed here so the main Assistant nav stays compact. Search and open a program to load its packet."
          steps={["Step 1: Search or browse", "Step 2: Open an AMP workspace", "Step 3: Review packet & evidence"]}
        />
      </div>

      <AdvancedProgramsCatalogClient programs={programs} />
    </div>
  );
}
