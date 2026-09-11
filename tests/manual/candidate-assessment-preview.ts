// Local synthetic UI preview; no private database or external provider access.
import express from "express";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";
import { seedCandidateAssessmentViews } from "../helpers/candidate-assessment-fixture.js";
import { createJobSearchPageRouter, createWebAssetsRouter } from "../../src/web/page-router.js";

if (!process.argv.includes("--synthetic")) throw new Error("Pass --synthetic for this isolated preview");
const w = createEmptyTestWorkspace();
const fixtures = seedCandidateAssessmentViews(w.service);
const app = express();
app.use(createWebAssetsRouter());
app.use(createJobSearchPageRouter(() => w.service));
const server = app.listen(0, "127.0.0.1", (error?: Error) => {
  if (error) { w.cleanup(); console.error(error.message); process.exit(1); }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Preview has no local port");
  const origin = `http://127.0.0.1:${address.port}`;
  console.log(JSON.stringify({ list: `${origin}/workspace/job-search/jobs`,
    current: `${origin}/workspace/job-search/jobs/${fixtures.current.id}`,
    stale: `${origin}/workspace/job-search/jobs/${fixtures.stale.id}` }));
});
function stop() { server.close(() => { w.cleanup(); process.exit(0); }); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
process.stdin.setEncoding("utf8"); process.stdin.on("data", input => { if (String(input).trim() === "quit") stop(); });
