import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(workRoot, "tsinghua-complete-batch-01/parsed-routes.json");

const expected: Record<string, string> = {
  "tsinghua-international-undergraduate-divisions-2026": "6a4281c15e754f284d0ee60ff2446f83f4950455bdcbd49f4b7371e7e2a5671b",
  "tsinghua-graduate-programs-english": "0f48027b774cb983b0152b76496a2a2a6cfb7eb520b1328e0ca0842400cc48e1",
};

const decode = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));

const lines = (html: string) => decode(html
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/p>/gi, "\n")
  .replace(/<[^>]+>/g, " "))
  .split(/\n+/)
  .map((line) => line.replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim())
  .filter(Boolean);

type Cell = { attrs: string; lines: string[] };
const tableRows = (table: string): Cell[][] => [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
  [...row[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => ({ attrs: cell[1], lines: lines(cell[2]) })),
);

const manifests: Array<{ dir: string; source: any }> = [];
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifestPath = join(workRoot, entry.name, "manifest.json");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const source of manifest.sources ?? []) manifests.push({ dir: dirname(manifestPath), source });
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const snapshots = new Map<string, { source: any; html: string }>();
for (const [id, sha256] of Object.entries(expected)) {
  const match = manifests.find((item) => item.source.id === id && item.source.sha256 === sha256 && item.source.status === 200);
  if (!match) throw new Error(`Missing locked official snapshot: ${id} ${sha256}`);
  snapshots.set(id, { source: match.source, html: await readFile(join(match.dir, match.source.artifactPath), "utf8") });
}

const undergraduateHtml = snapshots.get("tsinghua-international-undergraduate-divisions-2026")!.html;
const undergraduateTables = [...undergraduateHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
if (undergraduateTables.length < 3) throw new Error(`Expected three undergraduate route tables, found ${undergraduateTables.length}`);

const undergraduate: any[] = [];
let division = "";
let school = "";
for (const cells of tableRows(undergraduateTables[0]).slice(1)) {
  if (!cells.length) continue;
  if (cells.length === 3) {
    division = cells[0].lines.join(" / ");
    school = cells[1].lines.join(" / ");
  } else if (cells.length === 2) {
    if (/width\s*=\s*["']?280/i.test(cells[0].attrs)) division = cells[0].lines.join(" / ");
    else school = cells[0].lines.join(" / ");
  }
  const majors = cells.at(-1)!.lines;
  for (const major of majors) undergraduate.push({ degree: "Undergraduate", nameEn: major, fieldCategory: school || division, admissionGroup: division, teachingLanguage: "Chinese and English", sourceTable: "Divisions (Chinese and English Programs)" });
}

let college = "";
for (const cells of tableRows(undergraduateTables[1]).slice(1)) {
  if (!cells.length) continue;
  if (cells.length === 3) college = cells[0].lines.join(" / ");
  else if (cells.length > 1 && /width\s*=\s*["']?174/i.test(cells[0].attrs)) college = cells[0].lines.join(" / ");
  for (const major of cells.at(-1)!.lines) undergraduate.push({ degree: "Undergraduate", nameEn: major, fieldCategory: college, admissionGroup: college, teachingLanguage: "Chinese and English", sourceTable: "Colleges (Chinese and English Programs)" });
}

college = "";
let program = "";
for (const cells of tableRows(undergraduateTables[2]).slice(1)) {
  if (!cells.length) continue;
  for (const cell of cells) {
    if (/width\s*=\s*["']?176/i.test(cell.attrs)) college = cell.lines.join(" / ");
    if (/width\s*=\s*["']?279/i.test(cell.attrs)) program = cell.lines.join(" / ");
  }
  const majors = cells.at(-1)!.lines;
  for (const major of majors) undergraduate.push({ degree: "Undergraduate", nameEn: major, fieldCategory: college, admissionGroup: program || college, teachingLanguage: "English", sourceTable: "Colleges (English Programs)" });
}

const graduateHtml = snapshots.get("tsinghua-graduate-programs-english")!.html;
const graduateTables = [...graduateHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
if (!graduateTables.length) throw new Error("Missing graduate English program table");
const graduateEnglish: any[] = [];
school = "";
for (const cells of tableRows(graduateTables[0]).slice(1)) {
  if (cells.length < 2) continue;
  const degreeText = cells[0].lines.join(" ");
  if (/^Degree$/i.test(degreeText) || !/Doctor|Master/i.test(degreeText)) continue;
  if (cells.length >= 3) school = cells.at(-1)!.lines.join(" / ");
  const degree = /Doctor/i.test(degreeText) ? "Doctoral" : "Master";
  for (const nameEn of cells[1].lines.filter((line) => !/^\s*$/.test(line))) {
    graduateEnglish.push({ degree, nameEn, fieldCategory: school, admissionGroup: school, teachingLanguage: "English", sourceTable: "Graduate Programs in English" });
  }
}

const key = (route: any) => [route.degree, route.nameEn, route.admissionGroup, route.teachingLanguage].join("|").toLowerCase();
const unique = (routes: any[]) => [...new Map(routes.map((route) => [key(route), route])).values()];
const parsed = {
  version: 1,
  generatedAt: new Date().toISOString(),
  sourceLocks: Object.entries(expected).map(([id, sha256]) => ({ id, sha256, fetchedAt: snapshots.get(id)!.source.fetchedAt, url: snapshots.get(id)!.source.url })),
  counts: {
    undergraduate: unique(undergraduate).length,
    graduateEnglish: unique(graduateEnglish).length,
    doctoralEnglish: unique(graduateEnglish).filter((route: any) => route.degree === "Doctoral").length,
    masterEnglish: unique(graduateEnglish).filter((route: any) => route.degree === "Master").length,
    total: unique(undergraduate).length + unique(graduateEnglish).length,
  },
  undergraduate: unique(undergraduate),
  graduateEnglish: unique(graduateEnglish),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, counts: parsed.counts }, null, 2));
