import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const code=await readFile(new URL('../public/catalog-detail.js',import.meta.url),'utf8');
const parsed=ts.createSourceFile('detail.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const names=['renderProgram','renderScholarship','renderSchool','renderSection','renderStrip','renderDeadlineItems'];
const functions=parsed.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(parsed)).join('\n');
const escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;');
function runtime(){
 const context={encodeURIComponent,escapeHtml,safeUrl:s=>s||'',cleanText:s=>typeof s==='string'?s.trim():'',hasDisplayValue:v=>v!==null&&v!==undefined&&v!=='',detailUi:s=>s,displayValue:s=>s,titleCase:s=>s||'',
  relationLink:()=>'',renderDefinitions:()=>'<dl>Facts</dl>',renderTextList:()=>'',renderChips:()=>'',renderBlocks:()=>'',normalizedBlocks:()=>[],structuredItems:()=>[],textItems:()=>[],
  renderIntakes:items=>items.length?'Open intake':'No open intakes',renderRequirements:()=>'',renderHero:()=>'',renderLayout:(main,aside)=>main+aside,
  renderAside:(_r,_t,actions)=>actions.map(a=>a.href?`<a href="${escapeHtml(a.href)}">${a.label}</a>`:'').join(''),formatDate:v=>v||'Not provided',formatMoney:()=>'',formatDuration:()=>'',renderEmpty:s=>`<p>${s}</p>`};
 return vm.runInNewContext(functions+'\n({renderProgram,renderScholarship,renderSchool})',context);
}
const id='a1111111-a111-4111-8111-a11111111111',intake='b1111111-b111-4111-8111-b11111111111';
test('a program without an open intake offers real open-program search instead of an empty application form',()=>{
 const html=runtime().renderProgram({id,school:{id:'school-id',slug:'school-slug'}},{intakes:[]});
 assert.match(html,/programs\.html\?applicationReady=true&amp;university=school-slug/);
 assert.match(html,/>Browse open programs</);assert.doesNotMatch(html,/application\.html/);
 assert.match(html,/id="admissions-schedule"/);assert.match(html,/No open intakes/);
});
test('an open program keeps the exact program and intake in the application action',()=>{
 const html=runtime().renderProgram({id,school:null},{intakes:[{id:intake,intakeTerm:'autumn',intakeYear:2027}]});
 assert.ok(html.includes(`application.html?programId=${id}&amp;intakeId=${intake}#add-choice`));
 assert.match(html,/>Add to application</);assert.doesNotMatch(html,/Browse open programs/);
});
test('scholarship program actions prefer an exact linked program, then keep the related school filter',()=>{
 const render=runtime().renderScholarship;
 assert.match(render({school:{id:'school-id',slug:'school-slug'}}),/programs\.html\?university=school-slug/);
 assert.match(render({school:{id:'school-id'}}),/programs\.html\?university=school-id/);
 assert.ok(render({program:{id},school:{id:'school-id'}}).includes(`program-detail.html?program=${id}`));
 assert.match(render({}),/href="programs\.html"/);
 assert.match(render({}),/id="admissions-schedule"/);
});
test('a school schedule route still has a meaningful destination when no dates are published',()=>{
 const html=runtime().renderSchool({id,slug:'school-slug',upcomingDeadlines:[]});
 assert.match(html,/id="admissions-schedule"/);assert.match(html,/No upcoming published intake deadlines/);
});

test('official scholarship action titles remain whole original references while UI actions translate',()=>{
 const node=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='renderActions');
 const render=vm.runInNewContext(node.getText(parsed)+'\nrenderActions',{
  escapeHtml,safeUrl:s=>s,detailHref:s=>s,detailUi:s=>s.replace('Anhui University','Đại học An Huy')
 });
 const html=render([{href:'https://school.edu.cn/guide',label:'Anhui University 2026 application guide',external:true,originalLabel:true}]);
 assert.match(html,/<span data-catalog-original>Anhui University 2026 application guide<\/span>/);
 assert.doesNotMatch(html,/Đại học/);
});
