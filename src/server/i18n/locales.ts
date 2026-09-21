export const PUBLIC_UI_LOCALES = ["en", "vi", "th", "id", "ms", "ar"] as const;
export const STAFF_UI_LOCALES = ["zh-CN"] as const;
export const SUPPORTED_UI_LOCALES = [...PUBLIC_UI_LOCALES, ...STAFF_UI_LOCALES] as const;

export type PublicUiLocale = typeof PUBLIC_UI_LOCALES[number];
export type SupportedUiLocale = typeof SUPPORTED_UI_LOCALES[number];
export type TextDirection = "ltr" | "rtl";

export const UI_LOCALE_METADATA: Record<SupportedUiLocale, {
  nativeName: string; englishName: string; direction: TextDirection; publicLaunch: boolean;
}> = {
  en: { nativeName: "English", englishName: "English", direction: "ltr", publicLaunch: true },
  vi: { nativeName: "Tiếng Việt", englishName: "Vietnamese", direction: "ltr", publicLaunch: true },
  th: { nativeName: "ไทย", englishName: "Thai", direction: "ltr", publicLaunch: true },
  id: { nativeName: "Bahasa Indonesia", englishName: "Indonesian", direction: "ltr", publicLaunch: true },
  ms: { nativeName: "Bahasa Melayu", englishName: "Malay", direction: "ltr", publicLaunch: true },
  ar: { nativeName: "العربية", englishName: "Arabic", direction: "rtl", publicLaunch: true },
  "zh-CN": { nativeName: "简体中文", englishName: "Simplified Chinese", direction: "ltr", publicLaunch: false },
};

const aliases: Readonly<Record<string, SupportedUiLocale>> = {
  en: "en", vi: "vi", th: "th", id: "id", in: "id", ms: "ms", ar: "ar", zh: "zh-CN",
  "zh-cn": "zh-CN", "zh-hans": "zh-CN", "zh-sg": "zh-CN",
};

export function normalizeUiLocale(value: unknown): SupportedUiLocale | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const normalized = value.trim().replaceAll("_", "-").toLocaleLowerCase();
  if (!normalized) return null;
  return aliases[normalized] ?? aliases[normalized.split("-")[0]] ?? null;
}

export function uiLocaleDirection(value: unknown): TextDirection {
  const locale = normalizeUiLocale(value) ?? "en";
  return UI_LOCALE_METADATA[locale].direction;
}

export function parseAcceptLanguage(value: string | null | undefined): SupportedUiLocale[] {
  if (!value || value.length > 2048) return [];
  return value.split(",").map((part, index) => {
    const [tag, ...parameters] = part.trim().split(";");
    const quality = parameters.reduce((current, parameter) => {
      const match = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(parameter.trim());
      return match ? Number(match[1]) : current;
    }, 1);
    return { locale: normalizeUiLocale(tag), quality, index };
  }).filter((item): item is { locale: SupportedUiLocale; quality: number; index: number } => Boolean(item.locale) && item.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map(item => item.locale).filter((locale, index, all) => all.indexOf(locale) === index);
}

export function resolveUiLocale(input: {
  explicit?: unknown; account?: unknown; acceptLanguage?: string | null; publicOnly?: boolean;
}): SupportedUiLocale {
  const candidates = [normalizeUiLocale(input.explicit), normalizeUiLocale(input.account),
    ...parseAcceptLanguage(input.acceptLanguage), "en" as const];
  return candidates.find((locale): locale is SupportedUiLocale => Boolean(locale)
    && (!input.publicOnly || PUBLIC_UI_LOCALES.includes(locale as PublicUiLocale))) ?? "en";
}
