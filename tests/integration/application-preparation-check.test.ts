import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { checkApplicationPreparation } from "../../scripts/check-application-preparation.js";
import { createWorkspaceHttpApp } from "../../src/mcp/http-app.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { resumeFixture } from "../helpers/resume-fixture.js";

it("measures exact MCP reads, reports unresolved choices, and excludes private resume content", async () => {
  const workspace = createTestWorkspace();
  const client = new Client({ name: "preparation-acceptance-test", version: "1.0.0" });
  const server = createWorkspaceHttpApp(workspace.service).listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    workspace.service.resumeService.initialize(Buffer.from("PKsynthetic"), resumeFixture(), "https://drive.google.com/file/d/private-template/view");
    const variants = ["Private first name", "Private second name"].map(name =>
      workspace.service.resumeService.createVariant({ name, targetType: "APPLICATION", targetId: workspace.projectId,
        expectedBaseVersion: 1, intentKey: randomUUID() }).variant!);
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)));
    const before = workspace.database.prepare("SELECT total_changes() AS n").get();
    const unresolved = await checkApplicationPreparation(client, { projectId: workspace.projectId });
    expect(unresolved).toMatchObject({ readContractPassed: true, toolCalls: 1,
      workingResume: { status: "SELECTION_REQUIRED", selected: null }, realApplicationUsefulness: "NOT_ASSESSED" });
    expect(unresolved.missingItems).toContain("WORKING_RESUME_SELECTION");
    expect(unresolved.responseBytes).toBeGreaterThan(0);
    const selected = await checkApplicationPreparation(client, { projectId: workspace.projectId, resumeVariantId: variants[0]!.id });
    expect(selected.workingResume.selected).toEqual({ id: variants[0]!.id, recordVersion: 1, selectionBasis: "EXPLICIT_ID" });
    expect(selected.missingItems).not.toContain("WORKING_RESUME_SELECTION");
    expect(JSON.stringify(selected)).not.toContain("Private first name");
    expect(JSON.stringify(selected)).not.toContain("private-template");
    expect(selected.workingResume.selected).not.toHaveProperty("content");
    await expect(checkApplicationPreparation(client, { projectId: workspace.projectId, resumeVariantId: randomUUID() }))
      .rejects.toThrow("read failed");
    expect(workspace.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    workspace.cleanup();
  }
});

it("rejects an old server response instead of recording an R2 pass", async () => {
  await expect(checkApplicationPreparation({ callTool: async () => ({ content: [], structuredContent: { result: {} } }) },
    { projectId: randomUUID() })).rejects.toThrow("R2 read contract");
});
