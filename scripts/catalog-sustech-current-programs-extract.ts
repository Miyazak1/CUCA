import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type ManifestSource = { id: string; sha256: string; artifactPath: string; url: string; finalUrl?: string; fetchedAt: string; label: string };
type ApiRow = { id: string; xid?: string; xyid?: string; xmc?: string; xywmc?: string; zymc?: string; zyywmc?: string };

const root = process.cwd();
const runName = "2026-10-27T05-50-12-511Z";
const runRoot = resolve(root, "work/catalog-official", runName);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { generatedAt: string; sources: ManifestSource[] };
const sources = manifest.sources.filter((source) => source.id.startsWith("sustech-undergraduate-"));
const collegeSource = sources.find((source) => source.id === "sustech-undergraduate-colleges-api");
if (!collegeSource) throw new Error("SUSTech college API snapshot is missing.");

const readModule = async (source: ManifestSource): Promise<ApiRow[]> => {
  const value = JSON.parse(await readFile(resolve(runRoot, source.artifactPath), "utf8")) as { isSuccess?: boolean; module?: ApiRow[] };
  if (!value.isSuccess || !Array.isArray(value.module)) throw new Error(`Unexpected SUSTech API response: ${source.id}`);
  return value.module;
};

const collegeNames = new Map<string, string>([
  ["c52c64bb06aa4b64b9bf3966497d63fd", "College of Science"],
  ["9a694e7dc8084a6ebeddede7597e4e5f", "College of Engineering"],
  ["13a60c886d8d4f1e961e6a61d69f9039", "School of Medicine"],
  ["eb28c6ad4e434388ab127434cbabec30", "Business School"],
  ["c0c23f551cc8414dbb99d643e5c6b0b1", "School of Design"],
  ["c59b898ae2024ea1bf70bcad6dba3ed0", "Center for the Humanities and Social Sciences"],
]);
const departmentById = new Map<string, { nameEn: string; collegeEn: string }>();
for (const source of sources.filter((source) => source.id.startsWith("sustech-undergraduate-departments-"))) {
  for (const row of await readModule(source)) {
    if (!row.id || !row.xyid || !row.xywmc) throw new Error(`Incomplete department row in ${source.id}`);
    departmentById.set(row.id, { nameEn: row.xywmc.trim(), collegeEn: collegeNames.get(row.xyid) ?? row.xyid });
  }
}

const programs = [];
for (const source of sources.filter((source) => source.id.startsWith("sustech-undergraduate-majors-"))) {
  const departmentId = new URL(source.finalUrl ?? source.url).searchParams.get("xid");
  if (!departmentId) throw new Error(`SUSTech major API lacks xid: ${source.id}`);
  const department = departmentById.get(departmentId);
  if (!department) throw new Error(`SUSTech department mapping is missing for ${source.id}`);
  for (const row of await readModule(source)) {
    if (!row.id || !row.zyywmc || !row.zymc) throw new Error(`Incomplete program row in ${source.id}`);
    programs.push({
      sourceId: source.id,
      sourceRecordId: row.id,
      sourceUrl: source.finalUrl ?? source.url,
      sourceLabel: source.label,
      sourceSha256: source.sha256,
      capturedAt: source.fetchedAt,
      departmentEn: department.nameEn,
      collegeEn: department.collegeEn,
      nameEn: row.zyywmc.trim(),
      nameZh: row.zymc.trim(),
    });
  }
}

if (programs.length !== 35) throw new Error(`Expected 35 current SUSTech API program rows, found ${programs.length}.`);
if (new Set(programs.map((row) => row.sourceRecordId)).size !== programs.length) throw new Error("Duplicate SUSTech program record IDs detected.");

const output = {
  version: 1,
  schoolSlug: "southern-university-of-science-and-technology",
  capturedAt: manifest.generatedAt,
  sourceRun: runName,
  programs,
  reviewNotes: [
    "The current official program APIs expose 35 distinct records, while the rendered program-page introduction says 34 undergraduate majors.",
    "Industrial Design appears twice under two departments with separate official record IDs. Both source rows are retained for review rather than silently merged.",
    "The current API responses do not label an admission year or deadline, so no 2027 intake is inferred.",
  ],
};
await writeFile(resolve(root, "catalog-sources/sustech-current-programs.extracted.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, programRows: programs.length, departments: departmentById.size }, null, 2));
