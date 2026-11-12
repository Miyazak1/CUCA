export type LegacySearchParams = Record<string, string | string[] | undefined>;

export function legacyPageHref(path: string, values: LegacySearchParams, authoritative: Record<string, string> = {}, consumed: string[] = []) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (consumed.includes(key)) continue;
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  // An ID selected by the path cannot be replaced by a conflicting query value.
  for (const [key, value] of Object.entries(authoritative)) query.set(key, value);
  const suffix = query.toString();
  return path + (suffix ? `?${suffix}` : "");
}
