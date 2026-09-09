import {readFileSync} from "node:fs";
import {z} from "zod";
import {loadConfig} from "../src/config.js";
import {openDatabase} from "../src/persistence/database.js";
import {WorkspaceService} from "../src/application/workspace-service.js";
import {libraryInputSchema} from "../src/application/job-library-service.js";

// Explicit CLI import of a private artifact; never embeds source documents in Git.
const path=process.argv[2];
if(!path||process.argv.length!==3)throw new Error("Usage: import-job-library <private-source-json>");
const inputs=z.array(libraryInputSchema).min(1).max(250).parse(JSON.parse(readFileSync(path,"utf8")));
if(new Set(inputs.map(i=>i.sourceKey)).size!==inputs.length)throw new Error("Duplicate source keys");
const config=loadConfig(),db=openDatabase(config.databasePath,config.migrationsDirectory);
try{
  const service=new WorkspaceService(db,config.developmentPrincipal);
  service.resolveDevelopmentIdentity();
  const result=db.transaction(()=>inputs.map(input=>service.jobLibraryService.saveSource(input)))();
  const sources=service.jobLibraryService.sources();
  for(const input of inputs){const stored=sources.find(s=>s.source_key===input.sourceKey);
    if(!stored||stored.content!==input.content||stored.title!==input.title||stored.source_url!==input.sourceUrl)throw new Error("Import readback mismatch");}
  console.log(JSON.stringify({imported:result.length,totalSources:sources.length,confirmed:sources.filter(s=>s.review_status==="CONFIRMED").length,status:"PASS"}));
}finally{db.close();}
