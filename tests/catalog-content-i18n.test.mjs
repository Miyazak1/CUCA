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

test('composed school summaries translate short CSCA subjects without altering source records',async()=>{
 const api=await runtime('vi');
 const record={cscaSubjects:['中文(文科)','数学','中文(理科)','物理','化学']};
 const original=JSON.stringify(record);api.track(record);
 assert.equal(api.phrase('CSCA: '+record.cscaSubjects.join(' / ')),
  'CSCA: Tiếng Trung (khối ngành xã hội) / Toán học / Tiếng Trung (khối ngành khoa học) / Vật lý / Hóa học');
 assert.equal(JSON.stringify(record),original);
});
test('unavailable and incomplete locales retain usable source text with distinct states',async()=>{
 for(const mode of ['pending','failed']){
  const api=await runtime('th',mode);
  assert.equal(api.state,mode==='failed'?'unavailable':'pending');
  assert.equal(api.text('English'),'English');
 }
 assert.equal((await runtime('en')).state,'original');
});

// Exercise the loader and its real retry-button callback without a network or
// wall-clock sleeps. The DOM stub contains only the translation notice.
function loaderFixture(fetcher,locale='vi'){
 const timers=new Map();let sequence=0;
 const element=()=>({dataset:{},children:[],listeners:{},attributes:new Set(),classList:{add(){}},
  append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parentElement=this;},
  prepend(...nodes){this.children.unshift(...nodes);for(const n of nodes)n.parentElement=this;},
  replaceChildren(){this.children=[];},get firstChild(){return this.children[0];},
  querySelector(selector){return this.children.find(n=>selector.includes('retry')?n.dataset?.catalogTranslationRetry:selector.includes('notice')?n.dataset?.catalogTranslationNotice:selector.includes('.catalog-language-note')?n.legacy:false)||null;},
  querySelectorAll(){return[];},removeAttribute(name){this.attributes.delete(name);},addEventListener(name,handler){this.listeners[name]=handler;},
 });
 const root=element(),body={dataset:{}},window={CUACI18n:{locale}};
 const legacy=element();legacy.legacy=true;legacy.attributes.add('data-catalog-copy');root.append(legacy);
 const document={body,querySelector:()=>root,createElement:element,createTextNode:text=>({textContent:text}),
  createTreeWalker:()=>({nextNode:()=>false})};
 const schedule=(callback,ms)=>{const id=++sequence;timers.set(id,callback);if(ms<15000)queueMicrotask(()=>{if(timers.has(id)){timers.delete(id);callback();}});return id;};
 vm.runInNewContext(source,{window,document,NodeFilter:{SHOW_TEXT:4},location:{href:'http://localhost/programs.html?lang=vi'},MutationObserver:class{observe(){}},AbortController,setTimeout:schedule,clearTimeout:id=>timers.delete(id),queueMicrotask,URL,fetch:(...args)=>fetcher(...args,{expire:()=>{for(const callback of [...timers.values()])callback();}})});
 return {api:window.CUACCatalogContent,body,notice:()=>root.querySelector('[data-catalog-translation-notice]'),retry:()=>root.querySelector('[data-catalog-translation-notice]').querySelector('[data-catalog-translation-retry]')};
}
const manifestResponse={ok:true,json:async()=>({locales:{vi:{ready:true,sha256:'test'}}})};
const translatedResponse={ok:true,json:async()=>({'English':'Tiếng Anh','Medicine':'Y học'})};

test('a slow cold start aborts once then recovers with a fresh request signal',async()=>{
 let calls=0;const signals=[];
 const fixture=loaderFixture(async(url,{signal},{expire})=>{
  signals.push(signal);calls++;
  if(calls===1)return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('timeout')));queueMicrotask(expire);});
  assert.equal(signal.aborted,false);return url.includes('manifest')?manifestResponse:translatedResponse;
 });
 assert.equal(await fixture.api.ready,'ready');assert.equal(calls,3);
 assert.notEqual(signals[0],signals[1]);assert.equal(fixture.retry().hidden,true);
 assert.equal(fixture.body.dataset.catalogContentState,'ready');
});

test('both manifest and dictionary transient failures recover automatically',async()=>{
 for(const failingAsset of ['manifest','vi.json']){
  let failures=0;
  const fixture=loaderFixture(async url=>{
   if(url.includes(failingAsset)&&failures++===0)return{ok:false,status:503};
   return url.includes('manifest')?manifestResponse:translatedResponse;
  });
  assert.equal(await fixture.api.ready,'ready');assert.equal(fixture.api.text('Medicine'),'Y học');
 }
});

test('persistent failure is bounded and the retry button recovers tracked records in place',async()=>{
 let offline=true,calls=0;
 const fixture=loaderFixture(async url=>{calls++;if(offline)throw new Error('offline');return url.includes('manifest')?manifestResponse:translatedResponse;});
 const record={id:'Medicine',nameEn:'Medicine',sourceUrl:'https://school.example/English'};
 fixture.api.track(record);
 assert.equal(await fixture.api.ready,'unavailable');assert.equal(calls,3);
 assert.equal(fixture.retry().hidden,false);assert.match(fixture.notice().firstChild.textContent,/không khả dụng/);
 offline=false;
 const first=fixture.retry().listeners.click();const duplicate=fixture.retry().listeners.click();
 assert.equal(first,duplicate);assert.equal(fixture.retry().hidden,true);
 assert.match(fixture.notice().firstChild.textContent,/Đang tải/);
 assert.equal(await first,'ready');assert.equal(calls,5);
 assert.equal(fixture.api.phrase('Medicine · 2027'),'Y học · 2027');
 assert.equal(record.id,'Medicine');assert.equal(record.nameEn,'Medicine');assert.equal(record.sourceUrl,'https://school.example/English');
 assert.equal(fixture.retry().hidden,true);
});

test('permanent missing assets and unready locales avoid automatic retry loops',async()=>{
 for(const mode of ['missing','pending']){
  let calls=0;const fixture=loaderFixture(async()=>{calls++;return mode==='missing'?{ok:false,status:404}:{ok:true,json:async()=>({locales:{}})};});
  assert.equal(await fixture.api.ready,mode==='missing'?'unavailable':'pending');
  assert.equal(calls,1);assert.equal(fixture.retry().hidden,mode==='pending');
 }
});

test('invalid JSON dictionary shape never marks a language ready',async()=>{
 const fixture=loaderFixture(async url=>url.includes('manifest')?manifestResponse:{ok:true,json:async()=>['Medicine']});
 assert.equal(await fixture.api.ready,'unavailable');assert.equal(fixture.api.text('Medicine'),'Medicine');
});

test('body notice retains its original-language link when control labels render later',async()=>{
 const fixture=loaderFixture(async url=>url.includes('manifest')?manifestResponse:translatedResponse);
 await fixture.api.ready;
 const note=fixture.notice();
 assert.equal(note.attributes.has('data-catalog-copy'),false);
 // Reproduce the list label renderer: it replaces children only on its owners.
 if(note.attributes.has('data-catalog-copy'))note.replaceChildren();
 const link=note.children.find(child=>child.hreflang==='en');
 assert.equal(link.href,'/programs.html?lang=en');assert.equal(link.textContent,'Xem bản gốc tiếng Anh');
 assert.equal(fixture.retry().hidden,true);
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
