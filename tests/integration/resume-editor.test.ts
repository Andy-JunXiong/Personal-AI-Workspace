import {expect,it} from "vitest";
import {WorkspaceService} from "../../src/application/workspace-service.js";
import {createEmptyTestWorkspace,testPrincipal} from "../helpers/test-workspace.js";
import {resumeFixture} from "../helpers/resume-fixture.js";
import {resumeView} from "../../src/web/resume-view.js";
import {copyFileSync,mkdirSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {openDatabase} from "../../src/persistence/database.js";
import {verifyResumeMigration} from "../../scripts/verify-resume-migration.js";
import {resumeSections} from "../../src/domain/resume-document.js";

it("retains section and item order across saves, reload and export while previews stay read-only",()=>{
  const w=createEmptyTestWorkspace({fileBacked:true});
  try{
    const s=w.service.resumeService,c=resumeFixture();
    s.initialize(Buffer.from("PKsynthetic"),c,"https://drive.google.com/file/d/example/view");
    expect(s.get()?.content.sectionOrder).toBeUndefined();
    const reordered={...c,sectionOrder:[...resumeSections].reverse(),skills:[...c.skills].reverse(),projects:[...c.projects].reverse(),
      experience:[{...c.experience[0]!,title:"Second"},...c.experience],certifications:["Second certification",...c.certifications],
      education:[{...c.education[0]!,school:"Second school"},...c.education]};
    expect(s.previewSnapshot(1,reordered).content).toEqual(reordered);
    expect(s.get()?.recordVersion).toBe(1);
    expect(s.get()?.content).toEqual(c);
    expect(s.save({expectedVersion:1,content:reordered}).recordVersion).toBe(2);
    const reloaded=new WorkspaceService(w.database,testPrincipal).resumeService;
    expect(reloaded.get()?.content).toEqual(reordered);
    expect(reloaded.exportSnapshot(2).content).toEqual(reordered);
    expect(reloaded.save({expectedVersion:2,content:reordered}).recordVersion).toBe(2);
    const html=resumeView(w.service);
    expect([...html.matchAll(/data-resume-section="([^"]+)"/gu)].map(m=>m[1])).toEqual(reordered.sectionOrder);
    for(const bad of [resumeSections.slice(1),[...resumeSections,"name"],[...resumeSections.slice(1),"headline"],[...resumeSections.slice(1),"unknown"]]){
      expect(()=>s.save({expectedVersion:2,content:{...reordered,sectionOrder:bad}})).toThrow();
    }
    expect(s.get()?.recordVersion).toBe(2);
    const restored={...reordered,sectionOrder:[...resumeSections],projects:c.projects};
    expect(s.save({expectedVersion:2,content:restored}).content).toEqual(restored);
    expect(s.get()?.recordVersion).toBe(3);
    expect(s.save({expectedVersion:3,content:{...c,summary:"Older editor tab"}}).content.sectionOrder).toEqual(resumeSections);
  }finally{w.cleanup();}
});

it("adds resume storage while preserving all existing tables and survives repeat/older starts",()=>{
  const w=createEmptyTestWorkspace();
  try{
    const old=join(w.directory,"migrations015");mkdirSync(old);
    for(const file of readdirSync("db/migrations").filter(f=>f.endsWith(".sql")&&f<"016_"))copyFileSync(join("db/migrations",file),join(old,file));
    const before=join(w.directory,"before.db"),after=join(w.directory,"after.db");
    const db=openDatabase(before,old);new WorkspaceService(db,{issuer:"migration",subject:"retained",workspaceName:"Retained"}).ensureDevelopmentIdentity();db.close();
    copyFileSync(before,after);openDatabase(after).close();openDatabase(after).close();openDatabase(after,old).close();
    expect(verifyResumeMigration(before,after)).toMatchObject({status:"PASS",addedTables:["resume_documents"]});
  }finally{w.cleanup();}
});

it("persists an owner-scoped resume, rejects stale edits and fixes identity without altering applications",()=>{
  const w=createEmptyTestWorkspace({fileBacked:true});
  try{
    const s=w.service.resumeService,c=resumeFixture();
    expect(s.get()).toBeNull();
    s.initialize(Buffer.from("PKsynthetic"),c,"https://drive.google.com/file/d/example/view");
    expect(()=>s.initialize(Buffer.from("PKsynthetic"),c,"https://drive.google.com/file/d/example/view")).toThrow(/initialized/);
    expect(s.save({expectedVersion:1,content:c}).recordVersion).toBe(1);
    const preview=s.previewSnapshot(1,{...c,summary:"Unsaved preview"});
    expect(preview.content.summary).toBe("Unsaved preview");
    expect(s.get()?.content.summary).toBe(c.summary);
    expect(s.get()?.recordVersion).toBe(1);
    expect(()=>s.previewSnapshot(1,{...c,name:"Changed identity"})).toThrow(/fixed/);
    expect(()=>s.save({expectedVersion:1,content:{...c,name:"Impersonation"}})).toThrow(/fixed/);
    expect(()=>s.save({expectedVersion:1,content:{...c,contact:"Replacement"}})).toThrow(/fixed/);
    const updated={...c,summary:"Edited summary",projects:[...c.projects,{...c.projects[0]!,name:"Fourth"},{...c.projects[0]!,name:"Fifth"}]};
    expect(s.save({expectedVersion:1,content:updated}).recordVersion).toBe(2);
    expect(()=>s.save({expectedVersion:1,content:c})).toThrow(/another window/);
    expect(()=>s.exportSnapshot(1)).toThrow(/reload/);
    expect(s.exportSnapshot(2).content.projects).toHaveLength(5);
    const other=new WorkspaceService(w.database,{issuer:"other",subject:"other",workspaceName:"Other"});other.ensureDevelopmentIdentity();
    expect(other.resumeService.get()).toBeNull();expect(()=>other.resumeService.save({expectedVersion:2,content:c})).toThrow();
    expect(w.database.prepare("SELECT COUNT(*) n FROM projects").get()).toEqual({n:0});
    expect(w.database.prepare("SELECT COUNT(*) n FROM tasks").get()).toEqual({n:0});
    expect(()=>s.save({expectedVersion:2,content:{...updated,projects:[...updated.projects,updated.projects[0]]}})).toThrow();
    expect(()=>s.save({expectedVersion:2,content:{...updated,skills:c.skills.slice(1)}})).toThrow();
    expect(()=>s.save({expectedVersion:2,content:{...updated,projects:[{...c.projects[0],demo:"javascript:alert(1)"},...c.projects.slice(1)]}})).toThrow();
    const html=resumeView(w.service);expect(html).toContain('data-project="4"');expect(html).toContain('id="region-9"');
    s.save({expectedVersion:2,content:{...updated,summary:'<script>alert("x")</script>'}});
    expect(resumeView(w.service)).toContain('&lt;script&gt;');expect(resumeView(w.service)).not.toContain('<script>alert(');
  }finally{w.cleanup();}
});
