import type { Metadata } from "next";
import type { PublicGuideDto } from "../server/catalog/dto.ts";
import type { InsightPost, InsightCategory } from "./insights.ts";
import en from "./editorial-translations/en.json" with { type: "json" };
import vi from "./editorial-translations/vi.json" with { type: "json" };
import th from "./editorial-translations/th.json" with { type: "json" };
import id from "./editorial-translations/id.json" with { type: "json" };
import ms from "./editorial-translations/ms.json" with { type: "json" };
import ar from "./editorial-translations/ar.json" with { type: "json" };

export const EDITORIAL_LOCALES = ["en", "vi", "th", "id", "ms", "ar"] as const;
export type EditorialLocale = typeof EDITORIAL_LOCALES[number];
export type EditorialSearchParams = Promise<Record<string, string | string[] | undefined>>;
type Bundle = Record<keyof typeof en, Record<string, string>>;
const bundles: Record<Exclude<EditorialLocale, "en">, Bundle> = { vi, th, id, ms, ar };
const sourceIndex = new Map<string, [keyof typeof en, string]>();
for (const group of Object.keys(en) as Array<keyof typeof en>) en[group].forEach((text, index) => sourceIndex.set(text.replace(/\s+/g, " ").trim(), [group, String(index)]));

export async function editorialLocale(searchParams?: EditorialSearchParams): Promise<EditorialLocale> {
  const value = (await searchParams)?.lang;
  const tag = (Array.isArray(value) ? value[0] : value)?.toLowerCase().split("-")[0];
  return EDITORIAL_LOCALES.find(locale => locale === tag) || "en";
}

export function editorial(locale: EditorialLocale) {
  return (text: string): string => {
    if (locale === "en") return text;
    const key = sourceIndex.get(text.replace(/\s+/g, " ").trim());
    return key ? bundles[locale][key[0]][key[1]] || text : text;
  };
}

export function hasEditorialTranslation(text: string | null | undefined, locale: EditorialLocale): boolean {
  if (!text || locale === "en") return true;
  const key = sourceIndex.get(text.replace(/\s+/g, " ").trim());
  return Boolean(key && bundles[locale][key[0]][key[1]]);
}

export function editorialHref(href: string, locale: EditorialLocale): string {
  if (!href.startsWith("/") || href.startsWith("//") || href.split(/[?#]/)[0].endsWith(".xml")) return href;
  const url = new URL(href, "https://ucac.cn");
  url.searchParams.set("lang", locale);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function localizeGuide(guide: PublicGuideDto, locale: EditorialLocale) {
  const t = editorial(locale);
  const sections = guide.content.sections.filter((s): s is Record<string, string> => Boolean(s && typeof s === "object"));
  const approved = locale === "en" ? null : guide.content.translations?.[locale];
  const complete = Boolean(approved) || [guide.titleEn, guide.subtitleEn, guide.summaryEn, ...sections.flatMap(s => [s.headingEn, s.bodyEn])].every(text => hasEditorialTranslation(text, locale));
  if (!complete) return { ...guide, translationMissing: true };
  return { ...guide, translationMissing: false,
    titleEn: approved?.title || t(guide.titleEn),
    subtitleEn: approved?.subtitle ?? (guide.subtitleEn ? t(guide.subtitleEn) : null),
    summaryEn: approved?.summary ?? (guide.summaryEn ? t(guide.summaryEn) : null),
    content: { ...guide.content, sections: approved ? approved.sections.map(s => ({ key: s.key, headingEn: s.heading, bodyEn: s.body })) : sections.map(s => ({ ...s, headingEn: t(s.headingEn || ""), bodyEn: t(s.bodyEn || "") })) },
  };
}

export function localizeInsight(post: InsightPost, locale: EditorialLocale) {
  if (locale === "en") return { ...post, translationMissing: false };
  const t = editorial(locale);
  const content = [post.title, post.description, ...post.tags, ...post.sections.flatMap(s => [s.heading, ...s.paragraphs, ...s.bullets || [], ...(s.tables || []).flatMap(table => [...table.headers, ...table.rows.flat()])]), ...post.relatedGuides.map(g => g.label)];
  if (!content.every(text => hasEditorialTranslation(text, locale))) return { ...post, translationMissing: true };
  return { ...post, translationMissing: false, title: t(post.title), description: t(post.description), tags: post.tags.map(t),
    sections: post.sections.map(s => ({ ...s, heading: t(s.heading), paragraphs: s.paragraphs.map(t), bullets: s.bullets?.map(t), tables: s.tables?.map(table => ({ headers: table.headers.map(t), rows: table.rows.map(row => row.map(t)) })) })),
    relatedGuides: post.relatedGuides.map(guide => ({ ...guide, label: t(guide.label) })),
  };
}

export function localizeCategory(category: InsightCategory, locale: EditorialLocale): InsightCategory {
  const t = editorial(locale);
  return { ...category, name: t(category.name), description: t(category.description) };
}

export function editorialMetadata(metadata: Metadata, locale: EditorialLocale): Metadata {
  const t = editorial(locale);
  const canonical = typeof metadata.alternates?.canonical === "string" ? new URL(metadata.alternates.canonical) : null;
  if (canonical && locale !== "en") canonical.searchParams.set("lang", locale);
  return { ...metadata, title: typeof metadata.title === "string" ? t(metadata.title) : metadata.title,
    description: metadata.description ? t(metadata.description) : metadata.description,
    alternates: canonical ? { ...metadata.alternates, canonical: canonical.href,
      languages: Object.fromEntries(EDITORIAL_LOCALES.map(language => [language, new URL(editorialHref(canonical.pathname, language), canonical.origin).href])) } : metadata.alternates,
    openGraph: metadata.openGraph ? { ...metadata.openGraph, url: canonical?.href || metadata.openGraph.url, title: typeof metadata.openGraph.title === "string" ? t(metadata.openGraph.title) : metadata.openGraph.title, description: metadata.openGraph.description ? t(metadata.openGraph.description) : metadata.openGraph.description } : undefined };
}
