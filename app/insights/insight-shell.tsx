import { PublicSiteShell } from "../public-site-shell";
import styles from "./insights.module.css";

export function InsightShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PublicSiteShell
      active="insights"
      note="China admissions:"
      noteDetail="current-cycle analysis with official sources"
      pageClassName={styles.page}
    >
      {children}
    </PublicSiteShell>
  );
}
