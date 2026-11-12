import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {catalogFacts,missingCatalogFacts,isCatalogDisplayText} from '../scripts/lib/catalog-translation-validation.mjs';

const source=await fs.readFile(new URL('../public/catalog-content-i18n.js',import.meta.url),'utf8');
async function runtime(locale,mode='ready'){
 const window={CUACI18n:{locale}};
 const document={body:{},querySelector:()=>null};
 const entries={'IELTS 5.5 or TOEFL 60 or above; native English speakers are exempt.':'IELTS 5.5 hoặc TOEFL 60 trở lên; người có tiếng Anh là tiếng mẹ đẻ được miễn.','English':'Tiếng Anh','Medicine':'Y học'};
 vm.runInNewContext(source,{window,document,location:{href:'http://localhost/programs.html'},MutationObserver:class{observe(){}},AbortController,setTimeout,clearTimeout,queueMicrotask,URL,fetch:async url=>{
  if(mode==='failed')throw new Error('offline');
  return{ok:true,json:async()=>url.includes('manifest')?{locales:mode==='pending'?{}:{[locale]:{ready:true,sha256:'test'}}}:entries};
 }});
 await window.CUACCatalogContent.ready;
 return window.CUACCatalogContent;
}
test('catalog translations preserve source objects, IDs, numbers and original references',async()=>{
 const api=await runtime('vi');
 const rule='IELTS 5.5 or TOEFL 60 or above; native English speakers are exempt.';
 const record={id:'Medicine',sourceUrl:'https://example.org/English',englishRequirement:rule,teachingLanguage:'English'};
 const original=JSON.stringify(record);api.track(record);
 assert.equal(JSON.stringify(record),original);
 assert.equal(api.text(rule),'IELTS 5.5 hoặc TOEFL 60 trở lên; người có tiếng Anh là tiếng mẹ đẻ được miễn.');
 assert.equal(api.phrase('English · 2027'),'Tiếng Anh · 2027');
 assert.equal(api.phrase('Englishman · 2027'),'Englishman · 2027');
 assert.equal(api.text('Unseen source text'),'Unseen source text');
 assert.equal(api.text('Public'),'Công lập');
 assert.equal(api.text('Full'),'Toàn phần');
 assert.equal(api.text('数学'),'Toán học');
 assert.equal(api.text('中文(文科)'),'Tiếng Trung (khối ngành xã hội)');
 api.track({applicationNote:'需要学习计划'});
 assert.ok(api.missing.includes('需要学习计划'),'Chinese-only fields must be tracked, not silently skipped');
});
test('Chinese/mixed fields and currencies are part of translation acceptance',()=>{
 assert.equal(isCatalogDisplayText('数学'),true);
 assert.equal(isCatalogDisplayText('¥15,000/年。'),true);
 assert.equal(isCatalogDisplayText('HSK4 220 分以上'),true);
 assert.deepEqual(catalogFacts('汉语言文学专业：HSK4 220 分以上。'),['HSK','4','220']);
 assert.deepEqual(missingCatalogFacts('¥15,000/年。','₫15,000/năm.'),['¥']);
 assert.deepEqual(missingCatalogFacts('¥15,000/年。','¥15,000/năm.'),[]);
 assert.deepEqual(missingCatalogFacts('HSK4 220 分以上','HSK4 từ 200 điểm'),['220']);
});
test('unavailable and incomplete locales retain usable source text with distinct states',async()=>{
 for(const mode of ['pending','failed']){
  const api=await runtime('th',mode);
  assert.equal(api.state,mode==='failed'?'unavailable':'pending');
  assert.equal(api.text('English'),'English');
 }
 assert.equal((await runtime('en')).state,'original');
});
test('every ready language asset matches its manifest hash and reviewed fact overrides',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../public/catalog-content-manifest.json',import.meta.url),'utf8'));
 const overrides=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 for(const[locale,entry]of Object.entries(manifest.locales)){
  if(!entry.ready)continue;
  const body=await fs.readFile(new URL(`../public/catalog-content-${locale}.json`,import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(body).digest('hex'),entry.sha256);
  const dictionary=JSON.parse(body);
  assert.ok(Object.keys(dictionary).length>=entry.sourceCount);
  for(const row of overrides)assert.equal(dictionary[row[0]],row[['en','vi','th','id','ms','ar'].indexOf(locale)]);
  assert.doesNotMatch(body,/91357\d{4}|98271\d{4}|ZXQ\d{4}QXZ/);
 }
});
