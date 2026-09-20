import type pg from "pg";

Object.assign(process.env,{NODE_ENV:"production"});

const controller=new AbortController();
const stop=()=>controller.abort();
process.once("SIGINT",stop);
process.once("SIGTERM",stop);

let pool:pg.Pool|undefined;
try{
  const{authorizeWorkerStartup}=await import("./lib/worker-startup.ts");
  const authorization=await authorizeWorkerStartup(process.argv.slice(2));
  const{createPostgresPool,createTransactionalSqlClient}=await import("../src/server/db/postgres-client.ts");
  const{PostgresDataRightsReminderScheduler}=await import("../src/server/data-rights/reminders.ts");
  const{dataRightsReminderWorkerConfigFromEnv,runDataRightsReminderWorker}=
    await import("../src/server/data-rights/runtime/reminder-worker.ts");
  const config=dataRightsReminderWorkerConfigFromEnv();
  pool=createPostgresPool({applicationName:"cuac:data-rights-reminder-worker",max:4});
  const scheduler=new PostgresDataRightsReminderScheduler(createTransactionalSqlClient(pool));
  console.log(JSON.stringify({event:"data_rights_reminder_worker.started",releaseGate:authorization.mode}));
  const summary=await runDataRightsReminderWorker({scheduler,config,signal:controller.signal},{
    onBatch(result){if(result.processed>0)console.log(JSON.stringify({event:"data_rights_reminder_worker.batch",...result}));},
  });
  console.log(JSON.stringify({event:"data_rights_reminder_worker.stopped",...summary}));
}catch{
  console.error("Data-rights reminder worker failed. Check protected database configuration and service health.");
  process.exitCode=1;
}finally{
  process.removeListener("SIGINT",stop);
  process.removeListener("SIGTERM",stop);
  try{await pool?.end();}catch{process.exitCode=1;}
}

export{};
