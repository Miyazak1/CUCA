import { listInsights } from "@/src/content/insights.ts";

export const dynamic = "force-static";

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function GET() {
  const posts = listInsights();
  const items = posts.map((post) => {
    const url = `https://ucac.cn/insights/${post.slug}`;
    return `<item><title>${xml(post.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${xml(post.description)}</description><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><category>${xml(post.category)}</category></item>`;
  }).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>UCAC Insights</title><link>https://ucac.cn/insights/</link><description>Current-cycle China admissions analysis from UCAC by Holalobe.</description><language>en</language><lastBuildDate>${new Date(posts[0]?.updatedAt || 0).toUTCString()}</lastBuildDate>${items}</channel></rss>`;
  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900, s-maxage=3600" } });
}
