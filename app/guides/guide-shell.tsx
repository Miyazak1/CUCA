import Link from "next/link";
import styles from "./guides.module.css";

export function GuideShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.page}>
      <div className={styles.notice}>China admissions guidance with reviewed sources</div>
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
            <a href="/cities.html">Cities</a>
            <Link href="/guides/">Guides</Link>
            <Link href="/insights/">Insights</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© 2026 UCAC · by Holalobe</span>
          <a href="/about.html">About UCAC and Holalobe</a>
        </div>
      </footer>
    </div>
  );
}
