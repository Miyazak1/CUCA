import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideShell } from "../guide-shell";
import styles from "../guides.module.css";
import { getPublishedGuidePage } from "@/src/server/catalog/public-guide-pages.ts";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ guideSlug: string }> };
type GuideSection = { key?: string; headingEn?: string; bodyEn?: string };
type GuideSource = { url: string; label: string; capturedAt: string };

function safeSections(value: unknown): GuideSection[] {
  return Array.isArray(value) ? value.filter((item): item is GuideSection => Boolean(item && typeof item === "object")) : [];
}
function safeSources(value: unknown): GuideSource[] {
  return Array.isArray(value) ? value.filter((item): item is GuideSource => {
    if (!item || typeof item !== "object") return false;
    const source = item as Partial<GuideSource>;
    return typeof source.url === "string" && /^https?:\/\//.test(source.url) && typeof source.label === "string" && typeof source.capturedAt === "string";
  }) : [];
}

function paragraphs(value: string | undefined) {
  return String(value || "").split(/\n{2,}|\n(?=[A-Z0-9])/).map((item) => item.trim()).filter(Boolean);
}

function date(value: Date | string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { guideSlug } = await params;
  let guide = null;
  try {
    guide = await getPublishedGuidePage(guideSlug);
  } catch {
    return {
      title: "Guide temporarily unavailable | UCAC",
      description: "The reviewed UCAC guide catalog is temporarily unavailable.",
      robots: { index: false, follow: false },
    };
  }
  if (!guide) return { title: "Guide not found | UCAC", robots: { index: false, follow: false } };
  const canonical = `https://ucac.cn/guides/${guide.slug}`;
  const description = guide.summaryEn || guide.subtitleEn || "Reviewed UCAC China university application guidance.";
  return {
    title: `${guide.titleEn} | UCAC`,
    description,
    alternates: { canonical },
    openGraph: { title: guide.titleEn, description, url: canonical, siteName: "UCAC", type: "article", publishedTime: guide.publishedAt.toISOString(), modifiedTime: guide.updatedAt.toISOString() },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { guideSlug } = await params;
  let guide = null;
  try {
    guide = await getPublishedGuidePage(guideSlug);
  } catch {
    return (
      <GuideShell>
        <main className={`${styles.main} ${styles.article}`}>
          <Link className={styles.back} href="/guides/">← All guides</Link>
          <div className={styles.state} role="status">
            This guide is temporarily unavailable because the reviewed catalog could not be read safely. Please try again later.
          </div>
        </main>
      </GuideShell>
    );
  }
  if (!guide) notFound();

  const sections = safeSections(guide.content?.sections);
  const sources = safeSources(guide.content?.sources);
  const canonical = `https://ucac.cn/guides/${guide.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.titleEn,
    description: guide.summaryEn || guide.subtitleEn || undefined,
    mainEntityOfPage: canonical,
    datePublished: guide.publishedAt.toISOString(),
    dateModified: guide.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "UCAC Editorial" },
    publisher: { "@type": "Organization", name: "UCAC", url: "https://ucac.cn/", parentOrganization: { "@type": "Organization", name: "Holalobe" } },
    citation: sources.map((source) => source.url),
  };

  return (
    <GuideShell>
      <main className={`${styles.main} ${styles.article}`}>
        <Link className={styles.back} href="/guides/">← All guides</Link>
        <article>
          <header className={styles.articleHeader}>
            <p className={styles.eyebrow}>{guide.verificationStatus === "verified" ? "Reviewed UCAC guide" : "Published UCAC guide"}</p>
            <h1>{guide.titleEn}</h1>
            {guide.subtitleEn ? <p className={styles.dek}>{guide.subtitleEn}</p> : null}
            {guide.summaryEn && guide.summaryEn !== guide.subtitleEn ? <p className={styles.dek}>{guide.summaryEn}</p> : null}
            <div className={styles.meta}>
              <span>Published {date(guide.publishedAt)}</span>
              <span>Updated {date(guide.updatedAt)}</span>
              <span>Version {guide.version}</span>
            </div>
          </header>

          {sections.length ? sections.map((section, index) => (
            <section className={styles.section} id={section.key || `section-${index + 1}`} key={section.key || index}>
              <h2>{section.headingEn || `Section ${index + 1}`}</h2>
              {paragraphs(section.bodyEn).map((body, paragraphIndex) => <p key={paragraphIndex}>{body}</p>)}
            </section>
          )) : (
            <section className={styles.section}>
              <h2>Guide status</h2>
              <p>This reviewed guide summary is published, while its expanded sections are being prepared. Use the linked catalog and official sources before making an application decision.</p>
            </section>
          )}

          {sources.length ? (
            <section className={styles.sourceBox}>
              <p className={styles.eyebrow}>Evidence</p>
              <h2>Official sources</h2>
              <p>Requirements and dates can change. Open the source and confirm it still applies to your intake.</p>
              <ul className={styles.sourceList}>
                {sources.map((source) => (
                  <li key={`${source.url}-${source.capturedAt}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> <span>· checked {date(source.capturedAt)}</span></li>
                ))}
              </ul>
            </section>
          ) : null}

          <aside className={styles.cta}>
            <p className={styles.eyebrow}>Continue with current data</p>
            <h2>Connect this guide to a real study route</h2>
            <p>Compare published records and verify the exact university requirement before applying through the university&apos;s official channel.</p>
            <div className={styles.ctaLinks}>
              <a href="/programs.html" data-analytics-event="guide_cta_click" data-analytics-target="programs">Browse programs</a>
              <a href="/universities.html" data-analytics-event="guide_cta_click" data-analytics-target="universities">Compare universities</a>
              <a href="/scholarships.html" data-analytics-event="guide_cta_click" data-analytics-target="scholarships">Explore scholarships</a>
            </div>
          </aside>
        </article>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </GuideShell>
  );
}
