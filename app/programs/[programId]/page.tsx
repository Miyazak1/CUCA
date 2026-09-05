import { redirect } from "next/navigation";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  redirect(`/program-detail.html?program=${encodeURIComponent(programId)}`);
}
