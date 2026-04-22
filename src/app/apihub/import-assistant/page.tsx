import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Canonical guided import URL is `/apihub`. */
export default function ImportAssistantAliasPage() {
  redirect("/apihub");
}
