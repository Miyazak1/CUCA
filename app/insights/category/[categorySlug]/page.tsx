import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsightShell } from "../../insight-shell";
import styles from "../../insights.module.css";
import { getInsightCategory, insightCategories, listInsightsByCategory } from "@/src/content/insights.ts";

type PageProps = { params: Promise<{ categorySlug: string }> };

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function generateStaticParams() {
  return insightCategories.map((category) => ({ categorySlug: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = getInsightCategory((await params).categorySlug);
  if (!category) return { title: "Insight category not found | UCAC", robots: { index: false, follow: false } };
  const canonical = `https://ucac.cn/insights/category/${category.slug}`;
  return { title: `${category.name} | UCAC Insights`, description: category.description, alternates: { canonical }, openGraph: { title: `${category.name} | UCAC Insights`, description: category.description, url: canonical, siteName: "UCAC", type: "website" } };
}

export default async function InsightCategoryPage({ params }: PageProps) {
  const category = getInsightCategory((await params).categorySlug);
  if (!category) notFound();
  const posts = listInsightsByCategory(category.slug);
  return (
    <InsightShell>
      <main className={styles.main}>
        <Link className={styles.back} href="/insights/">← All insights</Link>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>UCAC Insights category</p>
          <h1>{category.name}</h1>
          <p>{category.description}</p>
        </section>
        <section className={styles.grid} aria-label={`${category.name} articles`}>
          {posts.map((post) => (
            <article className={styles.card} key={post.slug}>
              <p className={styles.eyebrow}>{category.name}</p>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              <div className={styles.meta}><span>{date(post.publishedAt)}</span><span>{post.readingMinutes} min read</span></div>
              <Link className={styles.cardLink} href={`/insights/${post.slug}`}>Read analysis →</Link>
            </article>
          ))}
        </section>
      </main>
    </InsightShell>
  );
}
