import { serviceUnavailable } from "../../shared/errors.ts";

export type DataRightsReminderWorkerConfiguration={pollIntervalMs:number;batchSize:number};
export type DataRightsReminderScheduler={processBatch(limit:number):Promise<{processed:number;created:number}>};

export function dataRightsReminderWorkerConfigFromEnv(
  env:Record<string,string|undefined>=process.env):DataRightsReminderWorkerConfiguration{
  return{
    pollIntervalMs:boundedInteger(env.CUAC_DATA_RIGHTS_REMINDER_POLL_MS,1_000,300_000,60_000),
    batchSize:boundedInteger(env.CUAC_DATA_RIGHTS_REMINDER_BATCH_SIZE,1,100,100),
  };
}

export async function runDataRightsReminderWorker(input:{scheduler:DataRightsReminderScheduler;
  config:DataRightsReminderWorkerConfiguration;signal:AbortSignal},dependencies:{
    wait?:(milliseconds:number,signal:AbortSignal)=>Promise<void>;
    onBatch?:(result:{processed:number;created:number})=>void;
  }={}):Promise<{passes:number;processed:number;created:number}>{
  const wait=dependencies.wait??waitForSignal;
  const summary={passes:0,processed:0,created:0};
  while(!input.signal.aborted){
    const result=await input.scheduler.processBatch(input.config.batchSize);
    summary.passes+=1;summary.processed+=result.processed;summary.created+=result.created;
    dependencies.onBatch?.(result);
    if(!input.signal.aborted)await wait(result.processed===input.config.batchSize?1_000:input.config.pollIntervalMs,input.signal);
  }
  return summary;
}

function boundedInteger(value:string|undefined,minimum:number,maximum:number,fallback:number){
  if(value===undefined||value==="")return fallback;
  if(!/^\d+$/.test(value))throw serviceUnavailable("Data-rights reminder worker timing is invalid.");
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<minimum||parsed>maximum)
    throw serviceUnavailable("Data-rights reminder worker timing is invalid.");
  return parsed;
}

function waitForSignal(milliseconds:number,signal:AbortSignal):Promise<void>{
  if(signal.aborted)return Promise.resolve();
  return new Promise(resolve=>{
    const timeout=setTimeout(done,milliseconds);
    signal.addEventListener("abort",done,{once:true});
    function done(){clearTimeout(timeout);signal.removeEventListener("abort",done);resolve();}
  });
}
