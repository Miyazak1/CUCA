import { redirect } from "next/navigation";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/application.html?applicationSet=${encodeURIComponent(applicationId)}`);
}
