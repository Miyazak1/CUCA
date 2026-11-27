import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {missingCatalogFacts} from '../scripts/lib/catalog-translation-validation.mjs';
import {loadCatalogTranslationOverrides} from '../scripts/lib/catalog-translation-inventory.mjs';

const source=await fs.readFile(new URL('../public/catalog-content-i18n.js',import.meta.url),'utf8');
const manifest=JSON.parse(await fs.readFile(new URL('../public/catalog-content-manifest.json',import.meta.url),'utf8'));
const samples={
 school:{nameEn:'Anhui University',schoolType:'Public',hskRequirement:'汉语言文学专业：HSK4 220 分以上可免文科中文。',tuitionSummary:'¥15,000/年。',cscaRequirement:'全部中文授课，必须选中文试卷。'},
 program:{nameEn:'International Economics and Trade',englishRequirement:'IELTS 5.5 or TOEFL 60 or above; native English speakers are exempt.',applicationNote:'Apply in the SUEP international student application system; the guide prints an HTTP address.'},
 scholarship:{title:'Anhui Agricultural University Scholarship',summary:'Full scholarship for the published 1+1 English-taught International Business master\'s route.'},
};

async function runtime(locale,dictionary,coverage=manifest){
 const window={CUACI18n:{locale}},document={body:{},querySelector:()=>null};
 vm.runInNewContext(source,{window,document,location:{href:'http://localhost/programs.html'},MutationObserver:class{observe(){}},AbortController,setTimeout,clearTimeout,queueMicrotask,URL,fetch:async url=>({ok:true,json:async()=>url.includes('manifest')?coverage:dictionary})});
 await window.CUACCatalogContent.ready;return window.CUACCatalogContent;
}

test('reviewed multilingual overrides retain source facts and contain no unresolved Chinese or authoring markers',async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 for(const [original,...translations]of rows)for(const translated of translations){
  assert.deepEqual(missingCatalogFacts(original,translated),[],original);
  assert.doesNotMatch(translated,/\p{Script=Han}|91357\d{4}|98271\d{4}|ZXQ\d{4}QXZ/u);
 }
});

for(const locale of ['th','id','ms','ar'])test(`${locale} reviewed requirement fixtures translate school, program and scholarship text (not full-dictionary acceptance)`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const index=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(rows.map(row=>[row[0],row[index]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const fields of Object.values(samples)){
  const record=Object.fromEntries(Object.entries(fields).filter(([,value])=>Object.hasOwn(dictionary,value)));
  assert.ok(Object.keys(record).length);const original=JSON.stringify(record);api.track(record);
  for(const value of Object.values(record)){
   assert.equal(api.text(value),dictionary[value]);
   assert.ok(api.phrase(`${value} · 2027`).includes(dictionary[value]));
  }
  assert.equal(JSON.stringify(record),original);
 }
});

for(const [locale,degree,english]of [
 ['th',/ปริญญาโท/,/ภาษาอังกฤษ/],
 ['id',/magister/i,/Inggris/i],
 ['ms',/sarjana(?!\s+muda)/i,/Inggeris/i],
 ['ar',/ماجستير/,/بالإنجليزية|باللغة الإنجليزية/],
])test(`${locale} reviewed UCAS fixtures preserve master degree, English instruction and complete subject codes (not full-dictionary acceptance)`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const pattern=/^Official English-instructed master's major, subject code ([0-9A-Za-z]+)\. Host faculty or CAS institute selection is completed in the UCAS application system\.$/;
 const selected=rows.filter(row=>pattern.test(row[0]));assert.ok(selected.length>0);
 const column=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(selected.map(row=>[row[0],row[column]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of selected){
  const record={id:'unchanged-record',applicationNote:row[0]},original=JSON.stringify(record);api.track(record);
  const translated=api.text(record.applicationNote);assert.equal(translated,row[column]);
  assert.match(translated,degree);assert.match(translated,english);
  assert.match(translated,new RegExp('(?<![A-Za-z0-9])'+pattern.exec(row[0])[1]+'(?![A-Za-z0-9])'));
  assert.match(translated,/\bCAS\b/);assert.match(translated,/\bUCAS\b/);
  if(locale==='th')assert.doesNotMatch(translated,/อาจารย์/);
  assert.equal(JSON.stringify(record),original);
 }
});

for(const [locale,noCategoryInference]of [
 ['th',/ไม่.*(?:อนุมาน|คาดเดา|สันนิษฐาน|สมมติ).*(?:หมวดหมู่|ประเภท)/],
 ['id',/tanpa menyimpulkan kategorinya/],
 ['ms',/tanpa mengandaikan kategorinya/],
 ['ar',/دون افتراض الفئة/],
])test(`${locale} reviewed tuition-evidence fixtures retain row ranges and forbid inferred fee categories (not full-dictionary acceptance)`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const pattern=/^(.+); program table rows ([\d-]+)\. The official tuition page publishes category rates rather than a row-level mapping, so this route shows the verified degree-level range without inferring a category\.$/;
 const selected=rows.filter(row=>pattern.test(row[0]));assert.ok(selected.length>0);
 const column=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(selected.map(row=>[row[0],row[column]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of selected){
  const record={id:'unchanged-record',applicationNote:row[0]},original=JSON.stringify(record);api.track(record);
  const translated=api.text(record.applicationNote);assert.equal(translated,row[column]);
  assert.ok(translated.includes(pattern.exec(row[0])[2]));assert.match(translated,noCategoryInference);
  assert.deepEqual(missingCatalogFacts(row[0],translated),[]);
  assert.deepEqual(missingCatalogFacts(translated,row[0]),[],'No invented amount, score or source row');
  assert.equal(JSON.stringify(record),original);
 }
});

for(const [locale,teachingLanguage,discipline]of [
 ['th',/ภาษาที่ใช้สอน/,/หมวดหมู่สาขาวิชา/],
 ['id',/bahasa pengantar/,/kategori bidang studi/],
 ['ms',/bahasa pengantar/,/kategori bidang pengajian/],
 ['ar',/لغة التدريس/,/فئة التخصص/],
])test(`${locale} reviewed campus-note fixtures preserve program codes, rows, years and tuition meaning (not full-dictionary acceptance)`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const pattern=/^(.+); Full-time; official program code ([0-9A-Za-z]+); official HTML table row (\d+)\. Tuition is published by medium and discipline category in the corresponding (\d{4}) admission guide\.$/;
 const selected=rows.filter(row=>pattern.test(row[0]));assert.equal(selected.length,442);
 const column=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(selected.map(row=>[row[0],row[column]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of selected){
  const record={id:'unchanged-record',applicationNote:row[0]},original=JSON.stringify(record);api.track(record);
  const translated=api.text(record.applicationNote),match=pattern.exec(row[0]);assert.equal(translated,row[column]);
  assert.match(translated,teachingLanguage);assert.match(translated,discipline);assert.match(translated,/HTML/);
  assert.match(translated,new RegExp('(?<![A-Za-z0-9])'+match[2]+'(?![A-Za-z0-9])'));
  for(const literal of [match[3],match[4]])assert.match(translated,new RegExp('(?<!\\d)'+literal+'(?!\\d)'));
  assert.deepEqual(missingCatalogFacts(row[0],translated),[]);assert.deepEqual(missingCatalogFacts(translated,row[0]),[]);
  if(locale==='th')assert.doesNotMatch(translated.slice(translated.lastIndexOf('ค่าเล่าเรียน')),/สื่อ|วินัย/);
  assert.equal(JSON.stringify(record),original);
 }
});

for(const [locale,under]of [['th',/ต่ำกว่า/],['id',/di bawah/],['ms',/di bawah/],['ar',/أقل من/]])test(`${locale} reviewed materials and official-unit notes retain strict ages, fees and document coordinates (candidate fixtures only)`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const column=['en','vi','th','id','ms','ar'].indexOf(locale);
 const unitPattern=/^(.+); (?:official spreadsheet row \d+|official English catalog page \d+|published duration \d+ years; page \d+, table \d+, row \d+\.)$/;
 const units=rows.filter(row=>unitPattern.test(row[0]));assert.ok(units.length>=447);
 const keys=["Bachelor's degree and under 35","Master's degree and under 40",'High-school diploma and under 25','Submit ECNU online application and pay RMB 800 application fee'];
 const selected=[...units,...keys.map(key=>{const row=rows.find(r=>r[0]===key);assert.ok(row,key);return row;})];
 const dictionary=Object.fromEntries(selected.map(row=>[row[0],row[column]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of selected){
  const record={id:'unchanged-record',applicationNote:row[0]},original=JSON.stringify(record);api.track(record);
  assert.equal(api.text(row[0]),row[column]);assert.equal(JSON.stringify(record),original);
  assert.deepEqual(missingCatalogFacts(row[0],row[column]),[]);assert.deepEqual(missingCatalogFacts(row[column],row[0]),[]);
  assert.doesNotMatch(row[column],/official spreadsheet row|published duration|official English catalog page|\p{Script=Han}/u);
  if(/ and under \d+$/.test(row[0]))assert.match(row[column],under);
 }
});

for(const [locale,noInference,noYears,noExhaustiveCoverage]of [
 ['th',/ไม่อนุมานชื่อภาษาจีน|ไม่มีชื่อภาษาจีนที่อนุมาน/,/ปี/,/ไม่.*(?:อ้าง|ครอบคลุม)/],
 ['id',/tanpa menyimpulkan nama dalam bahasa Mandarin/,/tahun/,/bukan.*(?:semua|menyeluruh|lengkap)/],
 ['ms',/tanpa mengandaikan nama bahasa Cina/,/tahun/,/bukan.*(?:menyeluruh|semua)/],
 ['ar',/دون استنتاج أسماء صينية/,/أعوام|سنوات|عامًا/,/ليس.*(?:جميع|شامل)/],
])test(`${locale} candidate provenance notes preserve repeated IDs, source limitations and unspecified duration units`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const column=['en','vi','th','id','ms','ar'].indexOf(locale);
 const workbookPattern=/^(.+); official catalog ID (\d+); worksheet row (\d+), catalog ID (\d+)\. The official workbook's Chinese-text cells are corrupt, so this record uses the parallel English columns without inferred Chinese names\.$/;
 const selected=rows.filter(row=>workbookPattern.test(row[0]));assert.equal(selected.length,593);
 const unqualified=rows.filter(row=>/^(.+)\. Published duration: (\d+)\.$/.test(row[0]));assert.ok(unqualified.length>=4);
 const coded=rows.filter(row=>/^Program code ([0-9A-Za-z]+); (.+); published duration (\d+) years\.$/.test(row[0]));assert.ok(coded.length>=155);
 const typeB=rows.filter(row=>/^Full-time; (.+); PDF page (\d+), panel (\d+), table (\d+), row (\d+)\. This is a verified Type B catalog route, not a claim of exhaustive self-funded-program coverage\.$/.test(row[0]));assert.equal(typeB.length,244);
 const dictionary=Object.fromEntries([...selected,...unqualified,...coded,...typeB].map(row=>[row[0],row[column]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of [...selected,...unqualified,...coded,...typeB]){
  const record={id:'unchanged-record',applicationNote:row[0],teachingLanguage:'Unspecified source language'},original=JSON.stringify(record);api.track(record);
  assert.equal(api.text(row[0]),row[column]);assert.equal(JSON.stringify(record),original);
  assert.deepEqual(missingCatalogFacts(row[0],row[column]),[]);assert.deepEqual(missingCatalogFacts(row[column],row[0]),[]);
  if(workbookPattern.test(row[0]))assert.match(row[column],noInference);
  if(unqualified.includes(row))assert.doesNotMatch(row[column],noYears,'Do not invent a year unit absent from the source');
  if(typeB.includes(row)){assert.match(row[column],/(?<![A-Za-z])B(?![A-Za-z])/);assert.match(row[column],noExhaustiveCoverage);}
  assert.doesNotMatch(row[column],/\p{Script=Han}/u);
 }
});

for(const [locale,optionalResearch,english]of [
 ['th',/ไม่จำเป็น|ไม่ต้อง/,/ภาษาอังกฤษ/],
 ['id',/tidak perlu/,/Inggris/i],
 ['ms',/tidak perlu/,/Inggeris/i],
 ['ar',/لا يلزم|لا حاجة/,/الإنجليزية/],
])test(`${locale} candidate program titles retain qualifiers and source notes keep optional research selection`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const column=['en','vi','th','id','ms','ar'].indexOf(locale);
 const research=rows.filter(r=>/^Official (\d{4}) major code ([0-9A-Za-z]+); Full-time\. Published research fields: no need to specify research fields when applying$/.test(r[0]));assert.equal(research.length,42);
 const sections=rows.filter(r=>/^(Minhang|Zhongbei) Campus; school section (\d+) \((.+)\), table row (\d+)\.$/.test(r[0]));assert.equal(sections.length,164);
 const titles=['Neurology (Academic/Professional)','Nursing (Academic) (International School of Medicine)','Nuclear Science and Technology (English)','Operations Research and Cybernetics (in Chinese/English)','Professional Accounting (MPAcc Program)'].map(s=>{const row=rows.find(r=>r[0]===s);assert.ok(row,s);return row;});
 const all=[...research,...sections,...titles],dictionary=Object.fromEntries(all.map(r=>[r[0],r[column]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of all){
  const record={id:'unchanged-record',applicationNote:row[0],nameEn:row[0],teachingLanguage:'Source teaching language',degree:'Source degree'},before=JSON.stringify(record);api.track(record);
  assert.equal(api.text(row[0]),row[column]);assert.equal(JSON.stringify(record),before);
  assert.deepEqual(missingCatalogFacts(row[0],row[column]),[]);assert.deepEqual(missingCatalogFacts(row[column],row[0]),[]);
  if(research.includes(row))assert.match(row[column],optionalResearch);
 }
 assert.match(titles[0][column],/\//,'Keep both academic and professional title categories');
 assert.match(titles[2][column],english);assert.match(titles[3][column],english);assert.match(titles[3][column],/\//,'Keep the original Chinese/English alternative');
 assert.match(titles[3][column],{th:/ภาษาจีน/,id:/Mandarin/,ms:/Cina/,ar:/الصينية/}[locale]);
 assert.match(titles[4][column],/MPAcc/);
});

for(const [locale,academic,month,whole,nonref,levels,discipline,instruction]of [
 ['th',/ปีการศึกษา/,/เดือน/,/ทั้งหมด|ตลอดหลักสูตร/,/ไม่.*คืน/,{master:/ปริญญาโท|มหาบัณฑิต/,doctoral:/ปริญญาเอก|ดุษฎีบัณฑิต/,undergraduate:/ปริญญาตรี/},/สาขาวิชา/,/ภาษาที่ใช้สอน/],
 ['id',/tahun akademik/,/bulan/,/seluruh program/,/tidak.*dikembalikan/,{master:/magister/i,doctoral:/doktor/i,undergraduate:/sarjana/i},/bidang studi/,/bahasa pengantar/],
 ['ms',/tahun akademik/,/bulan/,/keseluruhan program/,/tidak.*dikembalikan/,{master:/sarjana/i,doctoral:/kedoktoran/i,undergraduate:/sarjana muda/i},/bidang pengajian/,/bahasa pengantar/],
 ['ar',/عام دراسي|سنة دراسية/,/شهر/,/برنامج/,/غير قابل للاسترداد|لا.*استرداد/,{master:/الماجستير/,doctoral:/الدكتوراه/,undergraduate:/البكالوريوس/},/التخصص/,/لغة التدريس/],
])test(`${locale} candidate billing and degree notes retain periods, refund policy, study levels and official abbreviations`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const column=['en','vi','th','id','ms','ar'].indexOf(locale);
 const groups={
  academic:rows.filter(r=>/^(CNY|RMB) [0-9,.-]+ per academic year$/.test(r[0])),
  month:rows.filter(r=>/^(CNY|RMB) [0-9,.-]+\/month$/.test(r[0])),
  whole:rows.filter(r=>/^(CNY|RMB) [0-9,.-]+ yuan\/ whole program$/.test(r[0])),
  nonref:rows.filter(r=>/^(CNY|RMB) [0-9,.-]+,? non-refundable$/.test(r[0])),
  table:rows.filter(r=>/^(CNY|RMB) [0-9,.-]+\/year under the official \d{4} discipline-and-language fee table$/.test(r[0])),
  putuo:rows.filter(r=>/^Putuo Campus; school section \d+ \(.+\), table row \d+\.?$/.test(r[0])),
  degree:rows.filter(r=>/^Official (master|doctoral|undergraduate) route in Chinese; (.+); published award: (.+); published duration: (\d+) year\(s\)\.$/.test(r[0])),
 };
 assert.ok(groups.academic.length>=27);assert.ok(groups.month.length>=15);assert.equal(groups.whole.length,7);assert.ok(groups.nonref.length>=5);assert.equal(groups.table.length,9);assert.equal(groups.putuo.length,103);assert.equal(groups.degree.length,75);
 const all=Object.values(groups).flat(),api=await runtime(locale,Object.fromEntries(all.map(r=>[r[0],r[column]])),{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of all){
  const record={id:'source-record',tuitionText:row[0],applicationNote:row[0],degree:'source-degree'},before=JSON.stringify(record);api.track(record);
  assert.equal(api.text(row[0]),row[column]);assert.equal(JSON.stringify(record),before);
  assert.deepEqual(missingCatalogFacts(row[0],row[column]),[]);assert.deepEqual(missingCatalogFacts(row[column],row[0]),[]);
 }
 for(const row of groups.academic)assert.match(row[column],academic);
 for(const row of groups.month)assert.match(row[column],month);
 for(const row of groups.whole){assert.match(row[column],whole);assert.doesNotMatch(row[column],/ปี|tahun|سنة|عام/,'Whole-program fee must not become an annual fee');}
 for(const row of groups.nonref)assert.match(row[column],nonref);
 for(const row of groups.table){assert.match(row[column],discipline);assert.match(row[column],instruction);}
 for(const row of groups.degree){
  const match=/^Official (master|doctoral|undergraduate) route in Chinese; (.+); published award: (.+);/.exec(row[0]);
  assert.match(row[column].split(';')[0],levels[match[1]]);
  if(locale==='ms'&&match[1]==='master')assert.doesNotMatch(row[column],/sarjana muda/i);
  if(locale==='th')assert.doesNotMatch(row[column],/เส้นทางหลัก|พ\.ศ\.|รางวัล/,'Degree route and award must not be main route, Buddhist era or prize');
  if(['B.M.','B. M.'].includes(match[3]))assert.ok(row[column].includes(match[3]),'Do not guess an expansion of an ambiguous official award code');
 }
});

for(const [locale,inclusive,strict,master,monthly,words,one,two,jan,dec,june]of [
 ['th',/ไม่เกิน/,/ภายใต้|ต่ำกว่า/,/ปริญญาโท/,/เดือน/,/คำ/,/หนึ่ง/,/สอง/,/มกราคม/,/ธันวาคม/,/มิถุนายน/],
 ['id',/tidak lebih dari/,/di bawah/,/magister/i,/bulan/,/kata/,/Satu/i,/Dua/i,/Januari/,/Desember/,/Juni/],
 ['ms',/tidak melebihi/,/di bawah/,/sarjana/i,/bulan/,/perkataan/,/Satu/i,/Dua/i,/Januari/,/Disember/,/Jun/],
 ['ar',/لا يتجاوز/,/يقل|أقل من/,/ماجستير/,/شهر/,/كلمة/,/واحدة/,/رسالتا|رسالتين|توصيتان|توصيتين/,/يناير|كانون الثاني/,/ديسمبر|كانون الأول/,/يونيو|حزيران/],
])test(`${locale} candidate scholarship requirements preserve age boundaries, stipends, word counts and Gregorian date precision`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const column=['en','vi','th','id','ms','ar'].indexOf(locale),find=source=>{const row=rows.find(r=>r[0]===source);assert.ok(row,source);return row;};
 const cap=find('Master applicant no older than 35'),lower=find("Bachelor's degree holder under 35");
 const money=find('CNY 3,000/month master; CNY 3,500/month doctoral'),bare=find('RMB 3,000 master; RMB 3,500 doctoral');
 const count=find('At least 1,000 words in Chinese or English');
 const letter=find('One signed recommendation from a high-school teacher, homeroom teacher or school leader'),letters=find('Two professor or associate-professor recommendation letters');
 const january=find('January 31, 2026'),december=find('December 20, 2026'),monthOnly=find('June 2026');
 const all=[cap,lower,money,bare,count,letter,letters,january,december,monthOnly],api=await runtime(locale,Object.fromEntries(all.map(r=>[r[0],r[column]])),{locales:{[locale]:{ready:true,sha256:'fixture'}}});
 for(const row of all){const record={id:'source-record',requirementText:row[0],applicationAvailability:'source-status'},before=JSON.stringify(record);api.track(record);assert.equal(api.text(row[0]),row[column]);assert.equal(JSON.stringify(record),before);assert.deepEqual(missingCatalogFacts(row[0],row[column]),[]);assert.deepEqual(missingCatalogFacts(row[column],row[0]),[]);}
 assert.match(cap[column],inclusive);assert.match(cap[column],master);assert.match(lower[column],strict);assert.doesNotMatch(lower[column],inclusive);
 assert.match(money[column],master);assert.match(money[column],monthly);assert.match(bare[column],master);assert.doesNotMatch(bare[column],monthly,'Do not invent a period absent from the amount source');
 if(locale==='th')for(const row of [cap,money,bare])assert.doesNotMatch(row[column],/ผู้สมัครหลัก|อาจารย์|ค่าจ้าง/,'Master-degree stipend/applicant must not become teacher wages or main applicant');
 assert.match(count[column],words);assert.doesNotMatch(count[column],/ตัวอักษร|karakter|aksara|حرف/,'Words must not become characters');
 assert.match(letter[column],one);assert.match(letters[column],two);
 assert.match(january[column],jan);assert.match(december[column],dec);assert.match(monthOnly[column],june);
 assert.deepEqual(monthOnly[column].match(/\d+/g),['2026'],'Month precision must not acquire a day or Buddhist-era year');
});

for(const [locale,strict,inclusive,semester,month,tuition]of [
 ['th',/ต่ำกว่า|ภายใต้/,/หรือต่ำกว่า/,/หนึ่ง/,/เดือน/,/ค่าเล่าเรียน/],
 ['id',/di bawah/i,/atau kurang/,/Satu/i,/bulan/,/biaya kuliah/],
 ['ms',/di bawah/i,/atau kurang/,/Satu/i,/bulan/,/yuran pengajian/],
 ['ar',/أقل من/,/أو أقل/,/واحد/,/شهر/,/الرسوم الدراسية/],
])test(`${locale} candidate catalog labels preserve strict age, inclusive age, semester, duration, coverage and exam thresholds`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const column=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(rows.map(r=>[r[0],r[column]]));
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'candidate-fixture-only'}}});
 const records=[
  {id:'school-source',targetCountries:['Viet Nam','South Korea','United States'],languageRequirement:'HSK 5 ≥ 180',minimumGpa:'Minimum GPA'},
  {id:'program-source',nameEn:'Marine Biology',subjectArea:'Cell Biology',academicField:'Legal History'},
  {id:'scholarship-source',eligibilityItems:[{label:'Under 35',value:'45 or under'}],coverage:'50% tuition',applicationMaterials:['HSK report','CSCA report','Passport copy'],applicationRound:'One semester',durationText:'1–12 months',guarantee:'No guarantee'},
 ];
 for(const record of records){const before=JSON.stringify(record);api.track(record);assert.equal(JSON.stringify(record),before);}
 const keys=['Under 35','45 or under','One semester','1–12 months','50% tuition','HSK 5 ≥ 180','HSK 4, 210+','HSK report','CSCA report','Minimum GPA','No guarantee','If applicable','Marine Biology','Cell Biology','Legal History'];
 for(const key of keys){assert.ok(dictionary[key],`${locale}: ${key}`);assert.equal(api.text(key),dictionary[key]);assert.deepEqual(missingCatalogFacts(key,dictionary[key]),[]);assert.deepEqual(missingCatalogFacts(dictionary[key],key),[]);}
 assert.match(dictionary['Under 35'],strict);assert.doesNotMatch(dictionary['Under 35'],inclusive);assert.match(dictionary['45 or under'],inclusive);
 assert.match(dictionary['One semester'],semester);assert.match(dictionary['1–12 months'],month);assert.match(dictionary['50% tuition'],tuition);
 assert.ok(dictionary['50% tuition'].includes('50%'));assert.ok(dictionary['HSK 5 ≥ 180'].includes('≥'));assert.ok(dictionary['HSK 4, 210+'].includes('210+'));
 assert.notEqual(dictionary['No guarantee'],dictionary['Full tuition']);assert.notEqual(dictionary['If applicable'],dictionary['No guarantee']);
});

for(const [locale,unpublished,notRequired,required,above,closed,evaluated,annual,choice,potential]of [
 ['th',/ไม่ได้เผยแพร่/,/ไม่ต้องใช้/,/ต้องใช้/,/มากกว่า/g,/ปิด/,/ประเมิน/,/ปี/,/หรือ/,/คาดว่าจะ/],
 ['id',/Tidak ada.+dipublikasikan/,/tidak diperlukan/,/diperlukan/,/lebih dari/g,/ditutup/,/dievaluasi/,/tahun/,/atau/,/Calon/],
 ['ms',/Tiada.+diterbitkan/,/tidak diperlukan/,/diperlukan/,/melebihi/g,/ditutup/,/dinilai/,/tahun/,/atau/,/Bakal/],
 ['ar',/لم يُنشر/,/لا يُشترط/,/مطلوب/,/أعلى من/g,/أُغلقت/,/يُقيَّم/,/سنويًا/,/أو/,/محتمل/],
])test(`${locale} candidate admissions prose retains unpublished-versus-waived requirements, strict scores and conditional funding`,async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const column=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(rows.map(r=>[r[0],r[column]]));
 const sources=[
  'No CSCA requirement is published on the official SUSTech international undergraduate pages.',
  'Acceptance-letter policy: Acceptance Letter not Required.',
  'Acceptance-letter policy: Check (Acceptance Letter Required).',
  'TOEFL above 70, IELTS above 6.0, Duolingo above 105, or other proof of English proficiency for non-native English speakers applying to English-taught programs.',
  'Fall 2026 international undergraduate route. The published application window is closed.',
  'All admitted international postgraduates are evaluated for a comprehensive scholarship; a separate self-funded tuition rate is not stated in this guide.',
  'RMB 39,000 or 45,000/year according to discipline category',
  'Full-time English-taught 2026 postgraduate route. A potential supervisor and signed research plan are required.',
  'Apply through the official online system published in the guide; the reviewed guide prints an HTTP application address.',
  'The reviewed table does not publish a single duration for this route, so durationYears remains absent.',
 ];
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'candidate-fixture-only'}}});
 for(const source of sources){assert.ok(dictionary[source],source);const record={id:'unchanged-source-id',applicationNote:source,applicationAvailability:'closed',sourceUrl:'http://official.example/apply'},before=JSON.stringify(record);api.track(record);assert.equal(api.text(source),dictionary[source]);assert.equal(JSON.stringify(record),before);assert.deepEqual(missingCatalogFacts(source,dictionary[source]),[]);assert.deepEqual(missingCatalogFacts(dictionary[source],source),[]);}
 const values=sources.map(s=>dictionary[s]);
 assert.match(values[0],unpublished);assert.match(values[1],notRequired);assert.match(values[2],required);assert.doesNotMatch(values[2],notRequired);
 assert.equal([...values[3].matchAll(above)].length,3,'All three exam thresholds remain strictly above');assert.doesNotMatch(values[3],/≥|>=/);
 assert.match(values[4],closed);assert.match(values[5],evaluated);assert.match(values[6],annual);assert.match(values[6],choice);assert.match(values[7],potential);
 assert.ok(values[8].includes('HTTP'));assert.ok(!values[8].includes('HTTPS'));assert.ok(values[9].includes('durationYears'));
});

test('activated Vietnamese master age, funding and route labels retain academic-degree meaning',async()=>{
 const d=JSON.parse(await fs.readFile(new URL('../public/catalog-content-vi.json',import.meta.url),'utf8'));
 const expected={'Master age':'Độ tuổi ứng viên thạc sĩ','Master award':'Học bổng bậc thạc sĩ','Master route':'Lộ trình thạc sĩ'};
 const api=await runtime('vi',d);
 for(const [key,value]of Object.entries(expected)){assert.equal(d[key],value);assert.equal(api.text(key),value);assert.match(value,/thạc sĩ/);assert.doesNotMatch(value,/Tuổi chủ|cao thủ|Lộ trình chính/);}
});

test('reviewed scholarship corrections preserve funding periods and distinguish HSKK Intermediate from an average score',async()=>{
 const rows=await loadCatalogTranslationOverrides();
 const sources=['CNY 20,000 master; CNY 30,000 doctoral','Bachelor CNY 20,000/year for up to 4 years; Master CNY 25,000/year for up to 3 years; Doctoral CNY 30,000/year for up to 3 years','Two years; HSK 5 score 210 or above and HSKK Intermediate score 60 or above','Covered'];
 for(const [locale,degree,intermediate,annual]of [['vi',/thạc sĩ/i,/HSKK trung cấp/,/năm/],['th',/ปริญญาโท/,/HSKK ระดับกลาง/,/ปี/],['id',/magister/i,/HSKK tingkat menengah/,/tahun/],['ms',/sarjana/i,/HSKK peringkat pertengahan/,/tahun/],['ar',/ماجستير/,/HSKK المستوى المتوسط/,/سنويًا/]]){
  const column=['en','vi','th','id','ms','ar'].indexOf(locale),selected=sources.map(key=>{const row=rows.find(r=>r[0]===key);assert.ok(row,key);return row;});
  const api=await runtime(locale,Object.fromEntries(selected.map(row=>[row[0],row[column]])),{locales:{[locale]:{ready:true,sha256:'pending-candidate-fixture'}}});
  for(const row of selected){assert.equal(api.text(row[0]),row[column]);assert.deepEqual(missingCatalogFacts(row[0],row[column]),[]);assert.deepEqual(missingCatalogFacts(row[column],row[0]),[]);}
  assert.match(selected[0][column],degree);assert.match(selected[1][column],degree);assert.match(selected[1][column],annual);assert.match(selected[2][column],intermediate);
  if(locale==='vi'){assert.doesNotMatch(selected[0][column],/chủ nhân|mỗi tháng|một lần/i);assert.doesNotMatch(selected[2][column],/điểm trung bình/i);assert.equal(selected[3][column],'Được chi trả');}
 }
});

test('activated Vietnamese detail funding notes distinguish tuition waivers, payable fees, renewal and non-guaranteed awards',async()=>{
 const dictionary=JSON.parse(await fs.readFile(new URL('../public/catalog-content-vi.json',import.meta.url),'utf8')),api=await runtime('vi',dictionary);
 const cases=[
  ['The published award covers first-year tuition only. Accommodation, insurance, living costs and all other expenses remain the student\'s responsibility.',/chỉ hỗ trợ học phí năm đầu/,/tự chịu/],
  ['This scholarship does not waive any fee. Tuition, accommodation, living expenses and comprehensive medical insurance remain payable by the student.',/không miễn bất kỳ khoản phí nào/,/vẫn phải đóng/],
  ['The BLCU international-student scholarship committee evaluates applications; an application does not guarantee an award.',/không bảo đảm/],
  ['This category does not cover accommodation, living expenses, or insurance.',/không hỗ trợ/],
  ['Type A follows the standard program length and is renewed after annual review. Type B is valid for 12 months in the first academic year.',/đánh giá hằng năm/,/Loại B có hiệu lực 12 tháng/],
  ['Type A and Type B cannot be combined; a Type A recipient is not eligible for Type B.',/Không được kết hợp/,/không đủ điều kiện/],
  ['CNY 2,500 monthly bachelor\'s stipend',/cử nhân hằng tháng/],
  ['Failure of the pre-enrollment physical examination, unauthorized non-registration, withdrawal, or leave can end eligibility.',/có thể làm mất điều kiện/],
 ];
 for(const [source,...patterns]of cases){const value=dictionary[source];assert.ok(value,source);assert.equal(api.text(source),value);for(const pattern of patterns)assert.match(value,pattern);assert.deepEqual(missingCatalogFacts(source,value),[]);assert.deepEqual(missingCatalogFacts(value,source),[]);}
 const covered=api.text('Covered'),exam=api.text('Two years; HSK 5 score 210 or above and HSKK Intermediate score 60 or above');
 assert.equal(covered,'Được chi trả');assert.match(exam,/HSKK trung cấp/);assert.doesNotMatch(exam,/điểm trung bình/i);
 assert.equal(api.text('CNY 20,000 master; CNY 30,000 doctoral'),'Thạc sĩ: CNY 20,000; tiến sĩ: CNY 30,000');
});

test('activated Vietnamese detail timelines preserve funding versus study length, quotas and academic thresholds',async()=>{
 const dictionary=JSON.parse(await fs.readFile(new URL('../public/catalog-content-vi.json',import.meta.url),'utf8')),api=await runtime('vi',dictionary);
 const cases=[
  ['The CSC application system records a one-year study duration because the scholarship funds one academic year; the academic program itself lasts two years.',/tài trợ một năm học/,/chương trình đào tạo kéo dài hai năm/],
  ['Maximum 5 months beginning in March 2027.',/Tối đa 5 tháng/,/tháng Ba năm 2027/],
  ['The scholarship is valid for one academic year; the official notice publishes 20 undergraduate and 20 graduate places, subject to adjustment without changing the total budget.',/20 suất cử nhân và 20 suất sau đại học/,/có thể điều chỉnh/,/không thay đổi tổng ngân sách/],
  ['The page publishes no numerical cap for this tuition-and-accommodation category.',/không công bố giới hạn số suất/],
  ['Chinese-taught students need GPA 2.5+, English-taught students GPA 3.0+, attendance of at least 90%, an Excellent supervisor review, annual defense review from year two, and an accepted/published SCI or EI paper by year three.',/GPA 2.5\+/,/GPA 3.0\+/,/ít nhất 90%/,/Xuất sắc/,/năm thứ hai/,/SCI hoặc EI/,/năm thứ ba/],
 ];
 for(const [source,...patterns]of cases){const record={id:'source-id',applicationNote:source,applicationAvailability:'closed'},before=JSON.stringify(record);api.track(record);const value=api.text(source);assert.notEqual(value,source);for(const pattern of patterns)assert.match(value,pattern);assert.deepEqual(missingCatalogFacts(source,value),[]);assert.deepEqual(missingCatalogFacts(value,source),[]);assert.equal(JSON.stringify(record),before);}
});

for(const [locale,firstYear,fees,guarantee,conditional]of [
 ['th',/เฉพาะค่าเล่าเรียนปีแรก/,/ไม่ยกเว้น/,/ไม่รับประกัน/,/ขึ้นอยู่กับ/],
 ['id',/hanya menanggung biaya kuliah tahun pertama/,/tidak membebaskan/,/tidak menjamin/,/tunduk pada/],
 ['ms',/hanya menanggung yuran pengajian tahun pertama/,/tidak mengecualikan/,/tidak menjamin/,/tertakluk pada/],
 ['ar',/للسنة الأولى فقط/,/لا تعفي/,/لا يضمن/,/يخضع/],
])test(`${locale} candidate detail funding paragraphs retain first-year limits, payable expenses and review conditions`,async()=>{
 const rows=await loadCatalogTranslationOverrides(),column=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(rows.map(r=>[r[0],r[column]]));
 const sources=['The published award covers first-year tuition only. Accommodation, insurance, living costs and all other expenses remain the student\'s responsibility.','This scholarship does not waive any fee. Tuition, accommodation, living expenses and comprehensive medical insurance remain payable by the student.','The BLCU international-student scholarship committee evaluates applications; an application does not guarantee an award.','Funding is subject to UIBE and CSC review and is not guaranteed by catalog display.'];
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'candidate-fixture-only'}}});
 for(const source of sources){assert.ok(dictionary[source]);assert.equal(api.text(source),dictionary[source]);assert.deepEqual(missingCatalogFacts(source,dictionary[source]),[]);assert.deepEqual(missingCatalogFacts(dictionary[source],source),[]);}
 for(const [i,pattern]of [firstYear,fees,guarantee,conditional].entries())assert.match(dictionary[sources[i]],pattern);
});

for(const [locale,reapply,interview,unknown,month,master,bachelor,fundingYear,studyYears]of [
 ['th',/สมัครใหม่/,/อาจสัมภาษณ์/,/ไม่ได้เผยแพร่/,/มีนาคม/,/ปริญญาโท/,/ปริญญาตรี/,/ทุนสนับสนุนหนึ่งปีการศึกษา/,/หลักสูตรวิชาการมีระยะเวลาสองปี/],
 ['id',/mengajukan permohonan kembali/,/dapat mewawancarai/,/tidak memublikasikan/,/Maret/,/Magister/,/Sarjana/,/beasiswa mendanai satu tahun akademik/,/berlangsung dua tahun/],
 ['ms',/memohon semula/,/boleh menemu duga/,/tidak menerbitkan/,/Mac/,/Sarjana/,/Sarjana muda/,/biasiswa membiayai satu tahun akademik/,/berlangsung dua tahun/],
 ['ar',/إعادة التقديم/,/قد تجري مقابلات/,/لا تنشر/,/مارس/,/الماجستير/,/البكالوريوس/,/تموّل عامًا دراسيًا واحدًا/,/فيستمر لعامين/],
])test(`${locale} candidate detail lifecycle preserves reapplication, funding cycles, eligibility and published unknowns`,async()=>{
 const rows=await loadCatalogTranslationOverrides(),column=['en','vi','th','id','ms','ar'].indexOf(locale),dictionary=Object.fromEntries(rows.map(r=>[r[0],r[column]]));
 const source={
  reapply:'The published award covers the first academic year. Students must reapply and pass annual review for later years.',
  interview:'BLCU reviews complete applications and may interview shortlisted applicants before nominating candidates to CSC for final review.',
  unknown:'The page publishes no numerical cap for this tuition-and-accommodation category.',
  maximum:'Maximum 5 months beginning in March 2027.',
  degree:'Master: two years',undergraduate:'Bachelor: four years',
  cycles:'From the second year, funding is awarded semester by semester when renewal requirements are met.',
  duration:'The CSC application system records a one-year study duration because the scholarship funds one academic year; the academic program itself lasts two years.',
  conditional:'Applicants who received a similar scholarship within the prior three years are generally ineligible for the one-semester or one-year category.',
  thresholds:'Chinese-taught students need GPA 2.5+, English-taught students GPA 3.0+, attendance of at least 90%, an Excellent supervisor review, annual defense review from year two, and an accepted/published SCI or EI paper by year three.',
 };
 const api=await runtime(locale,dictionary,{locales:{[locale]:{ready:true,sha256:'candidate-fixture-only'}}});
 for(const value of Object.values(source)){assert.ok(dictionary[value],value);const record={id:'published-source-id',applicationNote:value,applicationAvailability:'closed'},before=JSON.stringify(record);api.track(record);assert.equal(api.text(value),dictionary[value]);assert.equal(JSON.stringify(record),before);assert.deepEqual(missingCatalogFacts(value,dictionary[value]),[]);assert.deepEqual(missingCatalogFacts(dictionary[value],value),[]);}
 assert.match(dictionary[source.reapply],reapply);assert.match(dictionary[source.interview],interview);assert.match(dictionary[source.unknown],unknown);
 assert.doesNotMatch(dictionary[source.unknown],/ไม่จำกัด|tanpa batas|tanpa had|غير محدود/,'An unpublished cap must not become unlimited');
 assert.match(dictionary[source.maximum],month);assert.match(dictionary[source.degree],master);assert.match(dictionary[source.undergraduate],bachelor);
 if(locale==='ms')assert.doesNotMatch(dictionary[source.degree],/sarjana muda/i);if(locale==='th')assert.doesNotMatch(dictionary[source.degree],/อาจารย์/);
 assert.match(dictionary[source.duration],fundingYear);assert.match(dictionary[source.duration],studyYears);
 for(const code of ['GPA','SCI','EI','Excellent'])assert.ok(dictionary[source.thresholds].includes(code),`${locale}: preserve ${code}`);
});

test('all 442 activated Vietnamese tuition notes retain instruction-language meaning and source facts',async()=>{
 const dictionary=JSON.parse(await fs.readFile(new URL('../public/catalog-content-vi.json',import.meta.url),'utf8'));
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const pattern=/^(.+); Full-time; official program code ([0-9A-Za-z]+); official HTML table row (\d+)\. Tuition is published by medium and discipline category in the corresponding (\d{4}) admission guide\.$/;
 const selected=Object.entries(dictionary).filter(([source])=>pattern.test(source));
 assert.equal(selected.length,442);
 for(const [source,translated]of selected){
  const match=pattern.exec(source);
  assert.match(translated,/ngôn ngữ giảng dạy và nhóm ngành/);
  assert.doesNotMatch(translated.slice(translated.lastIndexOf('Học phí')),/trung bình|kỷ luật/);
  assert.ok(translated.includes(match[2]));assert.ok(translated.includes(match[3]));assert.ok(translated.includes(match[4]));
  assert.deepEqual(missingCatalogFacts(source,translated),[]);
  assert.deepEqual(missingCatalogFacts(translated,source),[]);
 }
 const reviewed=rows.filter(row=>pattern.test(row[0]));assert.equal(reviewed.length,442);
 for(const row of reviewed)assert.equal(dictionary[row[0]],row[1]);
});

test('activated Vietnamese master requirements and stipends preserve degree, age and monthly amounts',async()=>{
 const dictionary=JSON.parse(await fs.readFile(new URL('../public/catalog-content-vi.json',import.meta.url),'utf8'));
 const expected={Master:'Thạc sĩ','Master applicant no older than 35':'Ứng viên thạc sĩ không quá 35 tuổi','CNY 3,000/month master; CNY 3,500/month doctoral':'Thạc sĩ: CNY 3,000/tháng; tiến sĩ: CNY 3,500/tháng'};
 const api=await runtime('vi',dictionary);
 for(const [original,translated]of Object.entries(expected)){
  assert.equal(dictionary[original],translated);assert.equal(api.text(original),translated);
  assert.deepEqual(missingCatalogFacts(original,translated),[]);assert.deepEqual(missingCatalogFacts(translated,original),[]);
 }
 const composed=Object.entries(dictionary).filter(([key])=>key!=='Master applicant no older than 35'&&key.includes('Master applicant no older than 35')||key!=='CNY 3,000/month master; CNY 3,500/month doctoral'&&key.includes('CNY 3,000/month master; CNY 3,500/month doctoral'));
 assert.equal(composed.length,6);
 for(const [original,translated]of composed){
  assert.match(translated,/Thạc sĩ|thạc sĩ/);assert.doesNotMatch(translated,/Người nộp đơn chính|tháng chính/);
  assert.equal(api.text(original),translated);assert.deepEqual(missingCatalogFacts(original,translated),[]);assert.deepEqual(missingCatalogFacts(translated,original),[]);
 }
 const ages=Object.entries(dictionary).filter(([key])=>key.includes("Master's applicants must hold a bachelor's degree and be under 35; doctoral applicants must hold a master's degree and be under 40."));
 assert.equal(ages.length,2);
 for(const [original,translated]of ages){assert.match(translated,/dưới 35 tuổi/);assert.match(translated,/dưới 40 tuổi/);assert.doesNotMatch(translated,/thuộc 35|thuộc 40/);assert.deepEqual(missingCatalogFacts(original,translated),[]);assert.deepEqual(missingCatalogFacts(translated,original),[]);}
});

for(const locale of ['vi','th','id','ms','ar'])test(`${locale} actual dictionary translates all three catalog record types without changing source facts or identifiers`,{skip:manifest.locales[locale]?.ready!==true?'No fully validated body asset; this locale remains pending':false},async()=>{
 assert.equal(manifest.locales[locale]?.ready,true,`${locale} must be fully validated before activation`);
 const body=await fs.readFile(new URL(`../public/catalog-content-${locale}.json`,import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(body).digest('hex'),manifest.locales[locale].sha256);
 const dictionary=JSON.parse(body),api=await runtime(locale,dictionary);assert.equal(api.state,'ready');
 for(const [kind,fields]of Object.entries(samples)){
  const record={id:'00000000-0000-4000-8000-000000000001',sourceUrl:'https://university.example/English',...fields};
  const original=JSON.stringify(record);api.track(record);assert.equal(JSON.stringify(record),original);
  for(const [field,value]of Object.entries(fields)){
   const translated=api.text(value);
   assert.notEqual(translated,value,`${locale} ${kind}.${field}`);
   assert.doesNotMatch(translated,/\p{Script=Han}|91357\d{4}|98271\d{4}|ZXQ\d{4}QXZ/u);
   assert.deepEqual(missingCatalogFacts(value,translated),[],`${locale} ${kind}.${field} facts`);
   assert.ok(api.phrase(`${value} · 2027`).includes(translated),`${locale} composed display field`);
  }
 }
});

for(const [locale,index,navyWord]of [['th',2,'กองทัพ'],['id',3,'Angkatan Laut'],['ms',4,'Tentera Laut'],['ar',5,'القوات البحرية']])test(locale+' candidate faculties retain academic context instead of military or biotechnology substitutions',async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const get=s=>{const r=rows.find(x=>x[0]===s);assert.ok(r,s);return r[index];};
 assert.ok(!get('School of Naval Architecture and Ocean Engineering').includes(navyWord));
 assert.ok(!get('Naval Architecture and Ocean Engineering').includes(navyWord));
 assert.notEqual(get('Bioengineering'),get('Biotechnology'));
 assert.notEqual(get('School of Bioengineering'),get('School of Biotechnology'));
 const academic=get('School of Medicine; Academic degree; Shenzhen Campus'),professional=get('School of Medicine; Professional degree; Shenzhen Campus');
 assert.notEqual(academic,professional);assert.equal(academic.split('; ').at(-1),professional.split('; ').at(-1));
 const academicMaterial=get('Materials');
 for(const s of['School of Materials','College of Materials'])assert.ok(get(s).includes(academicMaterial));
});


for(const [locale,index,orWord]of [['th',2,'หรือ'],['id',3,'atau'],['ms',4,'atau'],['ar',5,'أو']])test(locale+' candidate program titles retain degree, teaching language and alternative exam conditions',async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const get=s=>{const r=rows.find(x=>x[0]===s);assert.ok(r,s);return r[index];};
 const master=get('Master of E-Commerce'),doctor=get('Doctor of E-Commerce');
 assert.notEqual(master,doctor);assert.ok(master.includes(get('Master')));assert.ok(doctor.includes(get('Doctoral')));
 for(const value of[master,doctor])assert.ok(value.includes(get('E-commerce')));
 assert.ok(get('Mining Engineering (English)').includes(get('English')));
 assert.notEqual(get('Journalism and Communication (Academic Degree)'),get('Journalism and Communication (Professional Degree)'));
 assert.ok(get('HSK Level 5 or equivalent Chinese proficiency.').includes(orWord));
 assert.ok(get('Humanities Chinese (or STEM Chinese), Mathematics').includes(orWord));
 assert.ok(get('Humanities Chinese (or STEM Chinese), Mathematics').includes('STEM'));
 assert.ok(get('Doctor of Solid Mechanics').includes(get('Solid Mechanics')));
 assert.ok(get('Doctor of Engineering Mechanics').includes(get('Engineering Mechanics')));
 const mechanical=get('Mechanical Engineering (English)').split(' (')[0];
 const directions=['Measurement Technology and Instruments','Mechanical Design and Theory','Mechanical manufacture and automation','Mechatronics'].map(d=>get('Mechanical Engineering（'+d+'）'));
 assert.equal(new Set(directions).size,4);for(const d of directions)assert.ok(d.startsWith(mechanical+' ('));
 assert.equal(get('Master of Business Administration (MBA)').replace(' (MBA)',''),get('Master of Business Administration'));
 assert.ok(get('Published research fields: Bioengineering').includes(get('Bioengineering')));
 assert.notEqual(get('Published research fields: Nursing'),get('Published research fields: Nursing Official notes: Enrollment by Major'));
 const visiting=get('General Scholar, Senior Scholar'),grant={th:'ทุน',id:'beasiswa',ms:'biasiswa',ar:'منحة'}[locale];
 assert.ok(!visiting.toLowerCase().includes(grant));if(locale==='th')assert.ok(!visiting.includes('ระยะสั้น'));
 const degreeLanguages=get('Doctoral · Chinese, English').split(' · ');assert.equal(degreeLanguages.length,2);
 assert.ok(degreeLanguages[1].includes(get('Chinese')));assert.ok(degreeLanguages[1].includes(get('English')));
 assert.match(get('Chemistry or Biology'),new RegExp(orWord));
 assert.notEqual(get('Medical Imaging'),get('Medical Imaging Technology'));
 const associate=get('Associate').toLowerCase();
 for(const name of['Applied Chinese - Business (Associate)','Applied Chinese - Technology (Associate)','Chinese Language - Chinese-English Bilingual (Associate)'])assert.ok(get(name).toLowerCase().includes(associate));
 assert.ok(!associate.includes(get('Master').toLowerCase()));
 for(const key of ['Academic Master','Master Programs'])assert.ok(get(key).toLowerCase().includes(get('Master').toLowerCase()),key+' retains the master level');
 assert.ok(get('Doctor Programs').toLowerCase().includes(get('Doctoral').toLowerCase()));
 assert.ok(!get('Master Programs').toLowerCase().includes(get('Doctoral').toLowerCase()));
 assert.notEqual(get('School of Chemistry and Biological Engineering'),get('College of Chemical and Biological Engineering'),'Chemistry plus biological engineering is not the same as chemical plus biological engineering');
 assert.notEqual(get('School of Automation and Electrical Engineering'),get('School of Automation and Electronic Information'),'Electrical engineering must not collapse into electronic information');
 assert.equal(get('School of Physical Science and Technonlogy'),get('College of Physical Science and Technology'),'A known spelling variant preserves the complete physical science and technology meaning');
 const conditional=get("March 2027 foundation plus conditional bachelor's progression");assert.match(conditional,{th:/มีเงื่อนไข/,id:/bersyarat/,ms:/bersyarat/,ar:/مشروط/}[locale]);
 assert.match(get('Chinese for Arts or Science'),new RegExp(orWord));
 assert.ok(get('Applied Physics (French)').includes(get('French')));assert.ok(!get('Applied Physics (French)').includes(get('English')));
 assert.notEqual(get('Biomedical Engineering (Engineering)'),get('Biomedical Engineering (Medicine)'),'Engineering and medicine contexts remain distinct');
 const dual=get('Biomedical Informatics (Dual Degree)');assert.ok(dual.toLowerCase().includes(get('Dual Degree').toLowerCase()));assert.ok(!dual.toLowerCase().includes(get('Master').toLowerCase()),'A dual-degree label does not imply a master level');
 const pharmacyDirections=['Medicinal Chemistry','Microbiological and Biochemical Pharmacy','Pharmaceutical Analysis','Pharmaceutics','Pharmacognosy','Pharmacology'].map(d=>get('Pharmacy - '+d));
 assert.equal(new Set(pharmacyDirections).size,6,'Pharmacy specialties do not collapse to a generic pharmacy title');
 assert.ok(get('Mechanics (Engineering) (English)').includes(get('English')));assert.ok(get('Mechanics (Engineering) (English)').includes(get('Mechanics (Engineering)')));
 assert.ok(get('Master of Applied Psychology').toLowerCase().includes(get('Master').toLowerCase()));

 assert.ok(!get('Professional degree').includes(get('Master')));
 assert.match(get('Humanities Chinese or STEM Chinese'),new RegExp(orWord));



});

for(const [locale,index,overall,listening,unpublished,limitedScope,optionalChinese,mandatoryMath]of[
 ['th',2,/คะแนนรวมอย่างน้อย 180/,/การฟังอย่างน้อย 70/,/ไม่มีการประกาศคะแนนขั้นต่ำ/,/ไม่มีการระบุว่า CSCA.*ทุกเส้นทาง/,/อาจไม่ต้องสอบภาษาจีน/,/แต่ต้องสอบคณิตศาสตร์และเคมี/],
 ['id',3,/total minimal 180/,/menyimak minimal 70/,/minimum tidak dipublikasikan/,/CSCA tidak dinyatakan.*semua jalur/,/boleh tidak mengambil Bahasa Mandarin/,/tetapi wajib mengikuti Matematika dan Kimia/],
 ['ms',4,/keseluruhan sekurang-kurangnya 180/,/mendengar sekurang-kurangnya 70/,/tiada ambang skor minimum diterbitkan/,/CSCA tidak dinyatakan.*semua laluan/,/boleh tidak mengambil Bahasa Cina/,/tetapi mesti mengambil Matematik dan Kimia/],
 ['ar',5,/مجموع لا يقل عن 180/,/استماع لا تقل عن 70/,/لم يُنشر حد أدنى للدرجات/,/ولا يُذكر CSCA.*لجميع مسارات القبول/,/يمكن.*عدم أداء الصينية/,/لكن يجب.*الرياضيات والكيمياء/]
])test(locale+' candidate admission prose binds scores to sections and limits waivers to the published scope',async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../src/content/catalog-translation-overrides.json',import.meta.url),'utf8'));
 const get=prefix=>{const matches=rows.filter(r=>r[0].startsWith(prefix));assert.equal(matches.length,1,prefix);return matches[0][index];};
 const hsk=get('Valid HSK Level 4 with at least 180 overall');assert.match(hsk,overall);assert.match(hsk,listening);assert.ok(hsk.includes('2024'));
 assert.match(get('2026 CSCA required subjects: Chinese(STEM) Mathematics Physics;'),unpublished);
 const fees=get('Years 1-2 at BLCU: CNY 25,800 per year; years 3-4 at the University of Manchester: GBP 25,200 in year 3 and GBP 31,500 in year 4 (Manchester states 2026 tuition remains subject to final confirmation).');
 assert.ok(fees.includes('CNY 25,800'));assert.ok(fees.includes('GBP 25,200'));assert.ok(fees.includes('GBP 31,500'));
 const limits={
 th:{year3:/GBP 25,200 ในปี 3/,year4:/GBP 31,500 ในปี 4/,masters:/จำกัดเฉพาะผู้สมัครปริญญาโทและปริญญาเอก/,noBachelor:/ไม่ได้ยืนยันสิทธิรับทุน.*ปริญญาตรี/},
 id:{year3:/GBP 25,200 pada tahun 3/,year4:/GBP 31,500 pada tahun 4/,masters:/terbatas pada pelamar magister dan doktor/,noBachelor:/tidak menetapkan hak beasiswa.*sarjana ini/},
 ms:{year3:/GBP 25,200 pada tahun 3/,year4:/GBP 31,500 pada tahun 4/,masters:/terhad kepada pemohon sarjana dan kedoktoran/,noBachelor:/tidak mengesahkan kelayakan.*sarjana muda/},
 ar:{year3:/GBP 25,200 في السنة 3/,year4:/GBP 31,500 في السنة 4/,masters:/تقتصر.*على.*للماجستير والدكتوراه/,noBachelor:/لا تثبت.*البكالوريوس/}
 }[locale];assert.match(fees,limits.year3);assert.match(fees,limits.year4);
 const award=get("The reviewed 2026 Shandong Provincial Government Scholarship is limited to master's and doctoral applicants;");assert.match(award,limits.masters);assert.match(award,limits.noBachelor);

 assert.match(get('For Chinese Government Scholarship applicants: Chinese (Humanities), Mathematics.'),limitedScope);
 const waiver=get('English-taught applicants may omit Professional Chinese but must take');assert.match(waiver,optionalChinese);assert.match(waiver,mandatoryMath);
});


test('published VI associate family uses college-level terms rather than collaboration or staff roles',async()=>{
 const dictionary=JSON.parse(await fs.readFile(new URL('../public/catalog-content-vi.json',import.meta.url),'utf8'));
 const family=Object.entries(dictionary).filter(([source])=>/\bAssociate\b/.test(source));assert.equal(family.length,8);
 for(const[source,target]of family){assert.match(target,/cao đẳng/i,source);assert.doesNotMatch(target,/cộng tác|cán bộ|liên kết/i,source);}
});

for(const [locale,index,first,third,north,south,shenzhen,zhuhai,year]of[
 ['th',2,/แห่งที่หนึ่ง/,/แห่งที่สาม/,/กว่างโจวเหนือ/,/กว่างโจวใต้/,/เซินเจิ้น/,/จูไห่/,/ปี/],
 ['id',3,/Afiliasi Pertama/,/Afiliasi Ketiga/,/Guangzhou Utara/,/Guangzhou Selatan/,/Shenzhen/,/Zhuhai/,/tahun/],
 ['ms',4,/Gabungan Pertama/,/Gabungan Ketiga/,/Guangzhou Utara/,/Guangzhou Selatan/,/Shenzhen/,/Zhuhai/,/tahun/],
 ['ar',5,/المستشفى الأول/,/المستشفى الثالث/,/الشمالي/,/الجنوبي/,/شنتشن/,/تشوهاي/,/سنوات|سنين|عام|سنة/],
])test(`${locale} candidate faculty notes preserve numbered hospitals, campus boundaries, degree type and unspecified duration units`,async()=>{
 const rows=await loadCatalogTranslationOverrides(),get=key=>{const row=rows.find(r=>r[0]===key);assert.ok(row,key);return row[index];};
 const one=get('The First Affiliated Hospital, Sun Yat-sen University; Academic degree; Guangzhou North Campus');
 const three=get('The Third Affiliated Hospital, Sun Yat-sen University; Academic degree; Guangzhou North Campus');
 const threeSouth=get('The Third Affiliated Hospital, Sun Yat-sen University; Academic degree; Guangzhou South Campus');
 assert.match(one,first);assert.doesNotMatch(one,third);assert.match(three,third);assert.match(three,north);assert.doesNotMatch(three,south);assert.match(threeSouth,south);assert.doesNotMatch(threeSouth,north);
 const academic=get('Academic degree'),professional=get('Professional degree');
 for(const [campus,pattern]of [['Shenzhen',shenzhen],['Zhuhai',zhuhai]]){
  const a=get(`School of Cyber Science and Technology; Academic degree; ${campus} Campus`),p=get(`School of Cyber Science and Technology; Professional degree; ${campus} Campus`);
  assert.match(a,pattern);assert.match(p,pattern);assert.ok(a.includes(academic));assert.ok(p.includes(professional));assert.ok(!a.includes(professional));assert.notEqual(a,p);
 }
 const noUnit=get('College of Animal Sciences. Published duration: 4.'),years=get('College of Animal Sciences. Published duration: 3 years.');
 assert.match(noUnit,/(?<!\d)4(?!\d)/);assert.doesNotMatch(noUnit,year,'No unit may be inferred from an unqualified duration');assert.match(years,year);assert.match(years,/(?<!\d)3(?!\d)/);
});

for(const [locale,index,should,english,firstAuthor,one,master]of[
 ['th',2,/ควร/,/ภาษาอังกฤษ/,/ผู้เขียนชื่อแรก/,/หนึ่ง/,/ปริญญาโท/],
 ['id',3,/sebaiknya/,/Inggris/,/penulis pertama/,/satu/,/magister/i],
 ['ms',4,/sepatutnya/,/Inggeris/,/penulis pertama/,/satu/,/sarjana(?! muda)/i],
 ['ar',5,/ينبغي/,/بالإنجليزية/,/المؤلف الأول/,/واحد/,/ماجستير/],
])test(`${locale} candidate clinical conditions preserve recommendation strength, English-route HSK scores and first-author requirements`,async()=>{
 const rows=await loadCatalogTranslationOverrides(),get=key=>{const row=rows.find(r=>r[0]===key);assert.ok(row,key);return row[index];};
 const englishSource='Published research fields: Biomedical Engineering and Technology Official notes: Applicants should also obtain a score of 180 or above in HSK 4 for courses taught in English.';
 const recommendation=get(englishSource);assert.match(recommendation,should);assert.match(recommendation,english);assert.match(recommendation,/HSK 4/);assert.match(recommendation,/(?<!\d)180(?!\d)/);assert.doesNotMatch(recommendation,/HSK 5|(?<!\d)220(?!\d)/);
 const bachelorSource='Published research fields: Clinical Skills and Research Official notes: Practice-oriented degree. Applicants shall have the bachelor degree of clinical medicine, and obtain a score of 220 or above on HSK 5.';
 const bachelor=get(bachelorSource);assert.match(bachelor,/HSK 5/);assert.match(bachelor,/(?<!\d)220(?!\d)/);assert.doesNotMatch(bachelor,master,'A bachelor-only requirement must not acquire a master prerequisite');assert.doesNotMatch(bachelor,/SCI/);
 const publicationSource="Published research fields: Neurology Official notes: Applicants shall publish one SCI paper as the first author during the master's degree in Clinical Medicine, and obtain a score of 220 or above on HSK 5.";
 const publication=get(publicationSource);assert.match(publication,/SCI/);assert.match(publication,one);assert.match(publication,firstAuthor);assert.match(publication,master);assert.match(publication,/HSK 5/);assert.match(publication,/(?<!\d)220(?!\d)/);
 const psychology=get("Published research fields: Applied Psychology Official notes: Applicants shall have the bachelor and master in Psychology or Clinical Medicine,obtain a score of 220 or above on HSK 5, and published 1 SCI paper as first author during the Master's Degree.");
 assert.match(psychology,{th:/หรือ/,id:/\batau\b/,ms:/\batau\b/,ar:/أو/}[locale]);assert.match(psychology,/HSK 5/);assert.match(psychology,/(?<!\d)220(?!\d)/);assert.match(psychology,/(?<!\d)1(?!\d)/);assert.match(psychology,firstAuthor);
 for(const key of[
  'Siming Campus; School of Management; Dept. of Accounting; Full-time; official HTML table row 15. Tuition is published by medium and discipline category in the corresponding 2026 admission guide.',
  "Xiang'an Campus; College of Energy; Dept. of New Energy; Full-time; official HTML table row 55. Tuition is published by medium and discipline category in the corresponding 2026 admission guide."
 ]){
  const translated=get(key);assert.match(translated,/HTML/);assert.match(translated,/(?<!\d)2026(?!\d)/);assert.match(translated,new RegExp('(?<!\\d)'+/table row (\d+)/.exec(key)[1]+'(?!\\d)'));
  assert.deepEqual(missingCatalogFacts(key,translated),[]);assert.deepEqual(missingCatalogFacts(translated,key),[]);
 }
});

for(const [locale,index,bachelor,master,doctor,academic,professional,dual]of[
 ['th',2,/ปริญญาตรี/,/ปริญญาโท/,/ปริญญาเอก/,/สายวิชาการ/,/สายวิชาชีพ/,/สองปริญญา/],
 ['id',3,/\bsarjana\b/,/\bmagister\b/,/\bdoktor\b/,/akademik/,/profesional/,/gelar ganda/i],
 ['ms',4,/sarjana muda/,/sarjana(?! muda)/,/kedoktoran/,/akademik/,/profesional/,/dwiijazah/i],
 ['ar',5,/البكالوريوس/,/الماجستير/,/الدكتوراه/,/الأكاديمي/,/المهني/,/مزدوج/],
])test(`${locale} candidate offered routes preserve degree level, academic or professional qualification and fractional study length`,async()=>{
 const rows=await loadCatalogTranslationOverrides(),get=key=>{const row=rows.find(r=>r[0]===key);assert.ok(row,key);return row[index];};
 const undergraduate=get('Bachelor bachelor route offered by Shanghai Film Academy. Official published length: 4 years.');
 assert.match(undergraduate,bachelor);assert.doesNotMatch(undergraduate,doctor);assert.doesNotMatch(undergraduate,dual,'Duplicated source Bachelor wording must not create a dual degree');assert.match(undergraduate,/(?<!\d)4(?!\d)/);
 const routes=[
  ['Academic master','School of Management','2.5',master,academic],
  ['Professional master','School of Mechatronic Engineering and Automation','2.5',master,professional],
  ['Academic doctoral','School of Mechatronic Engineering and Automation','3',doctor,academic],
  ['Professional doctoral','Shanghai Academy of Fine Arts','4',doctor,professional]
 ];
 for(const [kind,faculty,years,level,qualifier]of routes){
  const key=`${kind} route offered by ${faculty}. Official published length: ${years} years.`,translated=get(key);
  assert.match(translated,level);assert.match(translated,qualifier);assert.ok(translated.includes(get(faculty)),'Host faculty preserved');
  assert.deepEqual(missingCatalogFacts(key,translated),[]);assert.deepEqual(missingCatalogFacts(translated,key),[]);
 }
});

for(const [locale,index,must,suggested,priority,years,strictAge,academicLength,professionalLength]of[
 ['th',2,/ต้องมี/,/แนะนำให้มี/,/ให้ความสำคัญ/,/ปี/,/ต่ำกว่า/,/สายวิชาการคือ 3\.5/,/สายวิชาชีพคือ 3 ปี/],
 ['id',3,/Harus memiliki/,/Disarankan memiliki/,/Prioritas diberikan/,/tahun/,/di bawah/,/akademik adalah 3\.5/,/profesional adalah 3 tahun/],
 ['ms',4,/Mesti mempunyai/,/Disarankan mempunyai/,/Keutamaan diberikan/,/tahun/,/di bawah/,/akademik ialah 3\.5/,/profesional ialah 3 tahun/],
 ['ar',5,/يجب توفر/,/يوصى بتوفر/,/تُعطى الأولوية/,/سنة|سنوات|عام/,/أقل من/,/الأكاديمية 3\.5/,/المهنية 3 سنوات/],
])test(`${locale} candidate supervisor forms and scholarship limits retain modality, duration scope and strict ages`,async()=>{
 const rows=await loadCatalogTranslationOverrides(),get=key=>{const row=rows.find(r=>r[0]===key);assert.ok(row,key);return row[index];};
 const required=get('School of Economics. Published duration: 3.5. Must have : Form for Provisional Acceptance of International Student by ZJU Supervisor Contact：');
 const optional=get('School of Economics. Published duration: 2 years. Suggested to have: Form for Provisional Acceptance of International Student by ZJU Supervisor');
 const preferred=get('College of Biosystems Engineering and Food Science. Published duration: 4. Give priority to applicants who have Form for Provisional Acceptance of International Student by ZJU Supervisor');
 assert.match(required,must);assert.doesNotMatch(required,years,'Unqualified 3.5 duration must not acquire a year unit');assert.match(required,/ZJU/);
 assert.match(optional,suggested);assert.doesNotMatch(optional,must);assert.match(optional,years);assert.match(preferred,priority);assert.doesNotMatch(preferred,must);
 const combined=get('College of Agriculture and Biotechnology. Published duration: 4. Must have : Form for Provisional Acceptance of International Student by ZJU Supervisor Give priority to applicants who can provide English Language Test Result');
 assert.match(combined,must);assert.match(combined,priority);assert.doesNotMatch(combined,/IELTS|TOEFL/,'No English test brand or cutoff invented');
 const star=get('School of Medicine. Published duration: 3.5/3. Suggested to have: Form for Provisional Acceptance of International Student by ZJU Supervisor; Please ensure that the supervisors have the qualifications for graduate enrollment in 2026: Note: For majors marked with an asterisk (*), the duration of studies for academic degrees is 3.5 years, while that for professional degrees is 3 years.');
 assert.match(star,/\(\*\)/);assert.match(star,academicLength);assert.match(star,professionalLength);assert.match(star,/2026/);
 const age=get("Bachelor's degree and under 35 for master; master's degree and under 40 for doctoral");
 assert.equal([...age.matchAll(new RegExp(strictAge.source,'g'))].length,2);assert.match(age,/(?<!\d)35(?!\d)/);assert.match(age,/(?<!\d)40(?!\d)/);
 const funding=get("Master's living allowance RMB 3,000/month; doctoral living allowance RMB 3,500/month; other category amounts are not itemized");
 assert.match(funding,/RMB 3,000/);assert.match(funding,/RMB 3,500/);
 const categories=get('Category A covers tuition, accommodation, living allowance and comprehensive medical insurance; Category B covers tuition and comprehensive medical insurance.');
 const categoryB=categories.split({th:/ประเภท B/,id:/Kategori B/,ms:/Kategori B/,ar:/الفئة B/}[locale])[1];assert.ok(categoryB,'Category B retained');
 assert.doesNotMatch(categoryB,{th:/ที่พัก|ค่าครองชีพ/,id:/akomodasi|tunjangan hidup/,ms:/penginapan|elaun sara hidup/,ar:/السكن|بدل المعيشة/}[locale],'Category B must not acquire Category A accommodation or living allowance');
 assert.match(categoryB,{th:/ประกันสุขภาพ/,id:/asuransi kesehatan/,ms:/insurans perubatan/,ar:/التأمين الطبي/}[locale]);
 const unknownSource='Full award; the notice publishes covered items but no numeric stipend amount.';
 assert.deepEqual(missingCatalogFacts(get(unknownSource),unknownSource),[],'No stipend amount invented for unitemized coverage');
});
