import { PublicSiteShell } from "../public-site-shell";
import styles from "./insights.module.css";
import type { EditorialLocale } from "../../src/content/editorial.ts";

export function InsightShell({ children, locale = "en" }: Readonly<{ children: React.ReactNode; locale?: EditorialLocale }>) {
  return (
    <PublicSiteShell
      locale={locale}
      active="insights"
      note="China admissions:"
      noteDetail="current-cycle admissions analysis"
      pageClassName={styles.page}
    >
      {children}
    </PublicSiteShell>
  );
}
