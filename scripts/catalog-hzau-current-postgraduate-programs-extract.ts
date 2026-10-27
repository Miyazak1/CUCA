import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

type SourceSpec = {
  id: string;
  degreeLevel: "Master" | "Doctoral";
  college: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-27T06-10-24-109Z");
const outputPath = resolve(root, "catalog-sources/hzau-current-postgraduate-programs.extracted.json");

const sourceSpecs: SourceSpec[] = [
  { id: "hzau-master-plant-sciences-programs-current", degreeLevel: "Master", college: "College of Plant Sciences and Technology" },
  { id: "hzau-master-animal-veterinary-programs-current", degreeLevel: "Master", college: "College of Animal Sciences and Technology / College of Veterinary Medicine" },
  { id: "hzau-master-resources-environment-programs-current", degreeLevel: "Master", college: "College of Resources and Environment" },
  { id: "hzau-master-horticulture-forestry-programs-current", degreeLevel: "Master", college: "College of Horticulture and Forestry Sciences" },
  { id: "hzau-master-engineering-programs-current", degreeLevel: "Master", college: "College of Engineering" },
  { id: "hzau-master-fisheries-programs-current", degreeLevel: "Master", college: "College of Fisheries" },
  { id: "hzau-master-food-sciences-programs-current", degreeLevel: "Master", college: "College of Food Sciences and Technology" },
  { id: "hzau-master-humanities-social-sciences-programs-current", degreeLevel: "Master", college: "College of Humanities and Social Sciences" },
  { id: "hzau-master-informatics-programs-current", degreeLevel: "Master", college: "College of Informatics" },
  { id: "hzau-doctoral-plant-sciences-programs-current", degreeLevel: "Doctoral", college: "College of Plant Sciences and Technology" },
  { id: "hzau-doctoral-animal-veterinary-programs-current", degreeLevel: "Doctoral", college: "College of Animal Sciences and Technology / College of Veterinary Medicine" },
  { id: "hzau-doctoral-resources-environment-programs-current", degreeLevel: "Doctoral", college: "College of Resources and Environment" },
  { id: "hzau-doctoral-life-sciences-programs-current", degreeLevel: "Doctoral", college: "College of Life Sciences and Technology" },
  { id: "hzau-doctoral-horticulture-forestry-programs-current", degreeLevel: "Doctoral", college: "College of Horticulture and Forestry Sciences" },
  { id: "hzau-doctoral-economics-management-programs-current", degreeLevel: "Doctoral", college: "College of Economics and Management" },
  { id: "hzau-doctoral-engineering-programs-current", degreeLevel: "Doctoral", college: "College of Engineering" },
  { id: "hzau-doctoral-fisheries-programs-current", degreeLevel: "Doctoral", college: "College of Fisheries" },
  { id: "hzau-doctoral-food-sciences-programs-current", degreeLevel: "Doctoral", college: "College of Food Sciences and Technology" },
  { id: "hzau-doctoral-informatics-programs-current", degreeLevel: "Doctoral", college: "College of Informatics" },
];

const decodeEntities = (value: string) => value
  .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

const textContent = (html: string) => decodeEntities(html
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<\/p\s*>/gi, " ")
  .replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ")
  .trim();

const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const sourceMap = new Map(manifest.sources.map((source) => [source.id, source]));
const programs: Array<{
  degreeLevel: "Master" | "Doctoral";
  college: string;
  nameZh: string;
  nameEn: string;
  teachingLanguage: "Chinese" | "Chinese and English";
  sourceId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSha256: string;
  capturedAt: string;
}> = [];

for (const spec of sourceSpecs) {
  const source = sourceMap.get(spec.id);
  if (!source || source.status !== 200 || source.contentType !== "text/html") throw new Error(`Missing captured HZAU source: ${spec.id}`);
  const html = await readFile(resolve(runRoot, source.artifactPath), "utf8");
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error(`No program table found in ${spec.id}`);
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const parsedRows = rows.map((row) => [...row.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => ({ attributes: match[1], html: match[2] })));
  const columnCount = parsedRows[0]?.length ?? 0;
  if (columnCount < 2) throw new Error(`Unexpected HZAU table structure in ${spec.id}`);
  let extractedFromSource = 0;
  for (const cells of parsedRows.slice(1)) {
    if (cells.length !== columnCount) continue;
    const rawName = textContent(cells[0].html);
    if (!rawName || /Major|专业名称|专业\s*Major/i.test(rawName)) continue;
    const englishStart = rawName.search(/[A-Za-z]/);
    if (englishStart <= 0) throw new Error(`Could not split bilingual major name in ${spec.id}: ${rawName}`);
    const nameZh = rawName.slice(0, englishStart).replace(/[＊*]/g, "").trim();
    const nameEn = rawName.slice(englishStart).replace(/[＊*]/g, "").replace(/\s+/g, " ").trim();
    if (!nameZh || !nameEn) throw new Error(`Incomplete bilingual major name in ${spec.id}: ${rawName}`);
    const namesZh = nameZh.split(/\s*[;；]\s*/).filter(Boolean);
    const namesEn = nameEn.split(/\s*[;；]\s*/).filter(Boolean);
    if (namesZh.length !== namesEn.length) throw new Error(`Could not align bilingual major list in ${spec.id}: ${rawName}`);
    for (let index = 0; index < namesZh.length; index += 1) {
      programs.push({
        degreeLevel: spec.degreeLevel,
        college: spec.college,
        nameZh: namesZh[index],
        nameEn: namesEn[index],
        teachingLanguage: /[＊*]/.test(rawName) ? "Chinese" : "Chinese and English",
        sourceId: source.id,
        sourceUrl: source.finalUrl ?? source.url,
        sourceLabel: source.label,
        sourceSha256: source.sha256,
        capturedAt: source.fetchedAt,
      });
      extractedFromSource += 1;
    }
  }
  if (extractedFromSource === 0) throw new Error(`No HZAU majors extracted from ${spec.id}`);
}

const uniquePrograms = new Map<string, (typeof programs)[number]>();
for (const program of programs) {
  const key = `${program.degreeLevel}|${program.nameEn.toLowerCase()}`;
  const prior = uniquePrograms.get(key);
  if (prior && (prior.college !== program.college || prior.teachingLanguage !== program.teachingLanguage || prior.nameZh !== program.nameZh)) {
    throw new Error(`Conflicting duplicate HZAU program identity requires review: ${key}`);
  }
  uniquePrograms.set(key, prior ?? program);
}
const deduplicatedPrograms = [...uniquePrograms.values()];

const output = {
  version: 1,
  extractedAt: new Date().toISOString(),
  sourceRun: runRoot.replace(`${root}\\`, "").replaceAll("\\", "/"),
  sourceCount: sourceSpecs.length,
  programCount: deduplicatedPrograms.length,
  countsByDegree: {
    Master: deduplicatedPrograms.filter((program) => program.degreeLevel === "Master").length,
    Doctoral: deduplicatedPrograms.filter((program) => program.degreeLevel === "Doctoral").length,
  },
  programs: deduplicatedPrograms,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, sourceCount: sourceSpecs.length, programCount: deduplicatedPrograms.length, countsByDegree: output.countsByDegree }, null, 2));
