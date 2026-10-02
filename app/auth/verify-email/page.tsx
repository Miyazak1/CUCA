import type { Metadata } from "next";
import { AuthActionClient } from "../action-client";

export const metadata: Metadata = {
  title: "Verify email | UCAC",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return <AuthActionClient kind="verify" />;
}
