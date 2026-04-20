import type { Metadata } from "next";

import { MarketingPricingPage } from "@/components/marketing-pricing";
import { MARKETING_PRICING_PATH } from "@/lib/marketing-public-paths";

export const metadata: Metadata = {
  title: "Plans & pricing | AR SCMP",
  description:
    "Modular packages for Control Tower, PO Management, WMS, CRM, and SRM — or the full enterprise suite. Evaluation and sales-led onboarding.",
  alternates: { canonical: MARKETING_PRICING_PATH },
};

export default function PricingPage() {
  return <MarketingPricingPage />;
}
