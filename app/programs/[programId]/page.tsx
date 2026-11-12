import { redirect } from "next/navigation";
import { legacyPageHref, type LegacySearchParams } from "../../legacy-redirect.ts";

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<LegacySearchParams>;
}) {
  const { programId } = await params;
  redirect(legacyPageHref("/program-detail.html", await searchParams, { program: programId }));
}
