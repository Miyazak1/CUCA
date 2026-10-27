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
type ProgramRow = {
  degreeLevel: DegreeLevel;
  teachingLanguage: "Chinese";
  schoolEn: string;
  nameEn: string;
  durationYears: number;
  sourceId: string;
  sourcePublishedAt: "2019-03-26";
};

const root = process.cwd();
const run = "2026-10-27T07-04-40-437Z";
const locks = [
  ["henu-chinese-medium-bachelor-programs-current", "ab87f28334215963fa9900c8588c14e1ff0f24565fef1e97e04dbdd68866fe0b", "Bachelor"],
  ["henu-chinese-medium-master-programs-current", "ac6ff8d6b366795260c79be4cfc9cac7920763b1afd60bb1b292537ceb34a746", "Master"],
  ["henu-chinese-medium-doctoral-programs-current", "de56d949054fb57a747413ce8680e94fca12fb81ab8adc891ecff01119fdd37a", "Doctoral"],
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
const duration = (value: string) => {
  const normalized = value.toLowerCase();
  if (/five/.test(normalized)) return 5;
  if (/four/.test(normalized)) return 4;
  if (/three/.test(normalized)) return 3;
  if (/two/.test(normalized)) return 2;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const manifestDir = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(manifestDir, "manifest.json"), "utf8")) as { sources: Source[] };
const programs: ProgramRow[] = [];

for (const [id, expectedSha, degreeLevel] of locks) {
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === expectedSha);
  if (!source) throw new Error(`Missing locked source ${id}.`);
  const artifact = await readFile(resolve(manifestDir, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== expectedSha) throw new Error(`Hash mismatch for ${id}.`);
  const html = artifact.toString("utf8");
  if (!/Time:2019年03月26日/.test(html)) throw new Error(`Unexpected publication date for ${id}.`);
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => text(match[1]));
    const expectedCells = degreeLevel === "Master" ? 5 : 4;
    if (cells.length !== expectedCells || !/^\d+$/.test(cells[0])) continue;
    const schoolEn = cells[1];
    const nameEn = cells[2];
    const durationYears = duration(cells.at(-1) ?? "");
    if (!schoolEn || !nameEn || !durationYears || durationYears < 1 || durationYears > 8) {
      throw new Error(`Could not parse ${id} row: ${cells.join(" | ")}`);
    }
    programs.push({
      degreeLevel,
      teachingLanguage: "Chinese",
      schoolEn,
      nameEn,
      durationYears,
      sourceId: id,
      sourcePublishedAt: "2019-03-26",
    });
  }
}

const counts = {
  total: programs.length,
  bachelor: programs.filter((row) => row.degreeLevel === "Bachelor").length,
  master: programs.filter((row) => row.degreeLevel === "Master").length,
  doctoral: programs.filter((row) => row.degreeLevel === "Doctoral").length,
};
const expectedCounts = { total: 339, bachelor: 97, master: 195, doctoral: 47 };
if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) throw new Error(`Unexpected HENU extraction counts: ${JSON.stringify(counts)}.`);

const output = {
  version: 1,
  generatedAt: manifest.sources[0]?.fetchedAt,
  schoolSlug: "henan-university",
  scope: "Official degree-program pages still linked from the current HENU index; published March 26, 2019 and not relabeled as 2027",
  sourceRun: run,
  counts,
  sources: locks.map(([id, sha256]) => ({ id, sha256 })),
  programs,
};
const outputPath = resolve(root, "catalog-sources/henu-current-degree-programs.extracted.json");
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, counts }, null, 2));
