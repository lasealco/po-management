import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavWithGrants } from "@/components/app-nav-with-grants";
import { CommandPalette } from "@/components/command-palette";
import { GuideCallout } from "@/components/guide-callout";
import { HelpAssistant } from "@/components/help-assistant";
import { LayoutPoSubnav } from "@/components/layout-po-subnav";
import { SiteLegalStrip } from "@/components/site-legal-strip";
import { actorIsSupplierPortalRestricted, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { pathUsesAppChrome } from "@/lib/app-shell-paths";
import { resolveNavState } from "@/lib/nav-visibility";
import "./globals.css";

/** Nav and demo bar read cookies; avoid caching a shell without grants. */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AR SCMP",
  description: "Connected supply chain platform — procurement, logistics, and operations.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const showAppChrome = pathUsesAppChrome(pathname);

  const access = await getViewerGrantSet();
  const { poSubNavVisibility } = await resolveNavState(access);
  const actorId = access?.user?.id ?? null;
  const isSupplierPortalUser =
    actorId !== null && (await actorIsSupplierPortalRestricted(actorId));

  const commandGrants = {
    orders: Boolean(access?.user && viewerHas(access.grantSet, "org.orders", "view")),
    reports: Boolean(access?.user && viewerHas(access.grantSet, "org.reports", "view")),
    consolidation: Boolean(
      access?.user &&
        viewerHas(access.grantSet, "org.orders", "view") &&
        !isSupplierPortalUser,
    ),
    wms: Boolean(access?.user && viewerHas(access.grantSet, "org.wms", "view")),
    controlTower: Boolean(
      access?.user && viewerHas(access.grantSet, "org.controltower", "view"),
    ),
    crm: Boolean(
      access?.user &&
        (viewerHas(access.grantSet, "org.crm", "view") ||
          (!isSupplierPortalUser &&
            (viewerHas(access.grantSet, "org.orders", "view") ||
              viewerHas(access.grantSet, "org.settings", "view")))),
    ),
    suppliers: Boolean(access?.user && viewerHas(access.grantSet, "org.suppliers", "view")),
    srm: Boolean(access?.user && viewerHas(access.grantSet, "org.suppliers", "view")),
    products: Boolean(access?.user && viewerHas(access.grantSet, "org.products", "view")),
    settings: Boolean(access?.user && viewerHas(access.grantSet, "org.settings", "view")),
    tariffs: Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "view")),
    rfq: Boolean(access?.user && viewerHas(access.grantSet, "org.rfq", "view")),
    pricingSnapshots: Boolean(
      access?.user &&
        (viewerHas(access.grantSet, "org.tariffs", "view") ||
          viewerHas(access.grantSet, "org.rfq", "view")),
    ),
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body
        className={
          showAppChrome ? "flex min-h-full flex-col bg-zinc-50" : "min-h-full bg-white"
        }
      >
        {showAppChrome ? (
          <>
            <AppNavWithGrants />
            <LayoutPoSubnav visibility={poSubNavVisibility} />
            <GuideCallout />
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1">{children}</div>
              <SiteLegalStrip />
            </div>
            <CommandPalette grants={commandGrants} />
            <HelpAssistant />
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
