import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertLocalDevelopmentState, localDatabaseUrl, type LocalDevelopmentState } from "./lib/local-development.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { prepareSeedSchoolLogos, type SchoolLogoDescriptor } from "../src/server/catalog/school-logo-import.ts";
import { writeSchoolLogo } from "../src/server/catalog/school-logo.ts";

const args = process.argv.slice(2), apply = args.includes("--apply");
if (args.some(arg => arg.startsWith("--") && arg !== "--apply")) throw new Error("Unknown option.");
const manifestPath = resolve(args.find(arg => !arg.startsWith("--")) || "seeds/school-logos.official-20261121.json");
const manifest = JSON.parse(await readFile(manifestPath,"utf8")) as { schools: { slug: string; logo: SchoolLogoDescriptor }[] };
if (!Array.isArray(manifest.schools) || manifest.schools.length > 1000) throw new Error("Invalid school logo manifest.");
const logos = await prepareSeedSchoolLogos(manifest.schools,process.cwd());
const state: unknown = JSON.parse(await readFile(".cuac-local/runtime.json","utf8"));
assertLocalDevelopmentState(state);
const local = state as LocalDevelopmentState;
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(local),max:1,applicationName:"cuac:local-school-logos" });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async tx => {
    const identity=await tx.query<{ name:string; user:string }>("select current_database() as name,current_user as user",[]);
    if(identity[0]?.name!==local.databaseName || identity[0]?.user!==local.databaseUser)throw new Error("Unexpected local database identity.");
    const results=[];
    for(const entry of manifest.schools){
      const rows=await tx.query<{id:string}>("select id from schools where slug=$1 and status<>'archived'",[entry.slug]);
      if(!rows[0])throw new Error(`School not found: ${entry.slug}`);
      const logo=logos.get(entry.slug);
      if(!logo)throw new Error("Missing prepared logo.");
      const current=await tx.query<{version:number}>("select version from school_logo_versions where school_id=$1 order by version desc limit 1",[rows[0].id]);
      const outcome=apply?await writeSchoolLogo(tx,rows[0].id,0,logo,null,true):{skipped:current.length>0,version:current[0]?.version??0};
      results.push({schoolId:rows[0].id,slug:entry.slug,sha256:logo.sha256,...outcome});
    }
    return results;
  });
  console.log(JSON.stringify({localOnly:true,applied:apply,results:result},null,2));
} finally { await pool.end(); }
