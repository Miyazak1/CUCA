import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "./guide-shell";
import styles from "./guides.module.css";
import { listPublishedGuidePages } from "@/src/server/catalog/public-guide-pages.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}
export default async function GuidesPage() {
  let guides = [];
  let unavailable = false;
  try {
    guides = await listPublishedGuidePages();
  } catch {
    unavailable = true;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "UCAC China application guides",
    url: "https://ucac.cn/guides/",
    isPartOf: { "@type": "WebSite", name: "UCAC", url: "https://ucac.cn/" },
    publisher: { "@type": "Organization", name: "UCAC", parentOrganization: { "@type": "Organization", name: "Holalobe" } },
  };

  return (
    <GuideShell>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>UCAC Guides</p>
          <h1>Make a clearer China study decision</h1>
          <p>Reviewed explanations, checklists, and comparison frameworks connected to UCAC&apos;s current catalog. Always confirm changing dates and requirements on the cited official source.</p>
        </section>

        {unavailable ? (
          <div className={styles.state} role="status">
            The guide library is temporarily unavailable. No guide count is shown until the reviewed catalog can be read safely.
          </div>
        ) : guides.length ? (
          <section className={styles.grid} aria-label="Published guides">
            {guides.map((guide) => (
              <article className={styles.card} key={guide.id}>
                <p className={styles.eyebrow}>{guide.verificationStatus === "verified" ? "Reviewed guide" : "Published guide"}</p>
                <h2>{guide.titleEn}</h2>
                <p>{guide.summaryEn || guide.subtitleEn || "Open the guide for reviewed application guidance and official sources."}</p>
                <div className={styles.meta}>
                  <span>Version {guide.version}</span>
                  <span>Updated {formatDate(guide.updatedAt)}</span>
                </div>
                <Link className={styles.cardLink} href={`/guides/${encodeURIComponent(guide.slug)}`}>Read guide →</Link>
              </article>
            ))}
          </section>
        ) : (
          <div className={styles.state} role="status">No reviewed guides are currently published.</div>
        )}
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </GuideShell>
  );
}
