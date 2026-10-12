import { getSharedPostgresPool } from "../db/postgres-client.ts";
import { listInsights as listStaticInsights, type InsightPost } from "../../content/insights.ts";
import { parseInsightDocument } from "./insight-document.ts";

type PublishedRow = { slug: string; status: string; version: number | null; content: unknown; publishedAt: Date | null; updatedAt: Date };

async function databaseRows(): Promise<PublishedRow[]> {
  const result = await getSharedPostgresPool().query(`select p.slug, p.status, v.version, v.content_json as content,
    v.published_at as "publishedAt", p.updated_at as "updatedAt"
    from insight_posts p left join insight_versions v on v.id = p.current_version_id and v.post_id = p.id`);
  return result.rows as PublishedRow[];
}

export async function listPublishedInsights(): Promise<InsightPost[]> {
  const baseline = new Map(listStaticInsights().map(post => [post.slug, post]));
  let rows: PublishedRow[];
  try { rows = await databaseRows(); }
  catch { return [...baseline.values()]; }
  for (const row of rows) {
    if (row.status === "archived") { baseline.delete(row.slug); continue; }
    if (row.status !== "published" || !row.version || !row.publishedAt || !row.content) continue;
    baseline.delete(row.slug);
    try {
      const document = parseInsightDocument({ schemaVersion: 1, ...(row.content as Record<string, unknown>) });
      baseline.set(row.slug, { status: "published", version: row.version, ...document,
        publishedAt: row.publishedAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
    } catch {
      // A malformed CMS projection is hidden instead of reviving an older article.
    }
  }
  return [...baseline.values()].sort((a, b) => Number(b.featured) - Number(a.featured) || b.publishedAt.localeCompare(a.publishedAt));
}

export async function getPublishedInsight(slug: string): Promise<InsightPost | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return (await listPublishedInsights()).find(post => post.slug === slug) ?? null;
}
