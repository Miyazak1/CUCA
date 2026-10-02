import type { Metadata } from "next";
import { AuthActionClient } from "../action-client";

export const metadata: Metadata = {
  title: "Reset password | UCAC",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <AuthActionClient kind="reset" />;
}
