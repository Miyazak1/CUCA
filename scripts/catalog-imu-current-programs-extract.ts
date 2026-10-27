import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Source = {
  id: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

type DegreeLevel = "Bachelor" | "Master" | "Doctoral";

const root = process.cwd();
const sourceRun = "2026-10-27T07-20-19-252Z";
const sourceId = "imu-international-admission-brochure-current";
const expectedSha256 = "e66ae1ccf49ac9213aaa98705d2b93b0fb7db8afe5a714eea6bbee4240e1ec60";
const runDir = resolve(root, "work/catalog-official", sourceRun);
const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((item) => item.id === sourceId && item.status === 200 && item.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Inner Mongolia University admission brochure source.");
const html = await readFile(resolve(runDir, source.artifactPath), "utf8");
if (createHash("sha256").update(html).digest("hex") !== expectedSha256) throw new Error("Inner Mongolia University brochure hash mismatch.");

const decode = (value: string) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, " ")
  .trim();

const tableRows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
  [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decode(cell[1])),
);
const headerIndex = tableRows.findIndex((cells) => cells.length === 4 && cells[0] === "Names of Schools/Colleges" && cells[1] === "Bachelor Degree");
if (headerIndex < 0) throw new Error("Inner Mongolia University program table header not found.");
const schoolRows = tableRows.slice(headerIndex + 1).filter((cells) => cells.length === 4 && cells[0] && cells[0] !== "Categories").slice(0, 22);
if (schoolRows.length !== 22 || schoolRows.at(-1)?.[0] !== "Research Center of Chinese Nation") throw new Error("Unexpected Inner Mongolia University program table shape.");

const programs: Array<{ degreeLevel: DegreeLevel; teachingLanguage: "Chinese"; schoolEn: string; nameEn: string; durationYears: number; sourceId: string }> = [];
for (const cells of schoolRows) {
  const schoolEn = cells[0];
  for (const [column, degreeLevel, durationYears] of [[1, "Bachelor", 4], [2, "Master", 3], [3, "Doctoral", 3]] as const) {
    const names = cells[column].split(";").map((name) => name.trim()).filter(Boolean);
    for (let nameEn of names) {
      if (nameEn.startsWith("including ")) nameEn = nameEn.slice("including ".length);
      if (nameEn.endsWith(")") && !nameEn.includes("(")) nameEn = nameEn.slice(0, -1);
      programs.push({ degreeLevel, teachingLanguage: "Chinese", schoolEn, nameEn, durationYears, sourceId });
    }
  }
}
const counts = {
  total: programs.length,
  bachelor: programs.filter((row) => row.degreeLevel === "Bachelor").length,
  master: programs.filter((row) => row.degreeLevel === "Master").length,
  doctoral: programs.filter((row) => row.degreeLevel === "Doctoral").length,
};
if (counts.total < 150 || counts.bachelor < 50 || counts.master < 70 || counts.doctoral < 20) throw new Error(`Unexpected Inner Mongolia University program counts: ${JSON.stringify(counts)}`);

const output = {
  version: 1,
  schoolSlug: "inner-mongolia-university",
  sourceRun,
  source: { id: sourceId, sha256: expectedSha256 },
  counts,
  programs,
};
await writeFile(resolve(root, "catalog-sources/imu-current-programs.extracted.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, ...counts }, null, 2));
