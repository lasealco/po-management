import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RootChrome } from "@/components/root-chrome";
import { actorIsSupplierPortalRestricted, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
import "./globals.css";

/** Nav and demo bar read cookies; avoid caching a shell without grants. */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  adjustFontFallback: true,
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
  const access = await getViewerGrantSet();
  const { poSubNavVisibility, linkVisibility, setupIncomplete } = await resolveNavState(access);
  const actorId = access?.user?.id ?? null;
  const isSupplierPortalUser =
    actorId !== null && (await actorIsSupplierPortalRestricted(actorId));

  const commandGrants = {
    orders: Boolean(access?.user && viewerHas(access.grantSet, "org.orders", "view")),
    reports: Boolean(access?.user && viewerHas(access.grantSet, "org.reports", "view")),
    consolidation: Boolean(linkVisibility?.consolidation),
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
          viewerHas(access.grantSet, "org.rfq", "view") ||
          viewerHas(access.grantSet, "org.invoice_audit", "view")),
    ),
    invoiceAudit: Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "view")),
    apihub: Boolean(access?.user),
    supplyChainTwin: Boolean(linkVisibility?.supplyChainTwin),
    scri: Boolean(linkVisibility?.riskIntelligence),
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full">
        <RootChrome
          linkVisibility={linkVisibility}
          setupIncomplete={setupIncomplete}
          poSubNavVisibility={poSubNavVisibility}
          commandGrants={commandGrants}
        >
          {children}
        </RootChrome>
      </body>
    </html>
  );
}
