import { redirect } from "next/navigation";
import { legacyPageHref, type LegacySearchParams } from "../legacy-redirect.ts";

export default async function HubPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  redirect(legacyPageHref("/hub-api.html", await searchParams));
}
