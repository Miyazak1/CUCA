import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsightShell } from "../insight-shell";
import styles from "../insights.module.css";
import { categoryFor, getInsight, listInsights } from "@/src/content/insights.ts";

type PageProps = { params: Promise<{ insightSlug: string }> };

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

export function generateStaticParams() {
  return listInsights().map((post) => ({ insightSlug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = getInsight((await params).insightSlug);
  if (!post) return { title: "Insight not found | UCAC", robots: { index: false, follow: false } };
  const canonical = `https://ucac.cn/insights/${post.slug}`;
  return {
    title: `${post.title} | UCAC`,
    description: post.description,
    alternates: { canonical },
    openGraph: { title: post.title, description: post.description, url: canonical, siteName: "UCAC", type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt, authors: [post.author] },
  };
}

export default async function InsightPage({ params }: PageProps) {
  const post = getInsight((await params).insightSlug);
  if (!post) notFound();
  const category = categoryFor(post);
  const canonical = `https://ucac.cn/insights/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    mainEntityOfPage: canonical,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    articleSection: category.name,
    keywords: post.tags.join(", "),
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "UCAC", url: "https://ucac.cn/", parentOrganization: { "@type": "Organization", name: "Holalobe" } },
    citation: post.sources.map((source) => source.url),
  };

  return (
    <InsightShell>
      <main className={`${styles.main} ${styles.article}`}>
        <Link className={styles.back} href="/insights/">← All insights</Link>
        <article>
          <header className={styles.articleHeader}>
            <Link className={`${styles.eyebrow} ${styles.categoryLink}`} href={`/insights/category/${category.slug}`}>{category.name}</Link>
            <h1>{post.title}</h1>
            <p className={styles.dek}>{post.description}</p>
            <div className={styles.meta}><span>Published {date(post.publishedAt)}</span><span>Updated {date(post.updatedAt)}</span><span>{post.readingMinutes} min read</span><span>{post.author}</span></div>
            <div className={styles.tags} aria-label="Topics">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </header>

          {post.sections.map((section) => (
            <section className={styles.section} id={section.id} key={section.id}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets?.length ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
            </section>
          ))}

          <section className={styles.sourceBox}>
            <p className={styles.eyebrow}>Evidence</p>
            <h2>Official sources checked for this article</h2>
            <p>University requirements can change after publication. Open the source and confirm it still applies to your program and intake.</p>
            <ul className={styles.sourceList}>
              {post.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> <span>· checked {date(source.checkedAt)}</span></li>)}
            </ul>
          </section>

          <aside className={styles.related}>
            <p className={styles.eyebrow}>Evergreen guidance</p>
            <h2>Use the related UCAC guide</h2>
            <p>Insights explain what is changing; Guides turn the evidence into a repeatable application process.</p>
            <div className={styles.relatedLinks}>{post.relatedGuides.map((guide) => <Link href={guide.href} key={guide.href}>{guide.label} →</Link>)}</div>
          </aside>
        </article>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </InsightShell>
  );
}
