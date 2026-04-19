import type { Metadata } from "next";

import { MarketingPricingPage } from "@/components/marketing-pricing";

export const metadata: Metadata = {
  title: "Plans & pricing | AR SCMP",
  description:
    "Modular packages for Control Tower, PO Management, WMS, CRM, and SRM — or the full enterprise suite. Evaluation and sales-led onboarding.",
};

export default function PricingPage() {
  return <MarketingPricingPage />;
}
