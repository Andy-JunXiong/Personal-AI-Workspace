import {expect,it} from "vitest";
import {randomUUID} from "node:crypto";
import {copyFileSync,mkdirSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {createTestWorkspace,testPrincipal} from "../helpers/test-workspace.js";
import {resumeFixture} from "../helpers/resume-fixture.js";
import {WorkspaceService} from "../../src/application/workspace-service.js";
import {resumeSections} from "../../src/domain/resume-document.js";
import {resumeView} from "../../src/web/resume-view.js";
import {applicationView,candidateView} from "../../src/web/views.js";
import {openDatabase} from "../../src/persistence/database.js";
import {verifyResumeVariantsMigration} from "../../scripts/verify-resume-variants-migration.js";

it("keeps named application/candidate copies independent through persistence, order, previews and export",()=>{
  const w=createTestWorkspace({fileBacked:true});
  try{
    const service=w.service.resumeService,content={...resumeFixture(),sectionOrder:[...resumeSections].reverse()};
    service.initialize(Buffer.from("PKsynthetic"),content,"https://drive.google.com/file/d/example/view");
    const {preparationContext:_beforePreparation,...projectBefore}=w.service.getProject(w.projectId),tasksBefore=w.database.prepare("SELECT * FROM tasks").all();
    const candidate=w.service.candidateService.recordCandidate({provider:"seek",postingId:"variant",company:"Nuix",title:"Engineer",role:"Engineer",authority:{type:"EXPLICIT_USER_DEV",confirmed:true,reference:"Test"},idempotencyKey:randomUUID()}).candidate;
    const input={name:"Nuix AI",targetType:"APPLICATION",targetId:w.projectId,expectedBaseVersion:1,intentKey:randomUUID()};
    const first=service.createVariant(input),id=first.variant!.id;
    const second=service.createVariant({...input,name:"Nuix Alternate",targetType:"CANDIDATE",targetId:candidate.id,intentKey:randomUUID()});
    expect(first.content).toEqual(content);expect(first.variant?.sourceBaseVersion).toBe(1);
    service.save({expectedVersion:1,content:{...content,summary:"Base later"}});
    const edited={...content,summary:"Only for this application",projects:[...content.projects].reverse()};
    expect(service.save({expectedVersion:1,content:edited},id).recordVersion).toBe(2);
    expect(service.createVariant(input)).toEqual(first);
    expect(service.listVariants()).toHaveLength(2);
    expect(service.get()?.content.summary).toBe("Base later");
    expect(service.get(second.variant!.id)?.content).toEqual(content);
    const reloaded=new WorkspaceService(w.database,testPrincipal).resumeService;
    expect(reloaded.get(id)?.content).toEqual(edited);
    expect(reloaded.exportSnapshot(2,id)).toMatchObject({content:edited,name:"Nuix AI"});
    expect(reloaded.previewSnapshot(2,{...edited,summary:"Draft preview"},id).content.summary).toBe("Draft preview");
    expect(reloaded.get(id)?.content.summary).toBe(edited.summary);
    expect(()=>reloaded.save({expectedVersion:1,content},id)).toThrow(/another window/);
    expect(()=>reloaded.exportSnapshot(1,id)).toThrow(/reload/);
    expect(()=>reloaded.save({expectedVersion:2,content:{...edited,name:"Changed"}},id)).toThrow(/fixed/);
    const {preparationContext,...projectAfter}=w.service.getProject(w.projectId);
    expect(projectAfter).toEqual(projectBefore);expect(preparationContext?.workingResume.selected).toMatchObject({id,recordVersion:2});
    expect(w.database.prepare("SELECT * FROM tasks").all()).toEqual(tasksBefore);
    const html=resumeView(w.service,id);expect(html).toContain(`data-api-path="/variants/${id}"`);expect(html).toContain('data-filename="Nuix AI"');
    expect(html).toContain("Only for this application");expect(html).toContain("来自基础简历版本 1");
    expect(applicationView(w.service,w.projectId,{},"Australia/Sydney")).toContain(`/resume/variants/${id}`);
    const candidatePage=candidateView(w.service,candidate.id,"Australia/Sydney",new Date().toISOString());
    expect(candidatePage).toContain(`/resume/variants/${second.variant!.id}`);
    expect(candidatePage).toContain("为这个职位准备的简历");
  }finally{w.cleanup();}
});

it("rejects cross-workspace reads/targets/writes, stale copies, duplicate names and changed retry intent",()=>{
  const w=createTestWorkspace();
  try{
    const s=w.service.resumeService,c=resumeFixture();s.initialize(Buffer.from("PKtest"),c,"https://drive.google.com/file/d/example/view");
    const input={name:'<script>Job</script>',targetType:"APPLICATION",targetId:w.projectId,expectedBaseVersion:1,intentKey:randomUUID()};
    const saved=s.createVariant(input),id=saved.variant!.id;
    expect(()=>s.createVariant({...input,name:"Changed"})).toThrow(/request changed/);
    expect(()=>s.createVariant({...input,intentKey:randomUUID(),name:'<SCRIPT>JOB</SCRIPT>'})).toThrow(/name already/);
    expect(()=>s.createVariant({...input,intentKey:randomUUID(),expectedBaseVersion:8})).toThrow(/Base resume changed/);
    const other=new WorkspaceService(w.database,{issuer:"other",subject:"other-variant",workspaceName:"Other"});other.ensureDevelopmentIdentity();
    other.resumeService.initialize(Buffer.from("PKother"),c,"https://drive.google.com/file/d/example/view");
    expect(other.resumeService.listVariants()).toEqual([]);expect(other.resumeService.targets().applications).toEqual([]);
    expect(()=>other.resumeService.createVariant(input)).toThrow(/target not found/);
    expect(()=>other.resumeService.get(id)).toThrow(/not found/);
    expect(()=>other.resumeService.save({expectedVersion:1,content:c},id)).toThrow(/not found/);
    expect(()=>other.resumeService.exportSnapshot(1,id)).toThrow(/not found/);
    expect(resumeView(w.service,id)).not.toContain('<script>Job</script>');
    expect(s.listVariants()).toHaveLength(1);
  }finally{w.cleanup();}
});

it("migration 018 preserves all prior data including the private base resume and permits old-reader restart",()=>{
  const w=createTestWorkspace();
  try{
    const old=join(w.directory,"old");mkdirSync(old);
    for(const f of readdirSync("db/migrations").filter(f=>f.endsWith(".sql")&&f<"018_"))copyFileSync(join("db/migrations",f),join(old,f));
    const before=join(w.directory,"before.db"),after=join(w.directory,"after.db");
    const db=openDatabase(before,old),service=new WorkspaceService(db,testPrincipal);service.ensureDevelopmentIdentity();
    service.resumeService.initialize(Buffer.from("PKretained"),resumeFixture(),"https://drive.google.com/file/d/example/view");db.close();
    copyFileSync(before,after);openDatabase(after).close();openDatabase(after).close();openDatabase(after,old).close();
    expect(verifyResumeVariantsMigration(before,after)).toMatchObject({status:"PASS",addedTables:["resume_variants"]});
  }finally{w.cleanup();}
});
