import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { prepareSchoolLogo, SCHOOL_LOGO_MAX_BYTES, type SchoolLogoInput } from "./school-logo.ts";

export type SchoolLogoDescriptor = { file: string; sourceUrl: string; sourceNote?: string };
export async function prepareSeedSchoolLogos(schools: readonly { slug: string; logo?: SchoolLogoDescriptor }[], root: string) {
  if (!schools.some(school => school.logo)) return new Map<string, SchoolLogoInput>();
  const directory = await realpath(root), logos = new Map<string, SchoolLogoInput>();
  for (const school of schools) {
    if (!school.logo) continue;
    const { file, sourceUrl, sourceNote } = school.logo;
    if (typeof file !== "string" || isAbsolute(file) || !file.toLowerCase().endsWith(".png")) throw new Error("School logo file must be a relative PNG path.");
    const target = await realpath(resolve(directory, file)), local = relative(directory, target);
    if (isAbsolute(local) || local === ".." || local.startsWith("..\\") || local.startsWith("../")) throw new Error("Logo file escapes the configured import root.");
    const info = await stat(target);
    if (!info.isFile() || info.size > SCHOOL_LOGO_MAX_BYTES) throw new Error("Logo file exceeds its size limit.");
    if (logos.has(school.slug)) throw new Error("Duplicate school logo slug.");
    logos.set(school.slug, prepareSchoolLogo(await readFile(target), sourceUrl, sourceNote));
  }
  return logos;
}
