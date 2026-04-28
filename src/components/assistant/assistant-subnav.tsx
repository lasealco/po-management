"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { appNavActiveClass, appNavInactiveClass } from "@/lib/subnav-active-class";

export function AssistantSubnav() {
  const pathname = usePathname() ?? "";
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [emailPilot, setEmailPilot] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/assistant/inbox?count=1", { method: "GET" });
        if (!res.ok) {
          setInboxCount(0);
          return;
        }
        const d = (await res.json()) as { total?: number };
        setInboxCount(typeof d.total === "number" ? d.total : 0);
      } catch {
        setInboxCount(0);
      }
    })();
  }, [pathname]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/assistant/email-pilot");
        const d = (await res.json()) as { enabled?: boolean };
        setEmailPilot(d.enabled === true);
      } catch {
        setEmailPilot(false);
      }
    })();
  }, []);

  const chat = pathname === "/assistant" || pathname === "/assistant/";
  const workbench = pathname.startsWith("/assistant/workbench");
  const execution = pathname.startsWith("/assistant/execution");
  const inbox = pathname.startsWith("/assistant/inbox");
  const commandCenter = pathname.startsWith("/assistant/command-center");
  const mail = pathname.startsWith("/assistant/mail");

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-3 text-sm">
      <Link
        href="/assistant"
        className={chat ? appNavActiveClass : appNavInactiveClass}
        title="Sales assistant"
      >
        Chat
      </Link>
      <Link
        href="/assistant/workbench"
        className={workbench ? appNavActiveClass : appNavInactiveClass}
        title="LMP1-LMP10 copilot workbench"
      >
        Workbench
      </Link>
      <Link
        href="/assistant/execution"
        className={execution ? appNavActiveClass : appNavInactiveClass}
        title="LMP11-LMP30 execution workbench"
      >
        Execution
      </Link>
      <Link
        href="/assistant/inbox"
        className={inbox ? appNavActiveClass : appNavInactiveClass}
        title="Open items"
      >
        Inbox
        {inboxCount != null && inboxCount > 0 ? (
          <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] font-semibold text-zinc-800">
            {inboxCount > 99 ? "99+" : inboxCount}
          </span>
        ) : null}
      </Link>
      <Link
        href="/assistant/command-center"
        className={commandCenter ? appNavActiveClass : appNavInactiveClass}
        title="Cross-workspace command center"
      >
        Command center
      </Link>
      {emailPilot ? (
        <Link
          href="/assistant/mail"
          className={mail ? appNavActiveClass : appNavInactiveClass}
          title="Email pilot (manual import, confirm before send)"
        >
          Mail
        </Link>
      ) : null}
    </div>
  );
}
