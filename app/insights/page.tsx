import { editorial, editorialHref, editorialLocale, editorialMetadata, localizeInsight, localizeCategory, type EditorialSearchParams, type EditorialLocale } from "@/src/content/editorial.ts";
import type { Metadata } from "next";
import Link from "next/link";
import { InsightShell } from "./insight-shell";
import styles from "./insights.module.css";
import { categoryFor, insightCategories } from "@/src/content/insights.ts";
import { listPublishedInsights } from "@/src/server/insights/public-insights.ts";
const metadata: Metadata = {
    title: "China admissions insights | UCAC",
    description: "Dated UCAC analysis of current China university admissions notices, program lists, and scholarship announcements.",
    alternates: { canonical: "https://ucac.cn/insights/", types: { "application/rss+xml": "https://ucac.cn/insights/rss.xml" } },
    openGraph: {
        title: "China admissions insights | UCAC",
        description: "Current-cycle admissions, program, and scholarship analysis from UCAC.",
        url: "https://ucac.cn/insights/",
        siteName: "UCAC",
        type: "website",
    },
};
function date(value: string, locale: EditorialLocale) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
export const dynamic = "force-dynamic";
export default async function InsightsPage({ searchParams }: {
    searchParams?: EditorialSearchParams;
}) {
    const locale = await editorialLocale(searchParams);
    const t = editorial(locale);
    const posts = (await listPublishedInsights()).map(post => localizeInsight(post, locale));
    const featuredPost = posts.find((post) => post.featured) ?? posts[0];
    const latestPosts = posts.filter((post) => post.slug !== featuredPost?.slug);
    const jsonLd = {
        inLanguage: locale,
        "@context": "https://schema.org",
        "@type": "Blog",
        name: t("UCAC Insights"),
        description: metadata.description,
        url: "https://ucac.cn/insights/",
        publisher: { "@type": "Organization", name: t("UCAC"), parentOrganization: { "@type": "Organization", name: "Holalobe" } },
        blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `https://ucac.cn/insights/${post.slug}`, datePublished: post.publishedAt })),
    };
    return (<InsightShell locale={locale}>
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="insights-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t("UCAC Insights \u00B7 Editorial")}</p>
            <h1 id="insights-title">{t("China admissions, explained with evidence")}</h1>
            <p>{t("Timely analysis of university notices, program lists, and scholarship announcements\u2014written to help international applicants make clearer decisions.")}</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href={editorialHref("#latest-insights", locale)}>{t("Explore latest insights")}</a>
              <Link className={styles.secondaryAction} href={editorialHref("/guides/", locale)}>{t("Browse application guides")}</Link>
            </div>
          </div>
          <aside className={styles.editorialPromise} aria-label={t("UCAC editorial standard")}>
            <p className={styles.promiseLabel}>{t("Our editorial standard")}</p>
            <strong>{t("Current, traceable, useful.")}</strong>
            <p>{t("Every article is dated, editorially reviewed, and separated from evergreen application guidance. Source links are included when the article relies on external evidence.")}</p>
            <dl>
              <div><dt>{posts.length}</dt><dd>{t("Published analyses")}</dd></div>
              <div><dt>{insightCategories.length}</dt><dd>{t("Editorial desks")}</dd></div>
              <div><dt>{t("Clear")}</dt><dd>{t("Evidence labels")}</dd></div>
            </dl>
          </aside>
        </section>

        <section className={styles.categorySection} aria-labelledby="insight-topics">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>{t("Browse by desk")}</p><h2 id="insight-topics">{t("Follow the part of admissions that matters to you")}</h2></div>
          </div>
          <ul className={styles.categoryNav} aria-label={t("Insight categories")}>
            {insightCategories.map(category => localizeCategory(category, locale)).map((category, index) => (<li key={category.slug}>
                <Link href={editorialHref(`/insights/category/${category.slug}`, locale)}>
                  <span className={styles.categoryNumber}>0{index + 1}</span>
                  <strong>{category.name}</strong>
                  <span>{category.description}</span>
                  <b aria-hidden="true">↗</b>
                </Link>
              </li>))}
          </ul>
        </section>

        {featuredPost ? (<section className={styles.featuredSection} aria-labelledby="featured-insight">
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>{t("Editor's lead")}</p><h2 id="featured-insight">{t("The briefing to read first")}</h2></div>
              <span>{t("Updated for the current admissions cycle")}</span>
            </div>
            <article className={styles.featuredCard}>
              <div className={styles.featuredVisual} aria-hidden="true">
                <span>{t("UCAC")}</span>
                <strong>{t("INSIGHT")}<br />01</strong>
                <i>{t("Admissions")}<br />{t("intelligence")}</i>
              </div>
              <div className={styles.featuredContent}>
                <p className={styles.eyebrow}>{localizeCategory(categoryFor(featuredPost), locale).name}</p>
                <h2>{featuredPost.title}</h2>
                <p>{featuredPost.description}</p>
                <div className={styles.meta}><span>{date(featuredPost.publishedAt, locale)}</span><span>{featuredPost.readingMinutes}{" " + t("min read")}</span><span>{t(featuredPost.author)}</span></div>
                <Link className={styles.readButton} href={editorialHref(`/insights/${featuredPost.slug}`, locale)}>{t("Read the briefing") + " "}<span aria-hidden="true">→</span></Link>
              </div>
            </article>
          </section>) : null}

        <section className={styles.latestSection} id="latest-insights" aria-labelledby="latest-heading">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>{t("Latest analysis")}</p><h2 id="latest-heading">{t("More from UCAC Insights")}</h2></div>
            <Link className={styles.rssLink} href={editorialHref("/insights/rss.xml", locale)}>{t("RSS feed \u2197")}</Link>
          </div>
          <div className={styles.grid}>
          {latestPosts.map((post, index) => {
            const category = localizeCategory(categoryFor(post), locale);
            return (<article className={styles.card} key={post.slug}>
                <span className={styles.cardIndex} aria-hidden="true">0{index + 2}</span>
                <p className={styles.eyebrow}>{category.name}</p>
                <h2>{post.title}</h2>
                <p>{post.description}</p>
                <div className={styles.meta}><span>{date(post.publishedAt, locale)}</span><span>{post.readingMinutes}{" " + t("min read")}</span><span>{t(post.author)}</span></div>
                <Link className={styles.cardLink} href={editorialHref(`/insights/${post.slug}`, locale)}>{t("Read analysis") + " "}<span aria-hidden="true">→</span></Link>
              </article>);
        })}
          </div>
        </section>

        <aside className={styles.methodBand} aria-label={t("UCAC publishing method")}>
          <div><p className={styles.eyebrow}>{t("How we publish")}</p><h2>{t("Useful analysis with clear evidence boundaries")}</h2></div>
          <ol>
            <li><span>01</span><strong>{t("Check")}</strong><p>{t("When an article relies on external facts, we review and name the relevant source.")}</p></li>
            <li><span>02</span><strong>{t("Explain")}</strong><p>{t("We separate confirmed facts from practical interpretation.")}</p></li>
            <li><span>03</span><strong>{t("Date")}</strong><p>{t("We show when the article and its sources were reviewed.")}</p></li>
          </ol>
        </aside>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
    </InsightShell>);
}
export async function generateMetadata({ searchParams }: {
    searchParams?: EditorialSearchParams;
}): Promise<Metadata> { return editorialMetadata(metadata, await editorialLocale(searchParams)); }
