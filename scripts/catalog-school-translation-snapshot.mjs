import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ProxyAgent} from 'undici';

// Read-only public catalog snapshot for translation acceptance. This does not
// import catalog data into the local or deployed database.
const origin=process.argv.find(arg=>arg.startsWith('--origin='))?.slice(9)||'https://ucac.cn';
assert.ok(origin==='https://ucac.cn'||/^http:\/\/127\.0\.0\.1:\d+$/.test(origin),'Use the known public site or owned loopback preview');
let proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
if(proxy&&!/^https?:/.test(proxy))proxy='http://'+proxy;
const dispatcher=origin.startsWith('https:')&&proxy?new ProxyAgent(proxy):undefined;
const schools=[];let total;
for(let offset=0;total===undefined||offset<total;offset+=100){
 const response=await fetch(`${origin}/api/v1/catalog/schools?limit=100&offset=${offset}`,{dispatcher,signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});
 assert.equal(response.status,200,'Published school snapshot unavailable');
 const payload=await response.json();total??=payload.pagination?.total;
 assert.ok(Number.isSafeInteger(total)&&total>=0&&total<10000);
 assert.ok(Array.isArray(payload.data));assert.ok(payload.data.length||offset===total);
 schools.push(...payload.data);
}
assert.equal(new Set(schools.map(s=>s.id)).size,total,'Snapshot must contain every school exactly once');
await fs.mkdir('.tmp',{recursive:true});await fs.mkdir('output/feedback-20261112',{recursive:true});
const snapshot={date:new Date().toISOString(),origin,total,schools};
await fs.writeFile('output/feedback-20261112/live-school-snapshot.json',JSON.stringify(snapshot,null,2));
const data=JSON.parse(await fs.readFile('.tmp/catalog-body-data.json','utf8'));data.schools=schools;
await fs.writeFile('.tmp/catalog-body-data.json',JSON.stringify(data));
console.log(JSON.stringify({origin,publishedSchools:total,databaseWritten:false}));
