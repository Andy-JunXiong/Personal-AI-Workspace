import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { applicationView } from "../../src/web/views.js";

it("reads a saved JD/comparison beyond recent resources and displays gaps without claiming a submitted resume", () => {
  const w = createTestWorkspace();
  try {
    w.database.prepare("UPDATE projects SET metadata_json=json_set(metadata_json,'$.postingReference',?) WHERE id=?")
      .run("https://example.test/jobs/123", w.projectId);
    const facts = {contractVersion:"job-application-profile-v0.1",jobDescription:"Build reliable SQL pipelines.",
      sourceReference:"Posting https://example.test/jobs/123; candidate resume file/revision still to be confirmed",
      skillMatch:{summary:"Comparison with supplied experience",matches:[{requirement:"SQL pipelines",evidence:"User supplied SQL project",
        assessment:"PARTIAL",gap:"Confirm production scale <script>unsafe</script>"}],gaps:["Production scale evidence needed"]}};
    const profile=w.service.recordObservation({projectId:w.projectId,provider:"chatgpt",resourceType:"NOTE",externalUri:null,title:"Synthetic dossier",externalId:randomUUID(),
      observedAt:"2026-09-09T09:00:00Z",observedFacts:facts,idempotencyKey:randomUUID()});
    for(let i=0;i<12;i++) w.service.recordObservation({projectId:w.projectId,provider:"chatgpt",resourceType:"NOTE",externalUri:null,title:"Synthetic dossier",externalId:randomUUID(),
      observedAt:"2026-09-09T09:00:00Z",observedFacts:{summary:"Later unrelated note"},idempotencyKey:randomUUID()});
    const before=w.database.prepare("SELECT total_changes() n").get();
    const project=w.service.getProject(w.projectId);
    expect(project.resources.some(r=>r.id===profile.resource.id)).toBe(false);
    expect(project.applicationProfile?.saved?.facts).toEqual(facts);
    const html=applicationView(w.service,w.projectId,{},"Australia/Sydney");
    expect(html).toContain("3 / 4 已齐备");
    expect(html).toContain("待关联");
    expect(html).toContain("岗位要求与技能对照");
    expect(html).toContain("差距 / 待补证据");
    expect(html).toContain("Confirm production scale &lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe</script>");
    expect(html).toContain('id="application-jd"');
    expect(html).toContain('id="application-skills"');
    expect(html).toContain('id="application-resume"');
    expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
  } finally {w.cleanup();}
});
