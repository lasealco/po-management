import type { Metadata } from "next";

import { MarketingLanding } from "@/components/marketing-landing";

export const metadata: Metadata = {
  title: "NEOLINK | Connected Supply Chain Platform",
  description:
    "Modular supply chain management: POs, sales orders, control tower, WMS, reporting, CRM, and SRM.",
};

export default function HomePage() {
  return <MarketingLanding />;
}
