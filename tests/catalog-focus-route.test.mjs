import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const script=await readFile(new URL('../public/scholarships.js',import.meta.url),'utf8');
const ast=ts.createSourceFile('scholarships.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='renderFocus').getText(ast);
test('scholarship focus actions use a published UUID and keep each locale immediately',()=>{
 const id='a1111111-a111-4111-8111-a11111111111';
 for(const locale of ['en','vi','th','id','ms','ar']){
  const nodes=new Map(['#scholarshipFocus','#focusType','#focusTitle','#focusSummary','#focusPrograms','[data-scholarship-detail-link]','#focusFacts'].map(key=>[key,{}]));
  const render=vm.runInNewContext(fn+'\nrenderFocus',{
   document:{querySelector:key=>nodes.get(key)},scholarships:[{id,slug:'published-award'}],focusedScholarshipId:'published-award',
   scholarshipKey:x=>x.slug,scholarshipDetailKey:x=>x.id,scholarshipTypeLabel:()=>'',scholarshipType:()=>'',scholarshipTitle:()=>'',scholarshipSummary:()=>'',matchingProgramsHref:()=>'/programs.html',
   coverageValues:()=>[],scholarshipDegree:()=>'',scholarshipCountryScope:()=>[],scholarshipScopeSummary:()=>'',scholarshipDeadlineLabel:()=>'',catalogUi:s=>s,escapeCatalogHtml:s=>s,
   window:{CUACCatalogI18n:{localizeHref:path=>{const url=new URL(path,'http://local.test');url.searchParams.set('lang',locale);return url.pathname+url.search;}}},
  });
  render();
  const href=new URL(nodes.get('[data-scholarship-detail-link]').href,'http://local.test');
  assert.equal(href.searchParams.get('scholarship'),id);assert.equal(href.searchParams.get('lang'),locale);
  assert.equal(nodes.get('#scholarshipFocus').hidden,false);
 }
});
test('the hidden focus panel never ships a clickable demo CSC record',async()=>{
 const html=await readFile(new URL('../public/scholarships.html',import.meta.url),'utf8');
 const link=html.match(/<a[^>]*data-scholarship-detail-link[^>]*>/)?.[0];
 assert.ok(link);assert.doesNotMatch(link,/\bhref=/);
});
