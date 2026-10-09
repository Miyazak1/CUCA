import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UCAC | China university application workspace",
  description:
    "A frontend-first admissions workspace for finding China programs, preparing documents, and requesting adviser review.",
  icons: {
    icon: "/ucac-icon.png?v=20261009-holalobe-brand",
    shortcut: "/ucac-icon.png?v=20261009-holalobe-brand",
    apple: "/ucac-icon.png?v=20261009-holalobe-brand",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

