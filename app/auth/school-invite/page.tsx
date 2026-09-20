import type { Metadata } from "next";
import { SchoolInviteClient } from "./school-invite-client";

export const metadata: Metadata = {
  title: "Activate school access | CUAC",
  robots: { index: false, follow: false },
};

export default function SchoolInvitePage() {
  return <SchoolInviteClient />;
}
