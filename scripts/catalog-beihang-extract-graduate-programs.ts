import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const runDir = resolve(root, "work/catalog-official/beihang-graduate-batch-01");
const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8"));
const outputPath = resolve(runDir, "parsed-graduate-routes.json");

const languageSymbols = new Map([
  ["●", "Chinese"],
  ["▲", "English"],
  ["◆", "French"],
  ["☐", "German"],
  ["△", "Russian"],
]);

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function linesFromCell(html: string) {
  return decodeHtml(html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter(line => !/^https?:\/\//i.test(line));
}

function hasHan(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function cleanSymbols(value: string) {
  return value.replace(/[●▲◆☐△]/g, "").replace(/\s+/g, " ").trim();
}

function languageList(value: string) {
  return [...languageSymbols].filter(([symbol]) => value.includes(symbol)).map(([, language]) => language);
}

function bilingualPairs(lines: string[]) {
  const pairs: Array<{ nameEn: string; nameZh?: string; symbols: string }> = [];
  let pendingEnglish: string | undefined;
  let pendingChinese: string | undefined;
  let symbols = "";
  const flush = () => {
    if (!pendingEnglish && !pendingChinese) return;
    const nameEn = cleanSymbols(pendingEnglish ?? pendingChinese ?? "");
    const nameZh = pendingChinese ? cleanSymbols(pendingChinese) : undefined;
    if (nameEn && !/^(school|major|platform|学院|专业|平台)$/i.test(nameEn)) pairs.push({ nameEn, nameZh, symbols });
    pendingEnglish = undefined;
    pendingChinese = undefined;
    symbols = "";
  };
  for (const rawLine of lines) {
    if (/^(school|major|platform|学院|专业|平台)$/i.test(cleanSymbols(rawLine))) continue;
    const currentSymbols = [...languageSymbols.keys()].filter(symbol => rawLine.includes(symbol)).join("");
    if (hasHan(rawLine)) {
      if (pendingChinese) flush();
      pendingChinese = rawLine;
      symbols += currentSymbols;
      if (pendingEnglish) flush();
    } else {
      if (pendingEnglish && !pendingChinese) flush();
      pendingEnglish = rawLine;
      symbols += currentSymbols;
      if (pendingChinese) flush();
    }
  }
  flush();
  return pairs;
}

function schoolPair(lines: string[]) {
  const usable = lines.filter(line => !/^(school|platform|学院|平台)$/i.test(cleanSymbols(line)));
  const nameEn = usable.find(line => !hasHan(line));
  const nameZh = usable.find(line => hasHan(line));
  return nameEn ? { nameEn: cleanSymbols(nameEn), nameZh: nameZh ? cleanSymbols(nameZh) : undefined } : null;
}

function extractRows(html: string, degreeLevel: "Master" | "Doctoral", source: any) {
  const rows: any[] = [];
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  let currentSchool: { nameEn: string; nameZh?: string } | null = null;
  for (const table of tables) {
    const rawTableText = linesFromCell(table).join(" ");
    const tableText = cleanSymbols(rawTableText);
    if (!/\bMajor\b/i.test(tableText) && !/[●▲◆☐△]/.test(rawTableText)) continue;
    const isPlatformTable = /\bPlatform\b/i.test(tableText);
    const htmlRows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
    for (const [rowIndex, htmlRow] of htmlRows.entries()) {
      const cells = [...htmlRow.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => ({ html: match[1], lines: linesFromCell(match[1]) }));
      if (!cells.length) continue;
      const joined = cells.flatMap(cell => cell.lines).join(" ");
      if (/\b(?:School|Platform)\b.*\bMajor\b/i.test(joined) || /^Major\s+专业/i.test(joined)) continue;
      if (cells.length === 1 && !/[●▲◆☐△]/.test(joined)
        && /(?:School|Institute|Centre|Center|Laboratory|University|学院|研究院|中心)/i.test(joined)) {
        const sectionSchool = schoolPair(cells[0].lines);
        if (sectionSchool) currentSchool = sectionSchool;
        continue;
      }
      if (cells.length >= 2 && !isPlatformTable) {
        const candidateSchool = schoolPair(cells[0].lines);
        if (candidateSchool) currentSchool = candidateSchool;
      }
      const programCell = cells.length >= 2 ? cells[cells.length - 1] : cells[0];
      if (!currentSchool) continue;
      for (const pair of bilingualPairs(programCell.lines)) {
        const languages = languageList(pair.symbols || programCell.lines.join(" "));
        if (!languages.length) continue;
        for (const teachingLanguage of languages) {
          rows.push({
            degreeLevel,
            schoolEn: currentSchool.nameEn,
            schoolZh: currentSchool.nameZh,
            nameEn: pair.nameEn,
            nameZh: pair.nameZh,
            teachingLanguage,
            ...(degreeLevel === "Doctoral" ? { durationYears: 4 } : {}),
            tuitionAmount: degreeLevel === "Master" ? 35000 : 42000,
            tuitionCurrency: "CNY",
            tuitionPeriod: "year",
            deadlineDate: "2026-06-30T00:00:00.000Z",
            applicationUrl: "https://admission.buaa.edu.cn/",
            applicationNote: degreeLevel === "Master" ? "Published study duration: 2-3 years" : "Published study duration: 4 years",
            sourceId: source.id,
            sourceUrl: source.url,
            sourceLabel: source.label,
            sourceSha256: source.sha256,
            capturedAt: source.fetchedAt,
            locator: `official HTML program table; table ${tables.indexOf(table) + 1}, row ${rowIndex + 1}`,
          });
        }
      }
    }
  }
  return rows;
}

const allRows: any[] = [];
for (const source of manifest.sources) {
  const html = await readFile(resolve(runDir, source.artifactPath), "utf8");
  const degreeLevel = source.id.includes("master") ? "Master" : "Doctoral";
  const extracted = extractRows(html, degreeLevel, source);
  console.error(JSON.stringify({ sourceId: source.id, degreeLevel, extractedRoutes: extracted.length }));
  allRows.push(...extracted);
}

const key = (row: any) => [row.degreeLevel, row.schoolEn, row.nameEn, row.teachingLanguage].map(value => value.toLowerCase()).join("|");
const unique = [...new Map(allRows.map(row => [key(row), row])).values()];
const suspicious = unique.filter(row => !row.nameEn || !row.schoolEn || !row.nameZh || !row.schoolZh);
const summary = {
  totalRoutes: unique.length,
  byDegree: Object.fromEntries(["Master", "Doctoral"].map(degree => [degree, unique.filter(row => row.degreeLevel === degree).length])),
  byLanguage: Object.fromEntries([...new Set(unique.map(row => row.teachingLanguage))].sort().map(language => [language, unique.filter(row => row.teachingLanguage === language).length])),
  uniqueMajors: new Set(unique.map(row => [row.degreeLevel, row.schoolEn, row.nameEn].join("|"))).size,
  suspiciousRows: suspicious.length,
};
const output = { version: 1, generatedAt: manifest.generatedAt, summary, routes: unique, suspicious };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ok: suspicious.length === 0, outputPath, summary, suspicious: suspicious.slice(0, 20) }, null, 2));
