import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
import { AppNav } from "@/components/app-nav";

/** Server wrapper: hides main nav items the active demo user cannot access. */
export async function AppNavWithGrants() {
  const access = await getViewerGrantSet();
  const { linkVisibility, setupIncomplete } = await resolveNavState(access);

  return (
    <AppNav linkVisibility={linkVisibility} setupIncomplete={setupIncomplete} />
  );
}
