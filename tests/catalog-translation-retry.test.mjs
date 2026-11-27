import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogTranslationRetryDelay,catalogTranslationResumeState} from '../scripts/lib/catalog-translation-retry.mjs';

test('persistent rate limits extend the cooldown through 30 minutes, one hour and two hours',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,8,18,99].map(n=>catalogTranslationRetryDelay(n,60,true)),[60000,120000,240000,480000,960000,1800000,3600000,7200000,7200000,7200000]);
});
test('provider Retry-After is respected even when longer than the local cap',()=>{
 assert.equal(catalogTranslationRetryDelay(1,900,true),900000);
 assert.equal(catalogTranslationRetryDelay(18,10800,true),10800000);
 assert.equal(catalogTranslationRetryDelay(3,60,false),180000);
});

test('a restart extends cooldown from the last provider response and preserves the retry count',()=>{
 const status={state:'rate-limited',retry:18,updatedAt:'2026-11-22T08:44:42.413Z',resumeAt:'2026-11-22T09:14:42.413Z'};
 const resumed=catalogTranslationResumeState(status);
 assert.equal(resumed.retry,18);assert.equal(resumed.notBefore,Date.parse('2026-11-22T10:44:42.413Z'));
 assert.deepEqual(catalogTranslationResumeState({...status,resumeAt:'2026-11-22T12:44:42.413Z'}),{retry:18,notBefore:Date.parse('2026-11-22T12:44:42.413Z')});
});

test('expired waits are not restarted from now, and corrupt persisted cooldowns are rejected',()=>{
 assert.equal(catalogTranslationResumeState({state:'candidate-complete'}),null);
 assert.equal(catalogTranslationResumeState({state:'rate-limited',retry:1,updatedAt:'2020-01-01T00:00:00Z',resumeAt:'2020-01-01T00:01:00Z'}).notBefore,Date.parse('2020-01-01T00:01:00Z'));
 assert.throws(()=>catalogTranslationResumeState({state:'rate-limited',retry:18,updatedAt:'bad',resumeAt:'bad'}),/Invalid persisted/);
});
