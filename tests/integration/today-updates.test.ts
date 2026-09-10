import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { candidateListView, todayView } from "../../src/web/views.js";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";

const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic daily update regression" };
const create = (service: WorkspaceService, company: string) => {
  const result = service.createJobApplication({ company, role: "Engineer", authority, idempotencyKey: randomUUID() });
  if (result.creationStatus !== "CREATED") throw new Error("Expected synthetic application");
  return result.project.id;
};

describe("daily website updates", () => {
  it.each([
    ["2026-09-09T22:50:00.000Z", "2026-09-09T14:00:00.000Z", "2026-09-10"],
    ["2026-10-04T02:00:00.000Z", "2026-10-03T14:00:00.000Z", "2026-10-04"],
    ["2026-04-05T02:00:00.000Z", "2026-04-04T13:00:00.000Z", "2026-04-05"],
  ])("uses the Sydney recording day, including DST (%s)", (instant, midnight, day) => {
    const w = createEmptyTestWorkspace({ timeZone: "Australia/Sydney", clock: () => new Date(instant) });
    try {
      const ids = ["Yesterday", "Midnight", "Now", "Future"].map(name => create(w.service, name));
      const dates = [new Date(Date.parse(midnight) - 1).toISOString(), midnight, instant, new Date(Date.parse(instant) + 1).toISOString()];
      ids.forEach((id, i) => w.database.prepare("UPDATE state_transitions SET admitted_at=? WHERE project_id=?").run(dates[i], id));
      const result = w.service.todayQueryService.getDailyUpdates();
      expect(result.date).toBe(day);
      expect(result.items.map(item => item.company)).toEqual(["Now", "Midnight"]);
      expect(result.totalCount).toBe(2);
    } finally { w.cleanup(); }
  });

  it("shows closed applications and evidence-only recruiter requests, deduplicates admitted evidence, and never writes", () => {
    const instant = "2026-09-09T22:50:00.000Z";
    const w = createEmptyTestWorkspace({ clock: () => new Date(instant) });
    try {
      const closed = create(w.service, "<Closed>");
      const contacted = create(w.service, "Contacted");
      w.database.prepare("UPDATE state_transitions SET admitted_at='2026-09-08T00:00:00.000Z'").run();
      const mail = (projectId: string, company: string, category: string, summary: string) => w.service.recordObservation({
        projectId, resourceType: "EMAIL", provider: "gmail", externalId: randomUUID(), externalUri: null,
        title: "Synthetic mail", observedAt: "2026-09-08T00:00:00.000Z", idempotencyKey: randomUUID(),
        observedFacts: { contractVersion: "gmail-job-observation-v0.1", sourceFacts: { receivedAt: "2026-09-08T00:00:00.000Z" },
          interpretation: { company, role: "Engineer", emailKind: "OTHER", category, summary } },
      }).resource.id;
      const evidence = mail(closed, "<Closed>", "REJECTION", "Application declined");
      mail(contacted, "Contacted", "ACTION_REQUEST", "Please confirm your availability");
      mail(contacted, "Different company", "INTERVIEW", "Interview invitation");
      const proposal = w.service.proposeTransition({ projectId: closed, expectedLifecycleVersion: 1, toState: "REJECTED",
        triggerType: "USER_ASSERTION", evidenceResourceIds: [evidence], rationale: "Synthetic closure", idempotencyKey: randomUUID() });
      w.service.admitTransition({ transitionId: proposal.transition.id, expectedLifecycleVersion: 1, authority, idempotencyKey: randomUUID() });
      w.database.prepare("UPDATE state_transitions SET admitted_at=? WHERE id=?").run(instant, proposal.transition.id);
      w.database.prepare("UPDATE resources SET created_at=?").run(instant);
      const before = w.database.prepare("SELECT total_changes() n").get();
      const result = w.service.todayQueryService.getDailyUpdates();
      expect(result.totalCount).toBe(2);
      expect(result.items.find(item => item.projectId === closed)).toMatchObject({ lifecycleState: "REJECTED", events: [{ kind: "STATE", toState: "REJECTED" }] });
      expect(result.items.find(item => item.projectId === contacted)).toMatchObject({ lifecycleState: "APPLIED", events: [{ kind: "EMAIL", title: "招聘方请求" }] });
      const html = todayView(w.service, instant);
      expect(html).toContain("今天有 2 个申请更新");
      expect(html).toContain("已投递 → <strong>未通过</strong>");
      expect(html).toContain("&lt;Closed&gt;");
      expect(html.indexOf('id="daily-updates-title"')).toBeLessThan(html.indexOf('class="stat-grid"'));
      expect(html).toContain('<details class="today-tools">');
      expect(html).toContain("data-discover-jobs");
      expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
      const other = new WorkspaceService(w.database, { issuer: "test", subject: "other", workspaceName: "Other" }, { clock: () => new Date(instant) });
      other.ensureDevelopmentIdentity();
      expect(other.todayQueryService.getDailyUpdates()).toMatchObject({ items: [], totalCount: 0, newCandidateCount: 0 });
    } finally { w.cleanup(); }
  });

  it("counts beyond the old five-change limit and caps only displayed applications", () => {
    const instant = "2026-09-09T22:50:00.000Z";
    const w = createEmptyTestWorkspace({ clock: () => new Date(instant) });
    try {
      for (let i = 0; i < 21; i++) create(w.service, `Company ${i}`);
      w.database.prepare("UPDATE state_transitions SET admitted_at=?").run(instant);
      const updates = w.service.todayQueryService.getDailyUpdates();
      expect(updates.totalCount).toBe(21);
      expect(updates.items).toHaveLength(20);
    } finally { w.cleanup(); }
  });

  it("puts new candidate prompts on Today and keeps Jobs readable without changing stored notes", () => {
    const instant = "2026-09-09T22:50:00.000Z";
    const w = createEmptyTestWorkspace({ clock: () => new Date(instant) });
    try {
      const note = "来自 Job Alert；请打开原链接补充完整 JD。";
      const candidate = w.service.candidateService.recordCandidate({ provider: "seek", postingId: "daily-1", sourceUrl: "https://www.seek.com.au/job/1",
        title: "Senior Engineer", role: "Senior Engineer", company: "Acme", fitReason: note, authority, idempotencyKey: randomUUID() }).candidate;
      w.database.prepare("UPDATE job_candidates SET created_at=?").run(instant);
      const before = w.database.prepare("SELECT total_changes() n").get();
      expect(w.service.todayQueryService.getDailyUpdates().newCandidateCount).toBe(1);
      expect(todayView(w.service, instant)).toContain("个候选职位");
      const html = candidateListView(w.service, {}, "Australia/Sydney");
      expect(html).not.toContain("data-discover-jobs");
      expect(html).not.toContain(note);
      expect(html.match(/Senior Engineer/g)).toHaveLength(1);
      expect(html).toContain("JD 待补充");
      expect(w.database.prepare("SELECT fit_reason FROM job_candidates WHERE id=?").get(candidate.id)).toEqual({ fit_reason: note });
      expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
      w.service.jobLibraryService.saveDescription(candidate.id, "Synthetic saved JD", candidate.sourceUrl!);
      expect(candidateListView(w.service, {}, "Australia/Sydney")).toContain("JD 已保存");
    } finally { w.cleanup(); }
  });
});
