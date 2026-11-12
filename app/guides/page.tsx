import { editorial, editorialHref, editorialLocale, editorialMetadata, localizeGuide, type EditorialSearchParams, type EditorialLocale } from "@/src/content/editorial.ts";
import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "./guide-shell";
import styles from "./guides.module.css";
import { listPublishedGuidePages } from "@/src/server/catalog/public-guide-pages.ts";
export const dynamic = "force-dynamic";
const metadata: Metadata = {
    title: "China application guides | UCAC",
    description: "Reviewed UCAC guidance for choosing programs, comparing scholarships, checking language routes, and preparing China university applications.",
    alternates: { canonical: "https://ucac.cn/guides/" },
    openGraph: {
        title: "China application guides | UCAC",
        description: "Reviewed guidance connected to current UCAC programs, universities, scholarships, and cities.",
        url: "https://ucac.cn/guides/",
        siteName: "UCAC",
        type: "website",
    },
};
function formatDate(value: Date, locale: EditorialLocale) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(value);
}
export default async function GuidesPage({ searchParams }: {
    searchParams?: EditorialSearchParams;
}) {
    const locale = await editorialLocale(searchParams);
    const t = editorial(locale);
    let guides: Array<ReturnType<typeof localizeGuide>> = [];
    let unavailable = false;
    try {
        guides = (await listPublishedGuidePages()).map(guide => localizeGuide(guide, locale));
    }
    catch {
        unavailable = true;
    }
    const jsonLd = {
        inLanguage: locale,
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("UCAC China application guides"),
        url: "https://ucac.cn/guides/",
        isPartOf: { "@type": "WebSite", name: t("UCAC"), url: "https://ucac.cn/" },
        publisher: { "@type": "Organization", name: t("UCAC"), parentOrganization: { "@type": "Organization", name: "Holalobe" } },
    };
    return (<GuideShell locale={locale}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{t("UCAC Guides")}</p>
          <h1>{t("Make a clearer China study decision")}</h1>
          <p>{t("Reviewed explanations, checklists, and comparison frameworks connected to UCAC's current catalog. Always confirm changing dates and requirements on the cited official source.")}</p>
        </section>

        {unavailable ? (<div className={styles.state} role="status">{t("The guide library is temporarily unavailable. No guide count is shown until the reviewed catalog can be read safely.")}</div>) : guides.length ? (<section className={styles.grid} aria-label={t("Published guides")}>
            {guides.map((guide) => (<article className={styles.card} key={guide.id}>
                <p className={styles.eyebrow}>{guide.verificationStatus === "verified" ? t("Reviewed guide") : t("Published guide")}</p>
                <h2>{guide.titleEn}</h2>
                <p>{guide.summaryEn || guide.subtitleEn || t("Open the guide for reviewed application guidance and official sources.")}</p>
                <div className={styles.meta}>
                  <span>{t("Version") + " "}{guide.version}</span>
                  <span>{t("Updated") + " "}{formatDate(guide.updatedAt, locale)}</span>
                </div>
                <Link className={styles.cardLink} href={editorialHref(`/guides/${encodeURIComponent(guide.slug)}`, locale)}>{t("Read guide \u2192")}</Link>
              </article>))}
          </section>) : (<div className={styles.state} role="status">{t("No reviewed guides are currently published.")}</div>)}
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
    </GuideShell>);
}
export async function generateMetadata({ searchParams }: {
    searchParams?: EditorialSearchParams;
}): Promise<Metadata> { return editorialMetadata(metadata, await editorialLocale(searchParams)); }
