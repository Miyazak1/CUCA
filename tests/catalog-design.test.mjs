import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const script=await readFile(new URL('../public/catalog-design.js',import.meta.url),'utf8');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function runtime(locale='en',bodyTranslations){
 const window={CUACI18n:{locale},CuacCatalogList:{escapeHtml,saveHeartIcon:()=>'<svg></svg>'},CUACCatalogI18n:{ui:s=>s,localizeHref:s=>{const url=new URL(s,'http://localhost');url.searchParams.set('lang',locale);return url.pathname+url.search+url.hash;}}};
 window.CUACCatalogContent=bodyTranslations;
 runInNewContext(script,{window,document:{querySelector:()=>null,addEventListener:()=>{}},location:{href:'http://localhost/universities.html',origin:'http://localhost'},URL,Date,Intl,Map,Set,matchMedia:()=>({matches:false,addEventListener(){}})});
 return window.CUACCatalogDesign;
}
const now=Date.parse('2026-11-20T04:00:00Z'),D=runtime();

test('opening mobile filters applies body translations to the drawer outside main',()=>{
 const roots=[],drawer={setAttribute(){}};
 const api=runtime('vi',{apply:root=>roots.push(root)});
 api.updateDrawer(drawer,true,false);assert.deepEqual(roots,[drawer]);
 api.updateDrawer(drawer,false,true);assert.equal(roots.length,1);
});
test('deadline colors use Beijing day boundaries and strict date-only validation',()=>{
 for(const [days,band] of [[-1,'expired'],[0,'today'],[1,'week'],[7,'week'],[8,'month'],[30,'month'],[31,'quarter'],[90,'quarter'],[91,'distant']]){
  const date=new Date(now+days*86400000).toISOString().slice(0,10);assert.equal(D.dateInfo(date,now).band,band);
 }
 assert.equal(D.dateInfo('2026-02-30',now),null);assert.equal(D.dateInfo('bad',now),null);assert.equal(D.dateInfo(null,now),null);
 assert.equal(D.dateInfo('2026-11-20',Date.parse('2026-11-20T15:59:59Z')).band,'today');
 assert.equal(D.dateInfo('2026-11-20',Date.parse('2026-11-20T16:00:00Z')).band,'expired');
});
test('school deadlines use only published future program routes, never aggregate prose',()=>{
 assert.equal(D.deadlines('school',{deadlineSummary:'2027-01-01'},now).date,null);
 const state=D.deadlines('school',{upcomingDeadlines:[{deadlineDate:'2026-11-19'},{deadlineDate:'2026-11-27'},{deadlineDate:'2026-12-01'}]},now);
 assert.equal(state.date.days,7);assert.equal(state.rows.length,3);
});
test('closed status cannot be reopened by a future date and unpublished status stays explicit',()=>{
 assert.equal(D.deadlines('program',{intakeAvailability:'expired',deadlineDate:'2027-01-01'},now).band,'expired');
 assert.equal(D.deadlines('scholarship',{applicationAvailability:'closed',deadlineDate:'2027-01-01'},now).band,'expired');
 assert.equal(D.deadlines('program',{intakeAvailability:'not_published'},now).availability,'not_published');
});
test('safe links reject script and external detail routes, keep locale and public source',()=>{
 assert.equal(D.safeUrl('javascript:alert(1)',true),'');assert.equal(D.safeUrl('https://evil.test/details'),'');
 assert.match(D.safeUrl('program-detail.html?program=id'),/program=id&lang=en/);assert.equal(D.safeUrl('https://school.edu.cn/notice',true),'https://school.edu.cn/notice');
});
test('all six locales render native labels, safe text, true zero and missing values separately',()=>{
 const labels=['View details','Xem chi tiết','ดูรายละเอียด','Lihat detail','Lihat butiran','عرض التفاصيل'];
 for(const [i,locale] of ['en','vi','th','id','ms','ar'].entries()){
 const runtimeD=runtime(locale),html=runtimeD.render({kind:'school',id:'x',title:'<script>bad</script>',href:'university-detail.html?university=x',logoName:'Unknown university',record:{sourceUrl:'javascript:alert(1)'},facts:[['programs',0],['english',null]],tags:[],saveClass:'save',saveLabel:'Save',saved:false});
 assert.ok(html.includes(labels[i]));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('<dd>0</dd>'));assert.ok(html.includes(runtimeD.t('unpublished')));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('<img'));assert.ok(html.includes('aria-pressed="false"'));
 }
});
test('known schools show their real logo and government providers never borrow a school seal',()=>{
 const model={kind:'school',id:'pku',title:'Peking University',logoName:'Peking University',logo:{url:'/api/v1/catalog/schools/11111111-1111-4111-8111-111111111111/logo?v=1'},href:'university-detail.html?university=pku',record:{},facts:[],saveClass:'save',saveLabel:'Save'};
 assert.match(D.render(model),/catalog\/schools\/11111111-1111-4111-8111-111111111111\/logo\?v=1/);
 assert.doesNotMatch(D.render({...model,logo:null,kind:'scholarship',logoName:'Government / Peking University'}),/<img/);
});

test('schedule links preserve record identity and locale and target the actual schedule section',()=>{
 for(const locale of ['en','vi','th','id','ms','ar'])for(const kind of ['school','program','scholarship']){
  const file=kind==='school'?'university':kind;
  const html=runtime(locale).render({kind,id:'record-id',title:'Record',href:`${file}-detail.html?${kind==='school'?'university':kind}=record-id`,record:{},facts:[],saveClass:'save',saveLabel:'Save'});
  const url=new URL(html.match(/class="cd-deadline[\s\S]*?<a href="([^"]+)"/)[1].replaceAll('&amp;','&'),'http://localhost');
  assert.equal(url.searchParams.get('lang'),locale);assert.equal(url.hash,'#admissions-schedule');
  assert.equal(url.searchParams.get(kind==='school'?'university':kind),'record-id');
  assert.equal(url.searchParams.getAll('lang').length,1);
 }
});

test('program list adapter keeps zero tuition and its currency distinct from unpublished tuition',async()=>{
 const source=await readFile(new URL('../public/programs.js',import.meta.url),'utf8');
 const adapter=source.slice(source.indexOf('      function renderRow('),source.indexOf('      function renderPagination('));
 let model;
 const renderRow=runInNewContext(adapter+'\nrenderRow',{
  window:{CUACCatalogDesign:{t:key=>key,render:value=>{model=value;return '';}},CUACCatalogI18n:{locale:'en',localizeHref:s=>s},CUACI18n:{format:()=>''}},
  state:{saved:new Set(),compared:new Set()},escapeCatalogHtml:escapeHtml,catalogT:()=>'',catalogUi:s=>s,
  programId:p=>p.id,programName:()=> 'Program',programUniversity:()=> 'University',programReadiness:()=> 'Ready to compare',
  labelDegree:s=>s,programDegreeValue:()=> 'master',programFit:()=>'',programLanguageLabel:()=> 'English',renderRequirementCards:()=>'',
 });
 renderRow({id:'free',tuitionAmount:0,tuitionCurrency:'CNY',tuitionPeriod:'year'});
 assert.equal(model.facts.find(([key])=>key==='tuition')[1],'CNY 0 / year');
 renderRow({id:'unknown',tuitionAmount:null});assert.equal(model.facts.find(([key])=>key==='tuition')[1],null);
});

test('catalog source titles prefer body translations over ambiguous UI labels',()=>{
 const body={text:s=>s==='Materials'?'Vật liệu':s};
 const api=runtime('vi',body);
 const model={kind:'program',id:'materials',title:'Materials',href:'program-detail.html?program=materials',record:{},facts:[],saveClass:'save',saveLabel:'Save'};
 assert.match(api.render(model),/Vật liệu/);
});
