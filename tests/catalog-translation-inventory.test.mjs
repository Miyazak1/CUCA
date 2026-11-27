import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadCatalogTranslationInventory, loadCatalogTranslationOverrides, mergeCatalogInventories, scholarshipDetailInventory} from '../scripts/lib/catalog-translation-inventory.mjs';

test('detail inventory includes nested published paragraphs, items and benefit notes without collecting identifiers or source URLs', () => {
  const record = {id:'record-1',bodySections:[{title:'Coverage limitation',body:'Tuition only',paragraphs:['No award guaranteed'],items:[{label:'Housing',note:'Student pays',sourceUrl:'https://official.example/reference'}]}],benefits:['Insurance'],tags:['2026','Scholarship'],actionLinks:[{label:'Original reference',url:'https://official.example/apply'}]};
  const before=JSON.stringify(record),rows=scholarshipDetailInventory([record]);
  assert.equal(JSON.stringify(record),before);
  const keys=rows.map(row=>row.text);
  for(const key of ['Coverage limitation','Tuition only','No award guaranteed','Housing','Student pays','Insurance','Scholarship'])assert.ok(keys.includes(key),key);
  for(const key of ['record-1','2026','Original reference','https://official.example/reference','https://official.example/apply'])assert.ok(!keys.includes(key),key);
  assert.ok(rows.every(row=>row.sampleIds[0]==='record-1'));
});

test('merged inventory deduplicates normalized texts while retaining list/detail provenance and distinct missing detail paragraphs', () => {
  const first=[{text:' Shared   text ',count:2,fields:['programs.applicationNote'],sampleIds:['a']}],second=[{text:'Shared text',count:1,fields:['scholarships.detail.bodySections'],sampleIds:['b']},{text:'Detail text',count:1,fields:['scholarships.detail.bodySections'],sampleIds:['b']}];
  const before=JSON.stringify([first,second]),rows=mergeCatalogInventories(first,second);
  assert.equal(rows.length,2);assert.equal(rows[0].count,3);assert.deepEqual(rows[0].fields,['programs.applicationNote','scholarships.detail.bodySections']);assert.deepEqual(rows[0].sampleIds,['a','b']);
  assert.equal(JSON.stringify([first,second]),before);
});

test('inventory loading supports legacy fixtures but rejects corrupted detail inventories', async () => {
  const dir=await fs.mkdtemp(join(tmpdir(),'cuac-inventory-load-')),base=join(dir,'list.json'),detail=join(dir,'detail.json');
  const scope=join(dir,'scope.json');
  await fs.writeFile(base,JSON.stringify([{text:'List text',fields:['programs.nameEn']}])) ;
  assert.equal((await loadCatalogTranslationInventory(base,detail,scope)).length,1);
  await fs.writeFile(detail,'{corrupt');await assert.rejects(loadCatalogTranslationInventory(base,detail,scope),SyntaxError);
  await fs.writeFile(detail,'{}');await assert.rejects(loadCatalogTranslationInventory(base,detail,scope),/must be arrays/);
});

test('required detail scope fails closed when its supplemental snapshot is absent or empty',async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'cuac-inventory-required-')),base=join(dir,'base.json'),detail=join(dir,'detail.json'),scope=join(dir,'scope.json');
  await fs.writeFile(base,JSON.stringify([{text:'Legacy source',fields:['programs.nameEn']}]));
  await fs.writeFile(scope,JSON.stringify({requireScholarshipDetailInventory:true}));
  await assert.rejects(loadCatalogTranslationInventory(base,detail,scope),/detail inventory is missing/);
  await fs.writeFile(detail,'[]');await assert.rejects(loadCatalogTranslationInventory(base,detail,scope),/detail inventory is empty/);
  await fs.writeFile(detail,JSON.stringify([{text:'Required detail',fields:['scholarships.detail.bodySections']}]));
  assert.equal((await loadCatalogTranslationInventory(base,detail,scope)).length,2);
});

test('publication gate rejects a complete list-only dictionary when published detail paragraphs remain untranslated', async () => {
  const dir=await fs.mkdtemp(join(tmpdir(),'cuac-inventory-publish-'));
  for(const folder of ['.tmp/catalog-translations','src/content','public','output/feedback-20261112'])await fs.mkdir(join(dir,folder),{recursive:true});
  await fs.writeFile(join(dir,'.tmp/catalog-body-inventory.json'),JSON.stringify([{text:'List source text',fields:['programs.nameEn']}]));
  await fs.writeFile(join(dir,'.tmp/catalog-body-detail-inventory.json'),JSON.stringify([{text:'Omitted published detail paragraph',fields:['scholarships.detail.bodySections']}]));
  await fs.writeFile(join(dir,'.tmp/catalog-translations/vi.json'),JSON.stringify({'List source text':'Nội dung danh sách'}));
  await fs.writeFile(join(dir,'src/content/catalog-translation-overrides.json'),'[]');
  await fs.writeFile(join(dir,'public/catalog-content-vi.json'),'preserve-existing-asset');
  await assert.rejects(promisify(execFile)(process.execPath,[resolve('scripts/catalog-translations-validate.mjs'),'--locale=vi','--publish-local'],{cwd:dir,windowsHide:true}),error=>error.code===1);
  const coverage=JSON.parse(await fs.readFile(join(dir,'output/feedback-20261112/catalog-content-vi-coverage.json'),'utf8'));
  assert.equal(coverage.sourceCount,2);assert.equal(coverage.passed,false);assert.deepEqual(coverage.missingSources,['Omitted published detail paragraph']);
  assert.equal(await fs.readFile(join(dir,'public/catalog-content-vi.json'),'utf8'),'preserve-existing-asset');
});

test('pending corrections participate in offline candidates without mutating the active override registry', async () => {
  const dir=await fs.mkdtemp(join(tmpdir(),'cuac-inventory-staged-')),active=join(dir,'active.json'),pending=join(dir,'pending.json');
  const row=['Covered','Old VI','TH','ID','MS','AR'],updated=['Covered','Reviewed VI','TH','ID','MS','AR'];
  const before=JSON.stringify([row]);await fs.writeFile(active,before);
  assert.deepEqual(await loadCatalogTranslationOverrides(active,pending),[row]);
  await fs.writeFile(pending,JSON.stringify([updated]));assert.deepEqual(await loadCatalogTranslationOverrides(active,pending),[updated]);
  assert.equal(await fs.readFile(active,'utf8'),before);
  await fs.writeFile(pending,'{corrupt');await assert.rejects(loadCatalogTranslationOverrides(active,pending),SyntaxError);
});
