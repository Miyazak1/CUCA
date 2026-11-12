import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkPublicAssetVersions,publicAssetVersion} from '../scripts/public-asset-versions.mjs';

test('every static public script/style reference uses its actual content version',async()=>{
 const result=await checkPublicAssetVersions();assert.ok(result.references>200);
});
test('a source change invalidates a warm cache URL, with stable versions across checkout line endings',()=>{
 const previous='window.example = 1;\n',next='window.example = 2;\n';
 assert.notEqual(publicAssetVersion(previous),publicAssetVersion(next));
 assert.equal(publicAssetVersion(previous),publicAssetVersion(previous.replaceAll('\n','\r\n')));
});
test('SSR pages version the runtime and shell separately using the same checked manifest',async()=>{
 const shell=await readFile(new URL('../app/public-site-shell.tsx',import.meta.url),'utf8');
 assert.match(shell,/import assetVersions from "\.\.\/config\/public-asset-versions\.json"/);
 assert.match(shell,/i18n-runtime\.js\?v=\$\{I18N_RUNTIME_RELEASE\}/);
 assert.match(shell,/shared-shell\.js\?v=\$\{SHELL_RUNTIME_RELEASE\}/);
});
