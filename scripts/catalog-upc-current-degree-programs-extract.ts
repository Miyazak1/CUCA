import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type DegreeLevel = "Bachelor" | "Master" | "Doctoral";
type TeachingLanguage = "Chinese" | "English";
type ProgramRow = { degreeLevel: DegreeLevel; teachingLanguage: TeachingLanguage; college: string; nameEn: string; durationYears: number; professional?: boolean; sourceId: string };
type PendingCell = { value: string; remaining: number };

const root = process.cwd();
const primaryRun = "2026-10-27T06-54-05-596Z";
const englishRun = "2026-10-27T06-55-13-699Z";
const locks = [
  [primaryRun, "upc-bachelor-programs-chinese-current", "78d9b8010a2489166cff12c898d98ec6e2c94e049d5efcb87818e8265a530c0b"],
  [primaryRun, "upc-master-programs-chinese-academic-current", "f7d9bc43929ca6371c8d8bf5bfd06aea7048088f4f6456e13f3c32c0c337c7b4"],
  [primaryRun, "upc-master-programs-chinese-professional-current", "5aaa8f8437e9577eb93dc17d87340bb7e4f09356e0b51616d0af008add96188b"],
  [primaryRun, "upc-doctoral-programs-current", "d2e0e529c6a4cc05f2cdd61b834c313f7f6ac1d84cde9959f2f5fe5b7b4f066d"],
  [englishRun, "upc-english-medium-programs-current", "bdbd24ab30db06cdd88930cbaa031e01bbba04796c734f0875146b296d6beb76"],
] as const;

const decode = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
const clean = (html: string) => decode(html.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const manifests = new Map<string, { sources: Source[] }>();
const sources = new Map<string, Source>();
for (const [run, id, sha] of locks) {
  let manifest = manifests.get(run);
  if (!manifest) {
    manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official", run, "manifest.json"), "utf8")) as { sources: Source[] };
    manifests.set(run, manifest);
  }
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha);
  if (!source) throw new Error(`Missing locked UPC source ${id}.`);
  const artifact = await readFile(resolve(root, "work/catalog-official", run, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== sha) throw new Error(`Hash mismatch ${id}.`);
  sources.set(id, source);
}

const sourceHtml = async (id: string) => {
  const lock = locks.find((item) => item[1] === id);
  if (!lock) throw new Error(`No lock for ${id}.`);
  const source = sources.get(id)!;
  return readFile(resolve(root, "work/catalog-official", lock[0], source.artifactPath), "utf8");
};

const tableGrid = (html: string) => {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => match[1]);
  const table = tables.sort((a, b) => (b.match(/<td\b/gi)?.length ?? 0) - (a.match(/<td\b/gi)?.length ?? 0))[0];
  if (!table) throw new Error("No table found.");
  const pending = new Map<number, PendingCell>();
  const grid: string[][] = [];
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/table>|$)/gi)) {
    const row: string[] = [];
    for (const [column, cell] of [...pending.entries()]) {
      row[column] = cell.value;
      cell.remaining -= 1;
      if (cell.remaining <= 0) pending.delete(column);
    }
    let column = 0;
    for (const cellMatch of rowMatch[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
      while (row[column] !== undefined) column += 1;
      const attributes = cellMatch[1];
      const value = clean(cellMatch[2]);
      const rowspan = Number.parseInt(attributes.match(/rowspan\s*=\s*["']?(\d+)/i)?.[1] ?? "1", 10);
      const colspan = Number.parseInt(attributes.match(/colspan\s*=\s*["']?(\d+)/i)?.[1] ?? "1", 10);
      for (let offset = 0; offset < colspan; offset += 1) {
        row[column + offset] = value;
        if (rowspan > 1) pending.set(column + offset, { value, remaining: rowspan - 1 });
      }
      column += colspan;
    }
    if (row.some(Boolean)) grid.push(row);
  }
  return grid;
};

const uniquePrograms = (grid: string[][], degreeLevel: DegreeLevel, professional = false): ProgramRow[] => {
  const durationColumn = grid.reduce((best, row) => Math.max(best, row.length - 1), 0);
  const seen = new Set<string>();
  const rows: ProgramRow[] = [];
  for (const row of grid) {
    const college = row[0]?.trim();
    const nameEn = row[1]?.trim();
    const durationYears = Number.parseInt(row[durationColumn] ?? "", 10);
    if (!college || !nameEn || /College\/School|Program/i.test(nameEn) || !Number.isFinite(durationYears)) continue;
    const key = `${college}\u0000${nameEn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ degreeLevel, teachingLanguage: "Chinese", college, nameEn, durationYears, ...(professional ? { professional: true } : {}), sourceId: professional ? "upc-master-programs-chinese-professional-current" : degreeLevel === "Bachelor" ? "upc-bachelor-programs-chinese-current" : degreeLevel === "Master" ? "upc-master-programs-chinese-academic-current" : "upc-doctoral-programs-current" });
  }
  return rows;
};

const bachelorChinese = uniquePrograms(tableGrid(await sourceHtml("upc-bachelor-programs-chinese-current")), "Bachelor");
const masterAcademic = uniquePrograms(tableGrid(await sourceHtml("upc-master-programs-chinese-academic-current")), "Master");
const masterProfessional = uniquePrograms(tableGrid(await sourceHtml("upc-master-programs-chinese-professional-current")), "Master", true);
const doctoralChinese = uniquePrograms(tableGrid(await sourceHtml("upc-doctoral-programs-current")), "Doctoral");

const englishSourceId = "upc-english-medium-programs-current";
const englishBachelorNames = [
  "Petroleum Engineering", "Geology", "Resource Exploration Engineering", "Mechanical Engineering", "Software Engineering", "Civil Engineering", "Architecture", "Big Data Management and Application", "New Energy Materials and Devices", "Electrical Engineering and Automation",
];
const englishMasterNames = ["Oil and Natural Gas Engineering", "Geological Resource and Geological Engineering", "Chemical Engineering and Technology"];
const englishBachelor: ProgramRow[] = englishBachelorNames.map((nameEn) => ({ degreeLevel: "Bachelor", teachingLanguage: "English", college: "College or school not stated on the official English-medium summary", nameEn, durationYears: nameEn === "Architecture" ? 5 : 4, sourceId: englishSourceId }));
const englishMaster: ProgramRow[] = englishMasterNames.map((nameEn) => ({ degreeLevel: "Master", teachingLanguage: "English", college: "College or school not stated on the official English-medium summary", nameEn, durationYears: 3, sourceId: englishSourceId }));
const englishDoctoral: ProgramRow[] = doctoralChinese.map((row) => ({ ...row, teachingLanguage: "English", sourceId: englishSourceId }));
const programs = [...bachelorChinese, ...englishBachelor, ...masterAcademic, ...masterProfessional, ...englishMaster, ...doctoralChinese, ...englishDoctoral];

const counts = {
  total: programs.length,
  bachelorChinese: bachelorChinese.length,
  bachelorEnglish: englishBachelor.length,
  masterChineseAcademic: masterAcademic.length,
  masterChineseProfessional: masterProfessional.length,
  masterEnglish: englishMaster.length,
  doctoralChinese: doctoralChinese.length,
  doctoralEnglish: englishDoctoral.length,
};
if (counts.bachelorEnglish !== 10 || counts.masterEnglish !== 3 || counts.masterChineseProfessional !== 1 || counts.doctoralChinese < 20 || counts.masterChineseAcademic < 20 || counts.bachelorChinese < 30) {
  throw new Error(`Unexpected UPC extraction counts: ${JSON.stringify(counts)}`);
}
const output = { version: 1, schoolSlug: "china-university-of-petroleum-east-china", scope: "Current official degree catalogs; no degree row is relabeled as 2027", counts, sources: locks.map(([run, id, sha256]) => ({ run, id, sha256, fetchedAt: sources.get(id)!.fetchedAt, url: sources.get(id)!.finalUrl ?? sources.get(id)!.url })), programs };
const outputPath = resolve(root, "catalog-sources/upc-current-degree-programs.extracted.json");
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, counts }, null, 2));
