import { createHash } from "node:crypto";
import { badRequest } from "../shared/errors.ts";
import { inputInteger, inputRecord } from "../shared/input.ts";
import type { InsightPost } from "../../content/insights.ts";

export const INSIGHT_CATEGORIES = ["admissions-updates", "program-watch", "scholarship-watch"] as const;
export const INSIGHT_WITHDRAWAL_REASONS = ["content_correction", "source_expired", "editorial_change", "article_superseded"] as const;

function text(value: unknown, field: string, max: number, multiline = false, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max) throw badRequest(`${field} must be bounded plain text.`);
  const normalized = value.replaceAll("\r\n", "\n").trim();
  if ((!allowEmpty && !normalized) || /[<>]/u.test(normalized) || Array.from(normalized).some(char => {
    const code = char.codePointAt(0)!;
    return (code < 32 && !(multiline && code === 10)) || (code >= 127 && code <= 159)
      || (code >= 0xd800 && code <= 0xdfff) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  })) throw badRequest(`${field} must contain valid plain text.`);
  return normalized;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length !== 24 || !Number.isFinite(new Date(value).valueOf()) || new Date(value).toISOString() !== value) {
    throw badRequest(`${field} must be a canonical UTC timestamp.`);
  }
  return value;
}

export function parseInsightDocument(value: unknown): Omit<InsightPost, "status" | "version" | "publishedAt" | "updatedAt"> {
  const fields = inputRecord(value, ["schemaVersion", "slug", "title", "description", "category", "tags", "author", "readingMinutes", "featured", "sections", "sources", "relatedGuides"]);
  inputInteger(fields.schemaVersion, "Insight schemaVersion", 1, 1);
  const slug = text(fields.slug, "Insight slug", 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw badRequest("Insight slug must use lowercase URL-safe segments.");
  if (!INSIGHT_CATEGORIES.includes(fields.category as typeof INSIGHT_CATEGORIES[number])) throw badRequest("Insight category is not registered.");
  if (!Array.isArray(fields.tags) || fields.tags.length < 1 || fields.tags.length > 12) throw badRequest("Insight tags must be a bounded list.");
  const tags = fields.tags.map(item => text(item, "Insight tag", 80)).filter((item, index, all) => all.indexOf(item) === index);
  if (typeof fields.featured !== "boolean") throw badRequest("Insight featured must be boolean.");
  if (!Array.isArray(fields.sections) || fields.sections.length < 1 || fields.sections.length > 30) throw badRequest("Insight sections are required.");
  const sections = fields.sections.map(item => {
    const row = inputRecord(item, ["id", "heading", "paragraphs", "bullets", "tables", "contentOrder"]);
    const id = text(row.id, "Insight section id", 100);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw badRequest("Insight section ids must be URL-safe.");
    if (!Array.isArray(row.paragraphs) || row.paragraphs.length > 200) throw badRequest("Insight section paragraphs must contain no more than 200 items.");
    if (row.bullets !== undefined && (!Array.isArray(row.bullets) || row.bullets.length > 200)) throw badRequest("Insight bullets must contain no more than 200 items.");
    if (row.tables !== undefined && (!Array.isArray(row.tables) || row.tables.length > 12)) throw badRequest("Insight tables must be a bounded list.");
    const paragraphs = row.paragraphs.map(paragraph => text(paragraph, "Insight paragraph", 6000, true));
    const bullets = row.bullets === undefined ? undefined : row.bullets.map(bullet => text(bullet, "Insight bullet", 1200, true));
    const tables = row.tables === undefined ? undefined : row.tables.map((table, tableIndex) => {
      const tableRow = inputRecord(table, ["headers", "rows"]);
      if (!Array.isArray(tableRow.headers) || tableRow.headers.length < 1 || tableRow.headers.length > 20) throw badRequest("Insight table headers must contain 1 to 20 columns.");
      if (!Array.isArray(tableRow.rows) || tableRow.rows.length < 1 || tableRow.rows.length > 200) throw badRequest("Insight table rows must contain 1 to 200 rows.");
      const headers = tableRow.headers.map((cell, columnIndex) => text(cell, `Insight table ${tableIndex + 1} header ${columnIndex + 1}`, 500, false, true));
      if (!headers.some(Boolean)) throw badRequest("Insight table must have at least one named column.");
      const rows = tableRow.rows.map((cells, rowIndex) => {
        if (!Array.isArray(cells) || cells.length !== headers.length) throw badRequest("Insight table rows must match the header width.");
        return cells.map((cell, columnIndex) => text(cell, `Insight table ${tableIndex + 1} row ${rowIndex + 1} cell ${columnIndex + 1}`, 1200, false, true));
      });
      return { headers, rows };
    });
    if (!paragraphs.length && !bullets?.length && !tables?.length) throw badRequest("Insight section content is required.");
    let contentOrder: string[] | undefined;
    if (row.contentOrder !== undefined) {
      if (!Array.isArray(row.contentOrder)) throw badRequest("Insight section content order must be a list.");
      const parsedContentOrder = row.contentOrder.map((token, index) => text(token, `Insight section content order ${index + 1}`, 24));
      const expected = [
        ...paragraphs.map((_, index) => `p:${index}`),
        ...(bullets?.length ? ["b"] : []),
        ...(tables || []).map((_, index) => `t:${index}`),
      ];
      if (parsedContentOrder.length !== expected.length || new Set(parsedContentOrder).size !== parsedContentOrder.length
        || expected.some(token => !parsedContentOrder.includes(token))) throw badRequest("Insight section content order must reference each content block exactly once.");
      contentOrder = parsedContentOrder;
    }
    return { id, heading: text(row.heading, "Insight section heading", 180), paragraphs,
      ...(bullets === undefined ? {} : { bullets }), ...(tables === undefined ? {} : { tables }),
      ...(contentOrder === undefined ? {} : { contentOrder }) };
  });
  if (new Set(sections.map(section => section.id)).size !== sections.length) throw badRequest("Insight section ids must be unique.");
  if (!Array.isArray(fields.sources) || fields.sources.length > 30) throw badRequest("Insight official sources must be a bounded list.");
  const sources = fields.sources.map(item => {
    const row = inputRecord(item, ["url", "label", "checkedAt"]), url = text(row.url, "Insight source URL", 2048);
    let parsed: URL; try { parsed = new URL(url); } catch { throw badRequest("Insight source URL is invalid."); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw badRequest("Insight sources must use HTTPS without credentials.");
    return { url: parsed.toString(), label: text(row.label, "Insight source label", 200), checkedAt: timestamp(row.checkedAt, "Insight source check time") };
  });
  if (!Array.isArray(fields.relatedGuides) || fields.relatedGuides.length > 12) throw badRequest("Related guides must be a bounded list.");
  const relatedGuides = fields.relatedGuides.map(item => {
    const row = inputRecord(item, ["href", "label"]), href = text(row.href, "Related guide href", 240);
    if (!/^\/guides\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href)) throw badRequest("Related guides must use an approved UCAC guide path.");
    return { href, label: text(row.label, "Related guide label", 200) };
  });
  const document = { slug, title: text(fields.title, "Insight title", 240), description: text(fields.description, "Insight description", 800, true),
    category: fields.category as typeof INSIGHT_CATEGORIES[number], tags, author: text(fields.author, "Insight author", 120),
    readingMinutes: inputInteger(fields.readingMinutes, "Insight reading minutes", 1, 120), featured: fields.featured,
    sections, sources, relatedGuides };
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > 196_608) throw badRequest("Insight document is too large.");
  return document;
}

export function insightDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function insightSha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw badRequest("A lowercase SHA-256 is required.");
  return value;
}
