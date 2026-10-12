import type { Metadata } from "next";
import Link from "next/link";
import { InsightShell } from "./insight-shell";
import styles from "./insights.module.css";
import { categoryFor, insightCategories } from "@/src/content/insights.ts";
import { listPublishedInsights } from "@/src/server/insights/public-insights.ts";

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

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const posts = await listPublishedInsights();
  const featuredPost = posts.find((post) => post.featured) ?? posts[0];
  const latestPosts = posts.filter((post) => post.slug !== featuredPost?.slug);
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
        <section className={styles.hero} aria-labelledby="insights-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>UCAC Insights · Editorial</p>
            <h1 id="insights-title">China admissions, explained with evidence</h1>
            <p>Timely analysis of university notices, program lists, and scholarship announcements—written to help international applicants make clearer decisions.</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href="#latest-insights">Explore latest insights</a>
              <Link className={styles.secondaryAction} href="/guides/">Browse application guides</Link>
            </div>
          </div>
          <aside className={styles.editorialPromise} aria-label="UCAC editorial standard">
            <p className={styles.promiseLabel}>Our editorial standard</p>
            <strong>Current, traceable, useful.</strong>
            <p>Every factual article is dated, reviewed against named official sources, and separated from evergreen application guidance.</p>
            <dl>
              <div><dt>{posts.length}</dt><dd>Published analyses</dd></div>
              <div><dt>{insightCategories.length}</dt><dd>Editorial desks</dd></div>
              <div><dt>100%</dt><dd>Source-linked</dd></div>
            </dl>
          </aside>
        </section>

        <section className={styles.categorySection} aria-labelledby="insight-topics">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Browse by desk</p><h2 id="insight-topics">Follow the part of admissions that matters to you</h2></div>
          </div>
          <ul className={styles.categoryNav} aria-label="Insight categories">
            {insightCategories.map((category, index) => (
              <li key={category.slug}>
                <Link href={`/insights/category/${category.slug}`}>
                  <span className={styles.categoryNumber}>0{index + 1}</span>
                  <strong>{category.name}</strong>
                  <span>{category.description}</span>
                  <b aria-hidden="true">↗</b>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {featuredPost ? (
          <section className={styles.featuredSection} aria-labelledby="featured-insight">
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Editor&apos;s lead</p><h2 id="featured-insight">The briefing to read first</h2></div>
              <span>Updated for the current admissions cycle</span>
            </div>
            <article className={styles.featuredCard}>
              <div className={styles.featuredVisual} aria-hidden="true">
                <span>UCAC</span>
                <strong>INSIGHT<br />01</strong>
                <i>Admissions<br />intelligence</i>
              </div>
              <div className={styles.featuredContent}>
                <p className={styles.eyebrow}>{categoryFor(featuredPost).name}</p>
                <h2>{featuredPost.title}</h2>
                <p>{featuredPost.description}</p>
                <div className={styles.meta}><span>{date(featuredPost.publishedAt)}</span><span>{featuredPost.readingMinutes} min read</span><span>{featuredPost.author}</span></div>
                <Link className={styles.readButton} href={`/insights/${featuredPost.slug}`}>Read the briefing <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          </section>
        ) : null}

        <section className={styles.latestSection} id="latest-insights" aria-labelledby="latest-heading">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Latest analysis</p><h2 id="latest-heading">More from UCAC Insights</h2></div>
            <Link className={styles.rssLink} href="/insights/rss.xml">RSS feed ↗</Link>
          </div>
          <div className={styles.grid}>
          {latestPosts.map((post, index) => {
            const category = categoryFor(post);
            return (
              <article className={styles.card} key={post.slug}>
                <span className={styles.cardIndex} aria-hidden="true">0{index + 2}</span>
                <p className={styles.eyebrow}>{category.name}</p>
                <h2>{post.title}</h2>
                <p>{post.description}</p>
                <div className={styles.meta}><span>{date(post.publishedAt)}</span><span>{post.readingMinutes} min read</span><span>{post.author}</span></div>
                <Link className={styles.cardLink} href={`/insights/${post.slug}`}>Read analysis <span aria-hidden="true">→</span></Link>
              </article>
            );
          })}
          </div>
        </section>

        <aside className={styles.methodBand} aria-label="UCAC publishing method">
          <div><p className={styles.eyebrow}>How we publish</p><h2>Useful analysis without hiding the evidence</h2></div>
          <ol>
            <li><span>01</span><strong>Check</strong><p>We read the named university or government source.</p></li>
            <li><span>02</span><strong>Explain</strong><p>We separate confirmed facts from practical interpretation.</p></li>
            <li><span>03</span><strong>Date</strong><p>We show when the article and its sources were reviewed.</p></li>
          </ol>
        </aside>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </InsightShell>
  );
}
