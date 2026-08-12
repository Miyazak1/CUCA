import { CuacApp } from "../../cuac-app";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  return <CuacApp initialView="program-detail" initialProgramId={programId} />;
}

