import { PublicSiteShell } from "../public-site-shell";
import styles from "./guides.module.css";

export function GuideShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PublicSiteShell
      active="guides"
      note="China admissions:"
      noteDetail="reviewed guidance with official sources"
      pageClassName={styles.page}
    >
      {children}
    </PublicSiteShell>
  );
}
