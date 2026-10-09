import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/hub/", "/ops-", "/school-", "/auth/", "/application.html", "/hub-api.html"],
    },
    sitemap: "https://ucac.cn/sitemap.xml",
    host: "https://ucac.cn",
  };
}
