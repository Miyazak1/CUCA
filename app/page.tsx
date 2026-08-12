import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "CUAC | China admissions for international students",
  description: "Search Chinese universities, compare routes, and plan applications with CUAC.",
};

export default function Home() {
  redirect("/home-v3.html");
}
