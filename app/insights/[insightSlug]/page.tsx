import { editorial, editorialHref, editorialLocale, localizeInsight, localizeCategory, type EditorialSearchParams, type EditorialLocale } from "@/src/content/editorial.ts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsightShell } from "../insight-shell";
import styles from "../insights.module.css";
import { categoryFor, type InsightSection } from "@/src/content/insights.ts";
import { getPublishedInsight } from "@/src/server/insights/public-insights.ts";
type PageProps = {
    params: Promise<{
        insightSlug: string;
    }>;
    searchParams?: EditorialSearchParams;
};
function date(value: string, locale: EditorialLocale) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}
function sectionOrder(section: InsightSection) {
    return section.contentOrder || [
        ...section.paragraphs.map((_, index) => `p:${index}`),
        ...(section.bullets?.length ? ["b"] : []),
        ...(section.tables || []).map((_, index) => `t:${index}`),
    ];
}
export const dynamic = "force-dynamic";
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const locale = await editorialLocale(searchParams);
    const t = editorial(locale);
    const original = await getPublishedInsight((await params).insightSlug);
    const post = original ? localizeInsight(original, locale) : null;
    if (!post)
        return { title: t("Insight not found | UCAC"), robots: { index: false, follow: false } };
    const canonical = new URL(editorialHref(`/insights/${post.slug}`, locale), "https://ucac.cn").href;
    return {
        title: `${post.title} | UCAC`,
        description: post.description,
        alternates: { canonical },
        openGraph: { title: post.title, description: post.description, url: canonical, siteName: t("UCAC"), type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt, authors: [post.author] },
    };
}
export default async function InsightPage({ params, searchParams }: PageProps) {
    const locale = await editorialLocale(searchParams);
    const t = editorial(locale);
    const original = await getPublishedInsight((await params).insightSlug);
    const post = original ? localizeInsight(original, locale) : null;
    if (!post)
        notFound();
    const category = localizeCategory(categoryFor(post), locale);
    const canonical = new URL(editorialHref(`/insights/${post.slug}`, locale), "https://ucac.cn").href;
    const jsonLd = {
        inLanguage: locale,
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
        publisher: { "@type": "Organization", name: t("UCAC"), url: "https://ucac.cn/", parentOrganization: { "@type": "Organization", name: "Holalobe" } },
        ...(post.sources.length ? { citation: post.sources.map((source) => source.url) } : {}),
    };
    return (<InsightShell locale={locale}>
      <main className={`${styles.main} ${styles.article}`}>
        <Link className={styles.back} href={editorialHref("/insights/", locale)}>{t("\u2190 All insights")}</Link>
        <article>
          {post.translationMissing ? <p role="status">{t("English content shown")}: {t("This content is awaiting translation.")}</p> : null}
          <header className={styles.articleHeader}>
            <Link className={`${styles.eyebrow} ${styles.categoryLink}`} href={editorialHref(`/insights/category/${category.slug}`, locale)}>{category.name}</Link>
            <h1>{post.title}</h1>
            <p className={styles.dek}>{post.description}</p>
            <div className={styles.meta}><span>{t("Published") + " "}{date(post.publishedAt, locale)}</span><span>{t("Updated") + " "}{date(post.updatedAt, locale)}</span><span>{post.readingMinutes}{" " + t("min read")}</span><span>{t(post.author)}</span></div>
            <div className={styles.tags} aria-label={t("Topics")}>{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </header>

          {post.sections.map((section) => (<section className={styles.section} id={section.id} key={section.id}>
              <h2>{section.heading}</h2>
              {sectionOrder(section).map((token) => {
                if (token.startsWith("p:")) {
                    const index = Number(token.slice(2));
                    return <p key={token}>{section.paragraphs[index]}</p>;
                }
                if (token === "b")
                    return section.bullets?.length
                        ? <ul key={token}>{section.bullets.map((bullet, index) => <li key={`${index}-${bullet}`}>{bullet}</li>)}</ul>
                        : null;
                const index = Number(token.slice(2)), table = section.tables?.[index];
                // The overflow region must be keyboard-focusable so wide tables can be scrolled without a pointer.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                return table ? <div className={styles.tableWrap} key={token} role="region" aria-label={`${section.heading} ${t("Table")}`} tabIndex={0}>
                  <table className={styles.articleTable}>
                    <thead><tr>{table.headers.map((header, column) => <th scope="col" key={`${column}-${header}`}>{header}</th>)}</tr></thead>
                    <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div> : null;
            })}
            </section>))}

          {post.sources.length ? <section className={styles.sourceBox}>
            <p className={styles.eyebrow}>{t("Evidence")}</p>
            <h2>{t("Official sources checked for this article")}</h2>
            <p>{t("University requirements can change after publication. Open the source and confirm it still applies to your program and intake.")}</p>
            <ul className={styles.sourceList}>
              {post.sources.map((source) => <li key={source.url}><a href={editorialHref(source.url, locale)} target="_blank" rel="noopener noreferrer">{source.label}</a> <span>{t("\u00B7 checked") + " "}{date(source.checkedAt, locale)}</span></li>)}
            </ul>
          </section> : null}

          {post.relatedGuides.length ? <aside className={styles.related}>
            <p className={styles.eyebrow}>{t("Evergreen guidance")}</p>
            <h2>{t("Use the related UCAC guide")}</h2>
            <p>{t("Insights explain what is changing; Guides turn the evidence into a repeatable application process.")}</p>
            <div className={styles.relatedLinks}>{post.relatedGuides.map((guide) => <Link href={editorialHref(guide.href, locale)} key={guide.href}>{guide.label} →</Link>)}</div>
          </aside> : null}
        </article>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
    </InsightShell>);
}
