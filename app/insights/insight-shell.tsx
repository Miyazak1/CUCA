import Link from "next/link";
import styles from "./insights.module.css";

export function InsightShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.page}>
      <div className={styles.notice}>Current-cycle China admissions analysis with official sources</div>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/">
            <img src="/ucac-icon.png?v=20261009-holalobe-brand" alt="" />
            <span>UCAC <small>by Holalobe</small></span>
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            <a href="/programs.html">Programs</a>
            <a href="/universities.html">Universities</a>
            <a href="/scholarships.html">Scholarships</a>
            <Link href="/guides/">Guides</Link>
            <Link href="/insights/">Insights</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© 2026 UCAC · by Holalobe</span>
          <div className={styles.footerLinks}>
            <Link href="/insights/rss.xml">RSS</Link>
            <a href="/about.html">About UCAC and Holalobe</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
