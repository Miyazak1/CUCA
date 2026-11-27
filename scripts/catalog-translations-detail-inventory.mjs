import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { scholarshipDetailInventory } from './lib/catalog-translation-inventory.mjs';

const argument = (key, fallback) => process.argv.find(value => value.startsWith(`${key}=`))?.slice(key.length + 1) || fallback;
const origin = new URL(argument('--origin', 'http://127.0.0.1:53118'));
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'Only the existing local public catalog may be read');
const output = argument('--out-dir');
assert.ok(output, 'Explicit --out-dir required for resumable evidence and detail cache');
const cache = path.join(output, 'detail-cache'); await fs.mkdir(cache, { recursive: true });
async function request(route) {
  const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Public catalog HTTP ${response.status} for ${route}`);
  return response.json();
}
const first = await request('/api/v1/catalog/scholarships?limit=100');
const list = [...first.data];
for (let offset = 100; offset < first.pagination.total; offset += 100) list.push(...(await request(`/api/v1/catalog/scholarships?limit=100&offset=${offset}`)).data);
assert.equal(new Set(list.map(item => item.id)).size, first.pagination.total, 'List snapshot incomplete or duplicated');
const pending = [...list], records = [], failures = [];
let reused = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (pending.length) {
    const item = pending.shift(), file = path.join(cache, `${item.id}.json`);
    try {
      let record;
      try { record = JSON.parse(await fs.readFile(file, 'utf8')); assert.equal(record.id, item.id); reused++; }
      catch (error) { if (error.code !== 'ENOENT') throw error; record = (await request(`/api/v1/catalog/scholarships/${item.id}`)).data; assert.equal(record.id, item.id); await fs.writeFile(file, JSON.stringify(record)); }
      records.push(record);
    } catch (error) { failures.push({ id: item.id, error: error.message }); }
  }
}));
const rows = scholarshipDetailInventory(records);
const summary = { date: new Date().toISOString(), origin: origin.origin, expected: list.length, fetched: records.length, reused, detailSourceKeys: rows.length, failures, complete: failures.length === 0, deployed: false };
await fs.writeFile(path.join(output, 'detail-inventory-audit.json'), JSON.stringify(summary, null, 2));
assert.equal(failures.length, 0, 'Partial snapshot retained in cache; source inventory not published');
const target = '.tmp/catalog-body-detail-inventory.json';
try { await fs.copyFile(target, path.join(output, 'detail-inventory-before.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.writeFile(target + '.next', JSON.stringify(rows, null, 2)); await fs.rename(target + '.next', target);
await fs.writeFile(path.join(output, 'detail-inventory.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(summary));
