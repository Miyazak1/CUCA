import assert from "node:assert/strict";
import test from "node:test";
import{
  dataRightsReminderWorkerConfigFromEnv,
  runDataRightsReminderWorker,
}from"../../../src/server/data-rights/runtime/reminder-worker.ts";

test("data-rights reminder worker uses bounded production-safe scheduling",()=>{
  assert.deepEqual(dataRightsReminderWorkerConfigFromEnv({}),{pollIntervalMs:60_000,batchSize:100});
  assert.deepEqual(dataRightsReminderWorkerConfigFromEnv({CUAC_DATA_RIGHTS_REMINDER_POLL_MS:"1000",
    CUAC_DATA_RIGHTS_REMINDER_BATCH_SIZE:"1"}),{pollIntervalMs:1_000,batchSize:1});
  for(const env of [{CUAC_DATA_RIGHTS_REMINDER_POLL_MS:"999"},{CUAC_DATA_RIGHTS_REMINDER_POLL_MS:"x"},
    {CUAC_DATA_RIGHTS_REMINDER_BATCH_SIZE:"0"},{CUAC_DATA_RIGHTS_REMINDER_BATCH_SIZE:"101"}])
    assert.throws(()=>dataRightsReminderWorkerConfigFromEnv(env),/timing is invalid/);
});

test("data-rights reminder worker drains a bounded pass and stops through AbortSignal",async()=>{
  const controller=new AbortController(),calls=[],waits=[];
  const results=[{processed:2,created:2},{processed:0,created:0}];
  const summary=await runDataRightsReminderWorker({scheduler:{async processBatch(limit){calls.push(limit);return results.shift();}},
    config:{pollIntervalMs:60_000,batchSize:2},signal:controller.signal},{
    wait:async(milliseconds)=>{waits.push(milliseconds);if(waits.length===2)controller.abort();},
  });
  assert.deepEqual(calls,[2,2]);assert.deepEqual(waits,[1_000,60_000]);
  assert.deepEqual(summary,{passes:2,processed:2,created:2});
});

test("data-rights reminder worker propagates database failures",async()=>{
  await assert.rejects(runDataRightsReminderWorker({scheduler:{async processBatch(){throw new Error("database unavailable");}},
    config:{pollIntervalMs:60_000,batchSize:100},signal:new AbortController().signal}),/database unavailable/);
});
