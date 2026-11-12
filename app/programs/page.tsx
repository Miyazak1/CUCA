import { redirect } from "next/navigation";
import { legacyPageHref, type LegacySearchParams } from "../legacy-redirect.ts";

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  redirect(legacyPageHref("/programs.html", await searchParams));
}
