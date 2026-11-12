import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { legacyPageHref, type LegacySearchParams } from "./legacy-redirect.ts";

export const metadata: Metadata = {
  title: "UCAC | China admissions for international students",
  description: "Search Chinese universities, compare routes, and plan applications with UCAC.",
};

export default async function Home({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  redirect(legacyPageHref("/home-v3.html", await searchParams));
}
