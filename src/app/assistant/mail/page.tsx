import { Suspense } from "react";

import { AccessDenied } from "@/components/access-denied";
import { AssistantMailClient } from "@/components/assistant/assistant-mail-client";
import { isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

function MailDisabled() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-950">
      <p className="font-semibold">Assistant email pilot is off</p>
      <p className="mt-2 text-amber-900/90">
        Set <code className="rounded bg-amber-200/60 px-1.5">ASSISTANT_EMAIL_PILOT=1</code> (and optionally{" "}
        <code className="rounded bg-amber-200/60 px-1.5">NEXT_PUBLIC_ASSISTANT_EMAIL_PILOT=1</code> for nav hints) in your
        environment, redeploy, then return here.
      </p>
    </div>
  );
}

export default async function AssistantMailPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Mail pilot"
        message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
      />
    );
  }
  if (!isAssistantEmailPilotEnabled()) {
    return <MailDisabled />;
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return (
      <AccessDenied
        title="Mail pilot"
        message="You need org.orders → view to use the sales mail workspace."
      />
    );
  }
  const canConfirmSend = viewerHas(access.grantSet, "org.orders", "edit");
  const canPickCrmAccount = viewerHas(access.grantSet, "org.crm", "view");

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Mail (pilot)</h2>
      <p className="mt-1 max-w-3xl text-sm text-zinc-600">
        Import inbound messages, link to CRM, draft replies in-app, and use <strong>Confirm</strong> to record approval
        and open your OS mail client — no silent server-side send in the default configuration.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={<p className="text-sm text-zinc-500">Loading…</p>}
        >
          <AssistantMailClient canConfirmSend={canConfirmSend} canPickCrmAccount={canPickCrmAccount} />
        </Suspense>
      </div>
    </div>
  );
}
