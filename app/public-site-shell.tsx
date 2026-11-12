import Script from "next/script";
import type { EditorialLocale } from "../src/content/editorial.ts";
import assetVersions from "../config/public-asset-versions.json" with { type: "json" };

const SHELL_STYLE_RELEASE = assetVersions["shared-shell.css"];
const SHELL_RUNTIME_RELEASE = assetVersions["shared-shell.js"];
const I18N_RUNTIME_RELEASE = assetVersions["i18n-runtime.js"];

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
      <Script src={`/i18n-runtime.js?v=${I18N_RUNTIME_RELEASE}`} strategy="afterInteractive" />
      <Script src={`/shared-shell.js?v=${SHELL_RUNTIME_RELEASE}`} strategy="afterInteractive" />
    </div>
  );
}
