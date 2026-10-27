import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Source = {
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

type DegreeLevel = "Bachelor" | "Master" | "Doctoral";
type TeachingLanguage = "Chinese" | "English";

type ProgramRow = {
  degreeLevel: DegreeLevel;
  teachingLanguage: TeachingLanguage;
  schoolZh: string;
  schoolEn: string;
  programCode?: string;
  nameZh: string;
  nameEn: string;
  durationYears: number;
  tuitionCnyPerYear: number;
  sourceId: string;
};

const root = process.cwd();
const run = "2026-10-27T06-47-56-353Z";
const locks = [
  ["cumt-bachelor-programs-chinese-current", "90de4b24c59f95be239cce060ba00b1c69f908050d827b7dfb813d1ceaffa415", "Bachelor", "Chinese"],
  ["cumt-bachelor-programs-english-current", "f37f487637d333f229a019f35e20f8766a5d70200951326ae862f96d0c20ee55", "Bachelor", "English"],
  ["cumt-master-programs-chinese-current", "c404b75e684c7f9e4eea859617ff3556875663e257d12001204b70fb11002ba8", "Master", "Chinese"],
  ["cumt-master-programs-english-current", "90e88e2d9162a6fc94b7446aae8f83fda869ef67951d2d10dfbbf209ec5cd75c", "Master", "English"],
  ["cumt-doctoral-programs-chinese-current", "a80e544990752f9314b91a1ff238a17df15a1c1900f3aaefe4fa75743ba77258", "Doctoral", "Chinese"],
  ["cumt-doctoral-programs-english-current", "b6f06815ebcfa7e00adb719dd1c3b7cfc063b7c784f13c53a1b6a39a4a6f32a7", "Doctoral", "English"],
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

const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const paragraphs = (html: string) => {
  const values = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => text(match[1])).filter(Boolean);
  return values.length ? values : [text(html)].filter(Boolean);
};

const splitBilingual = (cell: string, kind: "school" | "program") => {
  const values = paragraphs(cell);
  const enIndex = values.findIndex((value) => /[A-Za-z]{3}/.test(value) && !/^[A-Z]?\d{4,}/.test(value));
  const nameEn = enIndex >= 0 ? values.slice(enIndex).join(" ") : values.at(-1) ?? "";
  const leading = values.slice(0, enIndex >= 0 ? enIndex : Math.max(values.length - 1, 0)).join(" ");
  const code = kind === "program" ? leading.match(/\b([A-Z]?\d{4,}[A-Z0-9]*)\b/i)?.[1] : undefined;
  const nameZh = leading.replace(/\b[A-Z]?\d{4,}[A-Z0-9]*\b/gi, " ").replace(/\s+/g, " ").trim();
  return { nameZh, nameEn, code };
};

const manifestDir = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(manifestDir, "manifest.json"), "utf8")) as { sources: Source[] };
const rows: ProgramRow[] = [];

for (const [id, expectedSha, degreeLevel, teachingLanguage] of locks) {
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === expectedSha);
  if (!source) throw new Error(`Missing locked source ${id}.`);
  const artifact = await readFile(resolve(manifestDir, source.artifactPath));
  const actualSha = createHash("sha256").update(artifact).digest("hex");
  if (actualSha !== expectedSha) throw new Error(`Hash mismatch for ${id}.`);
  const html = artifact.toString("utf8");
  let lastSchool = { nameZh: "", nameEn: "", code: undefined as string | undefined };
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length < 3 || cells.some((cell) => /Program Name|Tuition|Duration/.test(text(cell)))) continue;
    let programCell: string;
    let durationCell: string;
    let tuitionCell: string;
    if (cells.length >= 4) {
      lastSchool = splitBilingual(cells[0], "school");
      [programCell, durationCell, tuitionCell] = cells.slice(1, 4);
    } else {
      [programCell, durationCell, tuitionCell] = cells;
    }
    const program = splitBilingual(programCell, "program");
    const durationYears = Number.parseInt(text(durationCell), 10);
    const tuitionCnyPerYear = Number.parseInt(text(tuitionCell).replace(/\D/g, ""), 10);
    if (!lastSchool.nameEn || !program.nameEn || !Number.isFinite(durationYears) || !Number.isFinite(tuitionCnyPerYear)) {
      throw new Error(`Could not parse ${id} row: ${text(rowMatch[1])}`);
    }
    rows.push({
      degreeLevel,
      teachingLanguage,
      schoolZh: lastSchool.nameZh,
      schoolEn: lastSchool.nameEn,
      programCode: program.code,
      nameZh: program.nameZh,
      nameEn: program.nameEn,
      durationYears,
      tuitionCnyPerYear,
      sourceId: id,
    });
  }
}

const counts = Object.fromEntries(locks.map(([, , degreeLevel, teachingLanguage]) => {
  const key = `${degreeLevel}-${teachingLanguage}`;
  return [key, rows.filter((row) => row.degreeLevel === degreeLevel && row.teachingLanguage === teachingLanguage).length];
}));
const expectedCounts: Record<string, number> = {
  "Bachelor-Chinese": 42,
  "Bachelor-English": 3,
  "Master-Chinese": 43,
  "Master-English": 13,
  "Doctoral-Chinese": 32,
  "Doctoral-English": 13,
};
for (const [key, expected] of Object.entries(expectedCounts)) {
  if (counts[key] !== expected) throw new Error(`Expected ${expected} ${key} rows, found ${counts[key]}.`);
}

const output = {
  version: 1,
  generatedAt: manifest.sources[0]?.fetchedAt,
  scope: "CUMT current official degree-program pages; page publication dates are preserved and rows are not relabeled as 2027",
  sourceRun: run,
  counts: { total: rows.length, ...counts },
  sources: locks.map(([id, sha256]) => ({ id, sha256 })),
  programs: rows,
};
const outputPath = resolve(root, "catalog-sources/cumt-current-degree-programs.extracted.json");
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, counts: output.counts }, null, 2));
