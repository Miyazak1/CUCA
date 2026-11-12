import Script from "next/script";
import type { EditorialLocale } from "../src/content/editorial.ts";

const SHELL_STYLE_RELEASE = "20261112-catalog-body";
const SHELL_RUNTIME_RELEASE = "20261111-wordmark";

export function PublicSiteShell({
  active,
  note,
  noteDetail,
  children,
  pageClassName,
  locale = "en",
}: Readonly<{
  active: "guides" | "insights";
  note: string;
  noteDetail?: string;
  children: React.ReactNode;
  pageClassName?: string;
  locale?: EditorialLocale;
}>) {
  return (
    <div className={pageClassName} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-i18n-locales="en,vi,th,id,ms,ar">
      <link rel="stylesheet" href={`/shared-shell.css?v=${SHELL_STYLE_RELEASE}`} />
      <div
        data-cuac-header
        data-active={active}
        data-note={note}
        data-note-detail={noteDetail || undefined}
      />
      {children}
      <div data-cuac-footer />
      <Script src={`/i18n-runtime.js?v=${SHELL_RUNTIME_RELEASE}`} strategy="afterInteractive" />
      <Script src={`/shared-shell.js?v=${SHELL_RUNTIME_RELEASE}`} strategy="afterInteractive" />
    </div>
  );
}
