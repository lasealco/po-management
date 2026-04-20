import Link from "next/link";

import { DemoUserPanel } from "@/components/demo-user-panel";
import { getViewerGrantSet } from "@/lib/authz";
import { PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";

export const dynamic = "force-dynamic";

export default async function SettingsDemoSessionPage() {
  const access = await getViewerGrantSet();
  const hasUser = Boolean(access?.user);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm text-zinc-600">
        <Link href={PLATFORM_HUB_PATH} className="text-[var(--arscmp-primary)] hover:underline">
          Home
        </Link>
        {hasUser ? (
          <>
            {" · "}
            <Link href="/settings" className="hover:underline">
              Settings overview
            </Link>
          </>
        ) : null}
      </p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900">Demo session</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
        Which user you act as drives permissions across the app. Use this while the product runs on
        demo accounts; it is replaced by real authentication in production. Choose the seeded{" "}
        <span className="font-mono">superuser@demo-company.com</span> account for full access (all modules, no
        portal restrictions).
      </p>
      <DemoUserPanel className="mt-8" />
    </div>
  );
}
