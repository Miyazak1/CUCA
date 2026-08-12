import type { Metadata } from "next";
import { CuacApp } from "./cuac-app";

export const metadata: Metadata = {
  title: "CUAC | China university application workspace",
  description:
    "Find China university programs, compare requirements, prepare documents, and request adviser review.",
};

export default function Home() {
  return <CuacApp initialView="home" />;
}

