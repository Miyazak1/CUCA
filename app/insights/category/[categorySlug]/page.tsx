import { editorial, editorialHref, editorialLocale, localizeInsight, localizeCategory, type EditorialSearchParams, type EditorialLocale } from "@/src/content/editorial.ts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsightShell } from "../../insight-shell";
import styles from "../../insights.module.css";
import { getInsightCategory } from "@/src/content/insights.ts";
import { listPublishedInsights } from "@/src/server/insights/public-insights.ts";
type PageProps = {
    params: Promise<{
        categorySlug: string;
    }>;
    searchParams?: EditorialSearchParams;
};
function date(value: string, locale: EditorialLocale) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
export const dynamic = "force-dynamic";
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const locale = await editorialLocale(searchParams);
    const t = editorial(locale);
    const originalCategory = getInsightCategory((await params).categorySlug);
    const category = originalCategory ? localizeCategory(originalCategory, locale) : null;
    if (!category)
        return { title: t("Insight category not found | UCAC"), robots: { index: false, follow: false } };
    const canonical = new URL(editorialHref(`/insights/category/${category.slug}`, locale), "https://ucac.cn").href;
    return { title: `${category.name} | UCAC Insights`, description: category.description, alternates: { canonical }, openGraph: { title: `${category.name} | UCAC Insights`, description: category.description, url: canonical, siteName: t("UCAC"), type: "website" } };
}
export default async function InsightCategoryPage({ params, searchParams }: PageProps) {
    const locale = await editorialLocale(searchParams);
    const t = editorial(locale);
    const originalCategory = getInsightCategory((await params).categorySlug);
    const category = originalCategory ? localizeCategory(originalCategory, locale) : null;
    if (!category)
        notFound();
    const posts = (await listPublishedInsights()).filter(post => post.category === category.slug).map(post => localizeInsight(post, locale));
    return (<InsightShell locale={locale}>
      <main className={styles.main}>
        <Link className={styles.back} href={editorialHref("/insights/", locale)}>{t("\u2190 All insights")}</Link>
        <section className={`${styles.hero} ${styles.categoryHero}`}>
          <p className={styles.eyebrow}>{t("UCAC Insights category")}</p>
          <h1>{category.name}</h1>
          <p>{category.description}</p>
        </section>
        <section className={styles.grid} aria-label={`${category.name} ${t("articles")}`}>
          {posts.map((post) => (<article className={styles.card} key={post.slug}>
              <p className={styles.eyebrow}>{category.name}</p>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              <div className={styles.meta}><span>{date(post.publishedAt, locale)}</span><span>{post.readingMinutes}{" " + t("min read")}</span></div>
              <Link className={styles.cardLink} href={editorialHref(`/insights/${post.slug}`, locale)}>{t("Read analysis \u2192")}</Link>
            </article>))}
        </section>
      </main>
    </InsightShell>);
}
