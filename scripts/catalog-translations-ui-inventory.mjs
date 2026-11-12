import fs from 'node:fs/promises';
import ts from 'typescript';
const rows=JSON.parse(await fs.readFile('.tmp/catalog-body-inventory.json','utf8'));const map=new Map(rows.map(r=>[r.text,r]));
for(const name of ['catalog-detail','programs','universities','scholarships','cities','catalog-list-api','search']){
 const file=`public/${name}.js`,text=await fs.readFile(file,'utf8');const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function visit(node){if(ts.isStringLiteralLike(node)){const s=node.text.trim();if(!/[A-Za-z]{3}/.test(s)||/[<>={}\n]|^(?:\.|#|\/|data-|https?:)/.test(s))return;if(!s.includes(' ')&&!/^[A-Z][A-Za-z'-]+$/.test(s))return;if(!map.has(s))map.set(s,{text:s,count:1,fields:['ui.catalog'],sampleIds:[file]});}ts.forEachChild(node,visit);}visit(ast);
}
await fs.writeFile('.tmp/catalog-body-inventory.json',JSON.stringify([...map.values()],null,2));
const existing=await fs.readFile('public/catalog-detail-i18n.js','utf8');const known=new Set([...existing.matchAll(/\[\s*"([^"\n]+)"/g)].map(m=>m[1]));
console.log(JSON.stringify({total:map.size,ui:[...map.values()].filter(r=>r.fields.includes('ui.catalog')).length,detailUnmapped:[...map.values()].filter(r=>r.fields.includes('ui.catalog')&&r.sampleIds.includes('public/catalog-detail.js')&&!known.has(r.text)).map(r=>r.text)},null,2));
