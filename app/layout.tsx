import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UCAC | China university application workspace",
  description:
    "A frontend-first admissions workspace for finding China programs, preparing documents, and requesting adviser review.",
  icons: {
    icon: [{ url: "/ucac-favicon.ico?v=20261016", type: "image/x-icon", sizes: "16x16 32x32 48x48 64x64 256x256" }],
    shortcut: "/ucac-favicon.ico?v=20261016",
    apple: [{ url: "/ucac-apple-touch-icon.png?v=20261016", sizes: "180x180" }],
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

