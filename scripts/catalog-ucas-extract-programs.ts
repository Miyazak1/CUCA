import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const raw = resolve(root, "work/catalog-official/ucas-complete-batch-01/raw");
const output = resolve(root, "work/catalog-official/ucas-complete-batch-01/parsed-programs.json");
const files = await readdir(raw);
const file = files.find((name) => name.startsWith("ucas-international-major-index-current.") && name.endsWith(".html"));
if (!file) throw new Error("UCAS major index snapshot is missing.");
const source = await readFile(resolve(raw, file), "utf8");
const decode = (value: string) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#0*39;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const matches = [...source.matchAll(/<a[^>]+href="([^"]*subjectcode[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
const byCode = new Map<string, Set<string>>();
for (const match of matches) {
  const code = match[1].match(/[?&]subjectcode=([^&"#]+)/i)?.[1].trim();
  const nameEn = decode(match[2]);
  if (!code || !nameEn) continue;
  const names = byCode.get(code) ?? new Set<string>();
  names.add(nameEn);
  byCode.set(code, names);
}
const programs = [...byCode]
  .filter(([, names]) => names.size === 1)
  .map(([subjectCode, names]) => ({
    subjectCode,
    nameEn: [...names][0],
    degreeLevel: "Master",
    teachingLanguage: "English",
    sourceLocator: `major index subjectcode=${subjectCode}`,
  }))
  .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
const excludedAmbiguousCodes = [...byCode]
  .filter(([, names]) => names.size > 1)
  .map(([subjectCode, names]) => ({ subjectCode, labels: [...names].sort() }))
  .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
if (!programs.length || programs.some((row) => !/^[-A-Z0-9]+$/i.test(row.subjectCode))) {
  throw new Error("UCAS major index extraction failed closed.");
}
const payload = {
  version: 1,
  sourceFile: `work/catalog-official/ucas-complete-batch-01/raw/${file}`,
  interpretation: "The 2026 admission call directly links this official index as the English-instructed master's-program list.",
  rawLinkCount: matches.length,
  distinctSubjectCodeCount: byCode.size,
  programCount: programs.length,
  excludedAmbiguousCodeCount: excludedAmbiguousCodes.length,
  programs,
  excludedAmbiguousCodes,
};
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, output, rawLinkCount: matches.length, distinctSubjectCodeCount: byCode.size, programCount: programs.length, excludedAmbiguousCodeCount: excludedAmbiguousCodes.length }, null, 2));
