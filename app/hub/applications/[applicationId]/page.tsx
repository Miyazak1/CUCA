import { redirect } from "next/navigation";
import { legacyPageHref, type LegacySearchParams } from "../../../legacy-redirect.ts";

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { applicationId } = await params;
  redirect(legacyPageHref("/application.html", await searchParams, { applicationSet: applicationId }));
}
