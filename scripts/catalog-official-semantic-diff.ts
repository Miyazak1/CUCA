import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

type ReviewEntry = {
  id: string;
  schoolSlug: string | null;
  result: string;
  previousSha256?: string | null;
  sha256?: string | null;
};

const root = process.cwd();
const auditPath = path.join(root, "work", "catalog-quality", "catalog-official-refresh-audit.json");
const artifactRoot = path.join(root, "work", "catalog-official");
const requestedSchools = new Set(process.argv.slice(2));

const decodeEntities = (value: string) => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, "\"")
  .replace(/&#39;|&apos;/gi, "'");

const visibleSegments = (html: string) => {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h[1-6]|\/a)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(body)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3 && line.length <= 800);
};

const findArtifact = async (id: string, sha256: string) => {
  const directories = await readdir(artifactRoot, { withFileTypes: true });
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const rawDir = path.join(artifactRoot, directory.name, "raw");
    try {
      const names = await readdir(rawDir);
      const name = names.find((candidate) => candidate.startsWith(`${id}.${sha256}.`));
      if (name) return path.join(rawDir, name);
    } catch {
      // Some artifact folders do not contain raw captures.
    }
  }
  throw new Error(`Artifact not found for ${id}.${sha256}`);
};

const clip = (value: string) => value.length > 260 ? `${value.slice(0, 257)}...` : value;
const priority = /(?:2027|2026|deadline|application|apply|tuition|fee|ielts|toefl|hsk|csca|截止|申请|学费|费用|语言|奖学金)/i;

const audit = JSON.parse(await readFile(auditPath, "utf8")) as { reviewQueue: ReviewEntry[] };
const entries = audit.reviewQueue.filter((entry) =>
  entry.result === "changed"
  && entry.previousSha256
  && entry.sha256
  && (!requestedSchools.size || (entry.schoolSlug && requestedSchools.has(entry.schoolSlug)))
);

for (const entry of entries) {
  const oldPath = await findArtifact(entry.id, entry.previousSha256!);
  const newPath = await findArtifact(entry.id, entry.sha256!);
  const oldLines = visibleSegments(await readFile(oldPath, "utf8"));
  const newLines = visibleSegments(await readFile(newPath, "utf8"));
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const removed = [...oldSet].filter((line) => !newSet.has(line));
  const added = [...newSet].filter((line) => !oldSet.has(line));
  const order = (lines: string[]) => [
    ...lines.filter((line) => priority.test(line)),
    ...lines.filter((line) => !priority.test(line)),
  ].slice(0, 20).map(clip);
  console.log(JSON.stringify({
    schoolSlug: entry.schoolSlug,
    sourceId: entry.id,
    removedCount: removed.length,
    addedCount: added.length,
    removed: order(removed),
    added: order(added),
  }, null, 2));
}
