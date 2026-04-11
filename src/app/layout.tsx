import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavWithGrants } from "@/components/app-nav-with-grants";
import { CommandPalette } from "@/components/command-palette";
import { DemoUserSwitcher } from "@/components/demo-user-switcher";
import { GuideCallout } from "@/components/guide-callout";
import { HelpAssistant } from "@/components/help-assistant";
import { getViewerGrantSet, userHasRoleNamed, viewerHas } from "@/lib/authz";
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
  title: "PO Management",
  description: "Purchase order workflow playground",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getViewerGrantSet();
  const actorId = access?.user?.id ?? null;
  const isSupplierPortalUser =
    actorId !== null && (await userHasRoleNamed(actorId, "Supplier portal"));

  const commandGrants = {
    orders: Boolean(access?.user && viewerHas(access.grantSet, "org.orders", "view")),
    reports: Boolean(access?.user && viewerHas(access.grantSet, "org.reports", "view")),
    consolidation: Boolean(
      access?.user &&
        viewerHas(access.grantSet, "org.orders", "view") &&
        !isSupplierPortalUser,
    ),
    wms: Boolean(access?.user && viewerHas(access.grantSet, "org.wms", "view")),
    crm: Boolean(access?.user && viewerHas(access.grantSet, "org.crm", "view")),
    suppliers: Boolean(access?.user && viewerHas(access.grantSet, "org.suppliers", "view")),
    products: Boolean(access?.user && viewerHas(access.grantSet, "org.products", "view")),
    settings: Boolean(access?.user && viewerHas(access.grantSet, "org.settings", "view")),
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50">
        <AppNavWithGrants />
        <DemoUserSwitcher />
        <GuideCallout />
        {children}
        <CommandPalette grants={commandGrants} />
        <HelpAssistant />
      </body>
    </html>
  );
}
