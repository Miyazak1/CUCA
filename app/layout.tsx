import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CUAC | China university application workspace",
  description:
    "A frontend-first admissions workspace for finding China programs, preparing documents, and requesting adviser review.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

