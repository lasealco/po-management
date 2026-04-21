import type { ReactElement } from "react";

import { AccessDenied } from "@/components/access-denied";
import { TwinModuleDisabledAccessDenied } from "@/components/supply-chain-twin/twin-module-disabled-access-denied";
import {
  requireTwinApiAccess,
  TWIN_API_ERROR_MODULE_DISABLED,
  type TwinApiAccessOk,
} from "@/lib/supply-chain-twin/sctwin-api-access";

/**
 * Page-level Twin gate that mirrors API access checks, so UI actions do not
 * appear available when API routes would return 403.
 */
export async function requireTwinPageAccess(): Promise<
  { ok: true; access: TwinApiAccessOk["access"] } | { ok: false; deniedUi: ReactElement }
> {
  const gate = await requireTwinApiAccess();
  if (gate.ok) {
    return { ok: true, access: gate.access };
  }
  if (gate.denied.error === TWIN_API_ERROR_MODULE_DISABLED) {
    return { ok: false, deniedUi: <TwinModuleDisabledAccessDenied /> };
  }
  return {
    ok: false,
    deniedUi: <AccessDenied title="Supply Chain Twin" message={gate.denied.error} />,
  };
}
