import fs from 'node:fs/promises';

export const normalizeCatalogText = value => String(value).normalize('NFC').replace(/\s+/g, ' ').trim();

export function mergeCatalogInventories(...inventories) {
  const merged = new Map();
  for (const inventory of inventories) for (const row of inventory) {
    const text = normalizeCatalogText(row.text);
    if (!text) continue;
    const prior = merged.get(text);
    if (!prior) merged.set(text, { ...row, text, fields: [...new Set(row.fields || [])], sampleIds: [...new Set(row.sampleIds || [])].slice(0, 4) });
    else {
      prior.fields = [...new Set([...prior.fields, ...(row.fields || [])])];
      prior.sampleIds = [...new Set([...prior.sampleIds, ...(row.sampleIds || [])])].slice(0, 4);
      prior.count = (prior.count || 0) + (row.count || 0);
    }
  }
  return [...merged.values()];
}

export async function loadCatalogTranslationInventory(base = '.tmp/catalog-body-inventory.json', detail = '.tmp/catalog-body-detail-inventory.json', scopeFile = 'config/catalog-translation-source-scope.json') {
  const primary = JSON.parse(await fs.readFile(base, 'utf8'));
  let scope = {};
  try { scope = JSON.parse(await fs.readFile(scopeFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let supplement = [];
  try { supplement = JSON.parse(await fs.readFile(detail, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (scope.requireScholarshipDetailInventory) throw new Error('Required scholarship detail inventory is missing; collect the public detail snapshot before translation or publication');
  }
  if (!Array.isArray(primary) || !Array.isArray(supplement)) throw new Error('Catalog inventories must be arrays');
  if (scope.requireScholarshipDetailInventory && !supplement.length) throw new Error('Required scholarship detail inventory is empty');
  return mergeCatalogInventories(primary, supplement);
}

export async function loadCatalogTranslationOverrides(active = 'src/content/catalog-translation-overrides.json', pending = 'src/content/catalog-translation-pending-overrides.json') {
  const rows = JSON.parse(await fs.readFile(active, 'utf8'));
  let staged = [];
  try { staged = JSON.parse(await fs.readFile(pending, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(rows) || !Array.isArray(staged)) throw new Error('Catalog overrides must be arrays');
  return [...new Map([...rows, ...staged].map(row => [normalizeCatalogText(row[0]), row])).values()];
}

export function scholarshipDetailInventory(records) {
  const entries = new Map();
  function collect(value, field, id) {
    if (Array.isArray(value)) { for (const item of value) collect(item, field, id); return; }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) if (!['key', 'id', 'url', 'sourceUrl', 'capturedAt', 'schemaVersion'].includes(key)) collect(item, field, id);
      return;
    }
    if (typeof value !== 'string' || !/\p{L}/u.test(value)) return;
    const text = normalizeCatalogText(value);
    if (!entries.has(text)) entries.set(text, { text, count: 0, fields: [], sampleIds: [] });
    const row = entries.get(text); row.count++;
    if (!row.fields.includes(field)) row.fields.push(field);
    if (!row.sampleIds.includes(id) && row.sampleIds.length < 4) row.sampleIds.push(id);
  }
  for (const record of records) for (const field of ['bodySections', 'benefits', 'tags']) collect(record[field], `scholarships.detail.${field}`, record.id);
  return [...entries.values()];
}
