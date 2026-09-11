import { afterEach, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";
import { seedCandidateAssessmentViews } from "../helpers/candidate-assessment-fixture.js";
import { candidateListView, candidateView } from "../../src/web/views.js";
import { createJobSearchPageRouter } from "../../src/web/page-router.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const close of cleanups.splice(0).reverse()) close(); });
function setup() {
  const w = createEmptyTestWorkspace(); cleanups.push(w.cleanup);
  return { ...w, ...seedCandidateAssessmentViews(w.service) };
}
const zone = "Australia/Sydney", now = "2026-09-11T08:00:00Z";

it("shows authoritative current/missing/stale/unassessed states without a model provider or read writes", () => {
  const w = setup(), before = w.database.prepare("SELECT total_changes() n").get();
  const html = candidateListView(w.service, {}, zone, false);
  for (const state of ["CURRENT", "STALE", "MISSING_JD", "UNASSESSED"]) expect(html).toContain(`data-assessment-status="${state}"`);
  expect(html).toContain("A · 匹配评级"); expect(html).toContain("JD 已更新");
  expect(html).not.toContain("B+ · 匹配评级"); expect(html).not.toContain("历史评级 A");
  expect(html).not.toContain("data-library-compare");
  expect(html).toContain('value="UPDATED_DESC" selected');
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("renders citations, exact source versions, user corrections and bounded historical reports", () => {
  const w = setup(), before = w.database.prepare("SELECT total_changes() n").get();
  const current = candidateView(w.service, w.current.id, zone, now);
  expect(current).toContain("岗位要求与经历对照"); expect(current).toContain("经历证据"); expect(current).toContain("评估判断");
  expect(current).toContain("Built Python APIs and automated tests."); expect(current).toContain("基础简历 · 版本 1");
  expect(current).toContain("你的纠正"); expect(current).toContain("证据待补充");
  expect(current).toContain(`assessmentVersion=12&amp;historyBeforeVersion=3`); // URL escaped in HTML below.
  const old = candidateView(w.service, w.current.id, zone, now, false, false, { assessmentVersion: 1, historyBeforeVersion: 3 });
  expect(old).toContain("历史评级 B+"); expect(old).toContain("返回最新评估"); expect(old).toContain("最近记录");
  expect(old).not.toContain("你的纠正");
  const stale = candidateView(w.service, w.stale.id, zone, now);
  expect(stale).toContain("待重新评估"); expect(stale).toContain("历史评级 A"); expect(stale).not.toContain("A · 匹配评级");
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("escapes stored model/source text and never turns untrusted source schemes into links", () => {
  const w = setup(), input = w.request(w.current.id);
  input.report.reason = '<script>alert("model")</script>';
  input.report.provenance.reference = '<img src=x onerror=alert("provenance")>';
  w.service.candidateAssessmentService.record(input);
  const html = candidateView(w.service, w.current.id, zone, now);
  expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain('<script>alert("model")');
  expect(html).toContain("&lt;img src=x"); expect(html).not.toContain('<img src=x');
  w.service.jobLibraryService.saveSource({ sourceKey: "synthetic:assessment-ui", title: "Case<script>.docx", sourceUrl: "javascript:alert(1)", content: "Built Python APIs and automated tests.", reviewStatus: "SOURCE", expectedVersion: 1 });
  w.service.candidateAssessmentService.record(w.request(w.current.id));
  const unsafe = candidateView(w.service, w.current.id, zone, now);
  expect(unsafe).toContain("Case&lt;script&gt;.docx"); expect(unsafe).not.toContain('href="javascript:');
});

it("accepts only bounded version/history page parameters and rejects missing or foreign versions", async () => {
  const w = setup(), app = express();
  app.use(createJobSearchPageRouter(() => w.service));
  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No port");
  const base = `http://127.0.0.1:${address.port}/workspace/job-search/jobs/${w.current.id}`;
  try {
    expect((await fetch(`${base}?assessmentVersion=1&historyBeforeVersion=3`)).status).toBe(200);
    expect((await fetch(`${base}?assessmentVersion=99`)).status).toBe(404);
    for (const query of ["assessmentVersion=-1", "assessmentVersion=0", "assessmentVersion=1.5", "assessmentVersion=no", "assessmentVersion=1&assessmentVersion=2", "historyBeforeVersion=0", "workspaceId=other", "sourceIds=other"]) {
      expect((await fetch(`${base}?${query}`)).status, query).toBe(400);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
