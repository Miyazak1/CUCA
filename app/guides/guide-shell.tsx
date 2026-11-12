import { PublicSiteShell } from "../public-site-shell";
import styles from "./guides.module.css";
import type { EditorialLocale } from "../../src/content/editorial.ts";

export function GuideShell({ children, locale = "en" }: Readonly<{ children: React.ReactNode; locale?: EditorialLocale }>) {
  return (
    <PublicSiteShell
      locale={locale}
      active="guides"
      note="China admissions:"
      noteDetail="reviewed guidance with official sources"
      pageClassName={styles.page}
    >
      {children}
    </PublicSiteShell>
  );
}
