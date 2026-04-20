import { redirect } from "next/navigation";

import { TARIFF_CONTRACTS_DIRECTORY_PATH } from "@/lib/tariff/tariff-workbench-urls";

export default function TariffsIndexPage() {
  redirect(TARIFF_CONTRACTS_DIRECTORY_PATH);
}
