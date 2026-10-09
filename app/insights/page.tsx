import type { Metadata } from "next";
import Link from "next/link";
import { InsightShell } from "./insight-shell";
import styles from "./insights.module.css";
import { categoryFor, insightCategories, listInsights } from "@/src/content/insights.ts";

export const metadata: Metadata = {
  title: "China admissions insights | UCAC",
  description: "Dated UCAC analysis of current China university admissions notices, program lists, and scholarship announcements, with direct official sources.",
  alternates: { canonical: "https://ucac.cn/insights/", types: { "application/rss+xml": "https://ucac.cn/insights/rss.xml" } },
  openGraph: {
    title: "China admissions insights | UCAC",
    description: "Current-cycle admissions, program, and scholarship analysis from UCAC by Holalobe.",
    url: "https://ucac.cn/insights/",
    siteName: "UCAC",
    type: "website",
  },
};

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function InsightsPage() {
  const posts = listInsights();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "UCAC Insights",
    description: metadata.description,
    url: "https://ucac.cn/insights/",
    publisher: { "@type": "Organization", name: "UCAC", parentOrganization: { "@type": "Organization", name: "Holalobe" } },
    blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `https://ucac.cn/insights/${post.slug}`, datePublished: post.publishedAt })),
  };

  return (
    <InsightShell>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>UCAC Insights</p>
          <h1>What is changing in China admissions</h1>
          <p>Dated analysis of current university notices, program lists, and scholarship announcements. Every factual article links to the official sources checked by UCAC.</p>
        </section>
        <ul className={styles.categoryNav} aria-label="Insight categories">
          {insightCategories.map((category) => <li key={category.slug}><Link href={`/insights/category/${category.slug}`}>{category.name}</Link></li>)}
        </ul>
        <section className={styles.grid} aria-label="Latest UCAC insights">
          {posts.map((post) => {
            const category = categoryFor(post);
            return (
              <article className={`${styles.card} ${post.featured ? styles.featured : ""}`} key={post.slug}>
                <p className={styles.eyebrow}>{category.name}</p>
                <h2>{post.title}</h2>
                <p>{post.description}</p>
                <div className={styles.meta}><span>{date(post.publishedAt)}</span><span>{post.readingMinutes} min read</span><span>{post.author}</span></div>
                <Link className={styles.cardLink} href={`/insights/${post.slug}`}>Read analysis →</Link>
              </article>
            );
          })}
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </InsightShell>
  );
}
