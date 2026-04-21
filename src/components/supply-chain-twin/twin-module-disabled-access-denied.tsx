import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";

export function TwinModuleDisabledAccessDenied() {
  return (
    <AccessDenied
      title="Supply Chain Twin"
      message={
        <span>
          Supply Chain Twin is not enabled for this workspace yet. Contact support or your workspace admin to request
          access, or return to the{" "}
          <Link href={PLATFORM_HUB_PATH} className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline">
            platform hub
          </Link>
          .
        </span>
      }
    />
  );
}
