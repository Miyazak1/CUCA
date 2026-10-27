import { createHash } from "node:crypto";
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
  sha256: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-27T06-27-38-047Z");
const outputPath = resolve(root, "catalog-sources/njau-current-graduate-programs.extracted.json");
const sourceSpecs: SourceSpec[] = [
  {
    id: "njau-international-master-programs-en-current",
    degreeLevel: "Master",
    sha256: "dfd7d92e1f1d24fe5f542cd78754b2953a2e5de26f508c7e8d34c2d3b0dd5221",
  },
  {
    id: "njau-international-doctoral-programs-en-current",
    degreeLevel: "Doctoral",
    sha256: "a7d4af1555fe2cd316b86b9903ea68a37a6194c800a0c774e594e42d6940034a",
  },
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
  .replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ")
  .trim();

const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const sourceMap = new Map(manifest.sources.map((source) => [source.id, source]));
const programs: Array<{
  degreeLevel: "Master" | "Doctoral";
  college: string;
  disciplineCategory: string;
  programCode: string;
  nameEn: string;
  professional: boolean;
  sourceId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSha256: string;
  capturedAt: string;
}> = [];

for (const spec of sourceSpecs) {
  const source = sourceMap.get(spec.id);
  if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== spec.sha256) {
    throw new Error(`Missing locked NJAU source: ${spec.id}`);
  }
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== spec.sha256) throw new Error(`NJAU source hash mismatch: ${spec.id}`);
  const html = artifact.toString("utf8");
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error(`No NJAU program table found: ${spec.id}`);
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => textContent(cell[1])));
  let extracted = 0;
  for (const cells of rows) {
    if (cells.length !== 4) continue;
    const [college, disciplineCategory, programCode, rawName] = cells;
    if (!college || !disciplineCategory || !programCode || !rawName || /program\s+code/i.test(programCode)) continue;
    if (!/^[0-9A-Z]{4,8}$/i.test(programCode)) continue;
    const nameEn = rawName.replace(/\*+$/g, "").trim();
    if (!nameEn) throw new Error(`Empty NJAU program name after normalization: ${spec.id}/${programCode}`);
    programs.push({
      degreeLevel: spec.degreeLevel,
      college,
      disciplineCategory,
      programCode,
      nameEn,
      professional: /\*+$/.test(rawName),
      sourceId: source.id,
      sourceUrl: source.finalUrl ?? source.url,
      sourceLabel: source.label,
      sourceSha256: source.sha256,
      capturedAt: source.fetchedAt,
    });
    extracted += 1;
  }
  if (extracted === 0) throw new Error(`No NJAU programs extracted: ${spec.id}`);
}

const uniquePrograms = new Map<string, (typeof programs)[number]>();
for (const program of programs) {
  const identity = `${program.degreeLevel}|${program.college}|${program.programCode}|${program.nameEn}`.toLowerCase();
  const prior = uniquePrograms.get(identity);
  if (prior && (prior.disciplineCategory !== program.disciplineCategory || prior.professional !== program.professional)) {
    throw new Error(`Conflicting NJAU program row: ${identity}`);
  }
  uniquePrograms.set(identity, prior ?? program);
}
const deduplicatedPrograms = [...uniquePrograms.values()];

const output = {
  version: 1,
  schoolSlug: "nanjing-agricultural-university",
  extractedAt: new Date().toISOString(),
  sourceRun: runRoot.replace(`${root}\\`, "").replaceAll("\\", "/"),
  sourcePagePublishedAt: "2022-03-22",
  sources: sourceSpecs.map((spec) => {
    const source = sourceMap.get(spec.id)!;
    return { id: source.id, url: source.finalUrl ?? source.url, sha256: source.sha256, fetchedAt: source.fetchedAt };
  }),
  counts: {
    total: deduplicatedPrograms.length,
    master: deduplicatedPrograms.filter((program) => program.degreeLevel === "Master").length,
    doctoral: deduplicatedPrograms.filter((program) => program.degreeLevel === "Doctoral").length,
    professionalMaster: deduplicatedPrograms.filter((program) => program.degreeLevel === "Master" && program.professional).length,
  },
  programs: deduplicatedPrograms,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, counts: output.counts }, null, 2));
