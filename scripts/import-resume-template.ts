import {readFileSync} from "node:fs";
import {loadConfig} from "../src/config.js";
import {openDatabase} from "../src/persistence/database.js";
import {WorkspaceService} from "../src/application/workspace-service.js";
import {inspectResumeTemplate} from "../src/application/resume-export.js";

const [path,sourceUrl]=process.argv.slice(2);
if(!path||!sourceUrl||process.argv.length!==4)throw new Error("Usage: import-resume-template <private-template.docx> <Drive-source-url>");
const content=await inspectResumeTemplate(path);
const config=loadConfig(),db=openDatabase(config.databasePath,config.migrationsDirectory);
try{
  const service=new WorkspaceService(db,config.developmentPrincipal);service.resolveDevelopmentIdentity();
  const saved=service.resumeService.initialize(readFileSync(path),content,sourceUrl);
  if(JSON.stringify(saved)!==JSON.stringify(service.resumeService.get()))throw new Error("Resume readback failed");
  console.log(JSON.stringify({status:"PASS",version:saved.recordVersion,projects:saved.content.projects.length,skills:saved.content.skills.length}));
}finally{db.close();}
