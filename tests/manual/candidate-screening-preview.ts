// Isolated, loopback-only synthetic UI acceptance. Never opens a user's database.
import express from "express";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";
import { seedCandidateScreening } from "../helpers/candidate-screening-fixture.js";
import { createJobSearchPageRouter, createWebAssetsRouter } from "../../src/web/page-router.js";
import { createJobLibraryRouter } from "../../src/auth/job-library-router.js";

if (!process.argv.includes("--synthetic")) throw new Error("Pass --synthetic for this isolated preview");
const w = createEmptyTestWorkspace(), data = seedCandidateScreening(w.service);
w.service.candidateScreeningService.record(data.request());
data.addCandidate("待补充依据的岗位");
const stale = data.addCandidate("资料更新后重新显示的岗位");
w.service.candidateScreeningService.record(data.request(stale.id));
w.service.jobLibraryService.saveDescription(stale.id, "Updated full JD", stale.sourceUrl!);
const web = new WorkspaceService(w.database, { ...w.identity, channel: "WEB", requestId: "synthetic-ui" });
const app = express(); app.use(express.json());
let origin = "";
app.get("/api/v1/session", (_request, response) => response.json({ csrfToken: "synthetic-preview-only" }));
app.use("/api/v1/job-search", createJobLibraryRouter(() => web, request => {
  if (request.headers.origin !== origin || request.headers["x-csrf-token"] !== "synthetic-preview-only") throw new Error("Invalid synthetic UI intent");
}));
app.use(createWebAssetsRouter()); app.use(createJobSearchPageRouter(() => web));
const server = app.listen(0, "127.0.0.1", () => {
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No preview port");
  origin = `http://127.0.0.1:${address.port}`;
  console.log(JSON.stringify({ list: `${origin}/workspace/job-search/jobs`, filtered: `${origin}/workspace/job-search/jobs?screening=FILTERED`,
    detail: `${origin}/workspace/job-search/jobs/${data.candidate.id}` }));
});
function stop() { server.close(() => { w.cleanup(); process.exit(0); }); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
process.stdin.setEncoding("utf8"); process.stdin.on("data", input => { if (String(input).trim() === "quit") stop(); });
