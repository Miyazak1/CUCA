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

const root = process.cwd();
const locks = [
  {
    run: "2026-10-27T08-01-26-551Z",
    id: "ncu-international-undergraduate-programs-current",
    sha256: "4229a9741682a137b49ce797fb25c217916b933ebd0cee8d95e180d0e6a49405",
    degreeLevel: "Bachelor",
  },
  {
    run: "2026-10-27T08-02-42-532Z",
    id: "ncu-international-master-programs-current",
    sha256: "17460babbf508bcbdc7a6470960af1f59810d36bdc34a6f71a97c3b10cef4252",
    degreeLevel: "Master",
  },
  {
    run: "2026-10-27T08-02-42-532Z",
    id: "ncu-international-phd-programs-current",
    sha256: "05fd2c47e43d2ba95f21082260c6c798c426c88661f20bdb9780493d45e494fe",
    degreeLevel: "Doctoral",
  },
] as const;

const decode = (value: string) => value
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&quot;/gi, "\"")
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();

const splitPrograms = (value: string) => {
  const rows: string[] = [];
  let current = "";
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")" && depth > 0) depth -= 1;
    if ((character === "," || character === "，") && depth === 0) {
      const item = current.trim();
      if (item) rows.push(item);
      current = "";
    } else {
      current += character;
    }
  }
  const item = current.trim();
  if (item) rows.push(item);
  return rows;
};

const extracted: Array<{
  degreeLevel: "Bachelor" | "Master" | "Doctoral";
  schoolName: string;
  nameEn: string;
  sourceId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSha256: string;
  capturedAt: string;
}> = [];
const evidence: Array<Pick<Source, "id" | "label" | "sha256" | "fetchedAt"> & { url: string }> = [];

for (const lock of locks) {
  const directory = resolve(root, "work/catalog-official", lock.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((row) => row.id === lock.id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked Nanchang University source ${lock.id}.`);
  const artifact = resolve(directory, source.artifactPath);
  const bytes = await readFile(artifact);
  if (createHash("sha256").update(bytes).digest("hex") !== lock.sha256) throw new Error(`Evidence hash mismatch: ${lock.id}.`);
  const html = bytes.toString("utf8");
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => decode(match[1]));
    if (cells.length < 3 || !/^\d+$/.test(cells[0])) continue;
    const schoolName = cells[1];
    for (const nameEn of splitPrograms(cells.slice(2).join(" "))) {
      extracted.push({
        degreeLevel: lock.degreeLevel,
        schoolName,
        nameEn,
        sourceId: source.id,
        sourceUrl: source.finalUrl ?? source.url,
        sourceLabel: source.label,
        sourceSha256: source.sha256,
        capturedAt: source.fetchedAt,
      });
    }
  }
  evidence.push({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, sha256: source.sha256, fetchedAt: source.fetchedAt });
}

const unique = [...new Map(extracted.map((row) => [`${row.degreeLevel}\u0000${row.schoolName}\u0000${row.nameEn}`, row])).values()];
const counts = Object.fromEntries(["Bachelor", "Master", "Doctoral"].map((degreeLevel) => [degreeLevel, unique.filter((row) => row.degreeLevel === degreeLevel).length]));
if (counts.Bachelor < 70 || counts.Master < 120 || counts.Doctoral < 20) throw new Error(`Unexpectedly shallow Nanchang extraction: ${JSON.stringify(counts)}.`);

const output = {
  version: 1,
  status: "source_bounded_extraction",
  generatedAt: evidence.map((row) => row.fetchedAt).sort().at(-1),
  schoolSlug: "nanchang-university",
  evidence,
  counts: { ...counts, total: unique.length },
  programs: unique,
  notes: [
    "Rows are split only at top-level ASCII or full-width commas; commas inside parentheses remain part of the official program label.",
    "Exact duplicates within the same degree level and school are removed; similarly named programs under different schools remain distinct.",
    "No intake year, teaching language, duration, tuition category or deadline is inferred from the program tables.",
  ],
};
await writeFile(resolve(root, "catalog-sources/ncu-current-programs.extracted.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath: "catalog-sources/ncu-current-programs.extracted.json", counts: output.counts }, null, 2));
