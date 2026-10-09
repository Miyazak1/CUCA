import type { MetadataRoute } from "next";
import { listPublishedGuidePages } from "@/src/server/catalog/public-guide-pages.ts";
import { insightCategories, listInsights } from "@/src/content/insights.ts";

export const dynamic = "force-dynamic";

const basePages = ["", "programs.html", "universities.html", "scholarships.html", "cities.html", "guides/", "insights/", "about.html"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = basePages.map((path) => ({
    url: `https://ucac.cn/${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "guides/" || path === "insights/" ? 0.8 : 0.7,
  }));
  entries.push(...listInsights().map((post) => ({
    url: `https://ucac.cn/insights/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly" as const,
    priority: post.featured ? 0.8 : 0.7,
  })));
  entries.push(...insightCategories.map((category) => ({
    url: `https://ucac.cn/insights/category/${category.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  })));
  try {
    const guides = await listPublishedGuidePages();
    entries.push(...guides.map((guide) => ({
      url: `https://ucac.cn/guides/${guide.slug}`,
      lastModified: guide.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })));
  } catch {
    // Keep the stable public sitemap available when the catalog is temporarily unavailable.
  }
  return entries;
}
