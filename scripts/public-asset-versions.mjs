import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const root=new URL('../',import.meta.url);
export const publicAssetVersion=source=>createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex').slice(0,16);
export async function checkPublicAssetVersions({write=false}={}){
 const files=await fs.readdir(new URL('public/',root));
 const versions={};
 for(const name of files.filter(n=>/\.(?:js|css)$/.test(n)).sort())versions[name]=publicAssetVersion(await fs.readFile(new URL(`public/${name}`,root),'utf8'));
 const manifest=JSON.stringify(versions,null,2)+'\n',problems=[];
 const config=new URL('config/public-asset-versions.json',root);
 let existing='';try{existing=await fs.readFile(config,'utf8');}catch{}
 if(existing.replace(/\r\n/g,'\n')!==manifest){if(write)await fs.writeFile(config,manifest);else problems.push('config/public-asset-versions.json');}
 let references=0;
 for(const name of files.filter(n=>n.endsWith('.html'))){
  const file=new URL(`public/${name}`,root),source=await fs.readFile(file,'utf8');
  const result=source.replace(/\b(?:src|href)=(['"])(\/?[A-Za-z0-9_-]+\.(?:js|css))(?:\?[^'"]*)?\1/g,(match,quote,path)=>{
   const version=versions[path.replace(/^\//,'')];if(!version)return match;references++;
   return match.replace(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:\\?[^'"]*)?`),`${path}?v=${version}`);
  });
  if(result!==source){if(write)await fs.writeFile(file,result);else problems.push(name);}
 }
 if(problems.length)throw new Error(`Public asset versions are stale in ${problems.join(', ')}. Run npm run assets:update before building.`);
 return {assets:Object.keys(versions).length,references};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 console.log(JSON.stringify(await checkPublicAssetVersions({write:process.argv.includes('--write')})));
}
