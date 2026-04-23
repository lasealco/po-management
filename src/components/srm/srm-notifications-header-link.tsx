import Link from "next/link";

/** SRM list, 360, analytics, etc. — same unread badge as `/srm/notifications`. */
export function SrmNotificationsHeaderLink({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href="/srm/notifications"
      className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
    >
      Notifications
      {unreadCount > 0 ? (
        <span className="ml-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-zinc-900 px-1.5 py-0.5 text-xs font-semibold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
