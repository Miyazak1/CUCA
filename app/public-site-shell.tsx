import Script from "next/script";

const SHELL_RELEASE = "20261009-public-content-shell";

export function PublicSiteShell({
  active,
  note,
  noteDetail,
  children,
  pageClassName,
}: Readonly<{
  active: "guides" | "insights";
  note: string;
  noteDetail?: string;
  children: React.ReactNode;
  pageClassName?: string;
}>) {
  return (
    <div className={pageClassName}>
      <link rel="stylesheet" href={`/shared-shell.css?v=${SHELL_RELEASE}`} />
      <div
        data-cuac-header
        data-active={active}
        data-note={note}
        data-note-detail={noteDetail || undefined}
      />
      {children}
      <div data-cuac-footer />
      <Script src={`/i18n-runtime.js?v=${SHELL_RELEASE}`} strategy="afterInteractive" />
      <Script src={`/shared-shell.js?v=${SHELL_RELEASE}`} strategy="afterInteractive" />
    </div>
  );
}
