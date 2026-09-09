import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { applicationMailEvent } from "../../src/domain/application-mail-event.js";
import { isApplicationEvidence } from "../../src/gmail/providers.js";

it("shows application milestones without check receipts, marketing, registration duplicates or task administration", () => {
  const w = createTestWorkspace();
  try {
    w.database.prepare("UPDATE projects SET metadata_json=json_set(metadata_json,'$.appliedDate','2026-09-01') WHERE id=?").run(w.projectId);
    const project = w.service.getProject(w.projectId).project;
    const base = { projectId: w.projectId, provider: "gmail", resourceType: "EMAIL", externalId: randomUUID(),
      externalUri: null, title: "Legacy generic title", observedAt: "2026-09-02T00:00:00Z", idempotencyKey: randomUUID() };
    const facts = (summary: string, category?: string) => ({ contractVersion: "gmail-job-observation-v0.1",
      sourceFacts: { receivedAt: "2026-09-02T00:00:00Z" }, interpretation: {
        company: String(project.metadata.company), role: String(project.metadata.role), emailKind: "OTHER", summary, ...(category ? {category} : {}) } });
    const receipt = w.service.recordObservation({ ...base, observedFacts: facts("申请已收到") });
    for (const category of ["INTERVIEW", "OFFER", "REJECTION", "ACTION_REQUEST"]) {
      w.service.recordObservation({ ...base, externalId: randomUUID(), idempotencyKey: randomUUID(), observedFacts: facts(`Specific ${category} development`, category) });
    }
    // Historical records retain their original content; projection filters them.
    for (const summary of ["推荐该公司职位，提供竞争性薪酬", "职位仍然开放申请", "包含该公司招聘信息", "Unclassified generic information"]) {
      const resource = w.service.recordObservation({ ...base, externalId: randomUUID(), idempotencyKey: randomUUID(), observedFacts: facts("Legacy import") }).resource;
      w.database.prepare("UPDATE resources SET observed_facts_json=? WHERE id=?").run(JSON.stringify(facts(summary)),resource.id);
    }
    w.service.recordObservation({ ...base, externalId: randomUUID(), idempotencyKey: randomUUID(), observedFacts: {
      ...facts("Received your application", "APPLICATION_CONFIRMATION"), interpretation: { ...facts("Received your application", "APPLICATION_CONFIRMATION").interpretation, role: "Different role" } } });
    for (const status of ["NO_UPDATE", "PARTIAL", "FAILED", "UPDATED"]) w.service.recordObservation({ ...base,
      provider: "workspace-gmail-check", resourceType: "NOTE", externalId: randomUUID(), idempotencyKey: randomUUID(),
      observedFacts: { contractVersion: "gmail-application-check-v0.1", status, summary: "Operational receipt", searchScope: "Synthetic", matchedMessageCount: 0 } });
    w.service.taskService.createTask({ projectId: w.projectId, title: "Administrative reminder", priority: "LOW", taskKind: "OTHER",
      dueAt: null, authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic" }, idempotencyKey: randomUUID() });
    const before = w.database.prepare("SELECT total_changes() AS n").get();
    const first = w.service.jobSearchQueryService.listTimeline(w.projectId, {pageSize: 2});
    expect(first.totalCount).toBe(6);
    const all = [...first.items];
    let cursor = first.nextCursor;
    while (cursor) {
      const next = w.service.jobSearchQueryService.listTimeline(w.projectId, {pageSize: 2, cursor});
      all.push(...next.items); cursor = next.nextCursor;
    }
    expect(all.filter(e => e.kind === "APPLICATION")).toHaveLength(1);
    expect(all.some(e => e.id === `resource:${receipt.resource.id}`)).toBe(true);
    expect(all.map(e => e.title)).toEqual(expect.arrayContaining(["申请已收到", "面试安排", "录用通知 / Offer", "申请未通过", "招聘方请求"]));
    expect(all.every(e => ["APPLICATION", "EMAIL"].includes(e.kind))).toBe(true);
    expect(w.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
    expect(w.database.prepare("SELECT COUNT(*) n FROM resources WHERE provider='workspace-gmail-check'").get()).toEqual({n:4});
  } finally {w.cleanup();}
});

it("blocks future advertisements and persists meaningful classifications without requiring a lifecycle mutation", () => {
  const w = createTestWorkspace();
  try {
    const observation = (summary: string, category?: string) => ({ projectId: w.projectId, provider: "gmail", resourceType: "EMAIL",
      externalId: randomUUID(), externalUri: null, title: "Update", observedAt: "2026-09-02T00:00:00Z", idempotencyKey: randomUUID(),
      observedFacts: { contractVersion: "gmail-job-observation-v0.1", sourceFacts: { receivedAt: "2026-09-02T00:00:00Z" },
        interpretation: { company: "Example", role: "Engineer", emailKind: "OTHER", summary, ...(category ? {category} : {}) } } });
    for (const category of ["JOB_ADVERTISEMENT", "UNRELATED", "UNCERTAIN", "invented"]) expect(() => w.service.recordObservation(observation("Generic", category))).toThrow();
    expect(() => w.service.recordObservation(observation("职位仍然开放申请"))).toThrow();
    const accepted = w.service.recordObservation(observation("申请已收到", "APPLICATION_CONFIRMATION"));
    expect(accepted.resource.observedFacts.interpretation).toHaveProperty("category", "APPLICATION_CONFIRMATION");
    expect(accepted.projectStateChanged).toBe(false);
    expect(isApplicationEvidence({ messageId: "1", relevant: true, category: "APPLICATION_UPDATE", summary: "推荐该公司职位", evidenceQuote: "recommended jobs", requiresAction: false })).toBe(false);
  } finally {w.cleanup();}
});

it("requires exact application relevance and positive legacy evidence, while preserving useful recruiter requests", () => {
  const facts = (summary: string, category?: string) => ({ contractVersion: "gmail-job-observation-v0.1", sourceFacts: {},
    interpretation: {company:"Example",role:"Engineer",summary,...(category ? {category} : {})} });
  expect(applicationMailEvent(facts("Recruiter requested an initial conversation."), "Example", "Engineer")?.title).toBe("招聘方请求");
  expect(applicationMailEvent(facts("Application receipt confirmed."), "Example", "Engineer")?.title).toBe("申请已收到");
  expect(applicationMailEvent(facts("确认收到 Example Company — Senior Software Engineer 的申请。"), "Example", "Engineer")?.title).toBe("申请已收到");
  expect(applicationMailEvent(facts("申请状态变为 In progress。邮件未说明面试、录用或需要回复的事项。"), "Example", "Engineer")?.title).toBe("申请进展");
  expect(applicationMailEvent(facts("提醒该公司职位依然开放申请。", "APPLICATION_UPDATE"), "Example", "Engineer")).toBeNull();
  expect(applicationMailEvent(facts("面试邀请"), "Example", "Another role")).toBeNull();
  expect(applicationMailEvent(facts("面试技巧分享"), "Example", "Engineer")).toBeNull();
  expect(applicationMailEvent(facts("Received your application", "UNRELATED"), "Example", "Engineer")).toBeNull();
});
