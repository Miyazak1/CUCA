import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Snapshot = {
  id: string;
  label: string;
  schoolSlug?: string;
  url: string;
  fetchedAt: string;
  status: number;
  sha256: string;
};

const root = process.cwd();
const registryPath = resolve(root, "catalog-sources/official-sources.json");
const statusPath = resolve(root, "catalog-sources/2027-school-refresh-status.json");
const registryText = await readFile(registryPath, "utf8");
const statusText = await readFile(statusPath, "utf8");
const registry = JSON.parse(registryText) as { sources: Array<{ id: string; url: string; sourceRole: string; schoolSlug?: string }> };
const status = JSON.parse(statusText) as { schools: Array<{ schoolSlug: string; result: string; notes: string; observedOfficialUrls: string[] }> };

const expected = new Map([
  ["fuzhou-international-doctoral-program-preparation-2027", "7149ee692633367c175884ef5462818b7b8ea63d2a61c95c2ceb72acaaed7418"],
  ["fudan-uipe-2027-release-status", "56beda54f1eb8cce9ab7cc128ea7bee69a8ff088f5abaa7983ab4ae547f7b933"],
]);

for (const id of expected.keys()) {
  const source = registry.sources.find((row) => row.id === id);
  if (!source || source.sourceRole !== "freshness-index") throw new Error(`Missing freshness source ${id}.`);
}

const snapshots = new Map<string, Snapshot>();
const acquisitionRoot = resolve(root, "work/catalog-official");
for (const entry of await readdir(acquisitionRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(acquisitionRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Snapshot[] };
    for (const row of manifest.sources ?? []) {
      if (expected.has(row.id) && row.status === 200) snapshots.set(row.id, row);
    }
  } catch {
    // Partial acquisition directories do not establish reviewable evidence.
  }
}

for (const [id, sha256] of expected) {
  const snapshot = snapshots.get(id);
  if (!snapshot || snapshot.sha256 !== sha256) throw new Error(`Locked snapshot mismatch for ${id}.`);
}

const fuzhou = status.schools.find((row) => row.schoolSlug === "fuzhou-university");
const fudan = status.schools.find((row) => row.schoolSlug === "fudan-university");
if (!fuzhou || fuzhou.result !== "2027_international_doctoral_guide_announced_not_yet_published") throw new Error("Fuzhou refresh status is not aligned.");
if (!fudan || !fudan.observedOfficialUrls.includes("https://econ.fudan.edu.cn/uipe/Prospective_Students1/Entry_Requirements.htm")) throw new Error("Fudan UIPE freshness evidence is not recorded.");

const evidence = [...snapshots.values()].sort((a, b) => a.id.localeCompare(b.id));
const audit = {
  version: 1,
  wave: 56,
  generatedAt: evidence.map((row) => row.fetchedAt).sort().at(-1),
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    schoolSlugs: ["fudan-university", "fuzhou-university"],
    freshnessSnapshots: evidence.length,
    newPrograms: 0,
    newProgramIntakes: 0,
    newScholarships: 0,
  },
  evidence: evidence.map(({ id, label, schoolSlug, url, fetchedAt, sha256 }) => ({ id, label, schoolSlug, url, fetchedAt, sha256 })),
  findings: [
    "Fuzhou University's official preparation notice confirms that a 2027 international doctoral guide is planned and states HSK 5 or above for Chinese-taught doctoral applications.",
    "Fudan University's official UIPE page says the 2027 degree guide will be released in October but still links only the 2026 guide at the captured time.",
  ],
  unresolved: [
    "Fuzhou University has not yet published the final 2027 applicant guide, program list, application window or tuition schedule.",
    "Fudan UIPE has not yet published the promised 2027 guide, so its 2027 dates, requirements, tuition and CSCA fields remain absent.",
  ],
  safeguards: [
    "Freshness notices are not converted into applicant-facing catalog routes.",
    "No 2026 field is rolled forward to 2027 and no missing value is inferred.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
  registrySha256: createHash("sha256").update(registryText).digest("hex"),
  refreshStatusSha256: createHash("sha256").update(statusText).digest("hex"),
};

const outputPath = resolve(root, "seeds/catalog.2027-wave-56.audit.json");
await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, counts: audit.scope, publicationAuthorized: false }, null, 2));
