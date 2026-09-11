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

