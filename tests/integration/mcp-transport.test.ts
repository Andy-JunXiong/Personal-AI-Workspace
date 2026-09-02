import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceHttpApp } from "../../src/mcp/http-app.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";

let httpServer: Server | undefined;
const cleanups: Array<() => void> = [];

afterEach(async () => {
  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer?.close((error) => (error ? reject(error) : resolve()));
    });
    httpServer = undefined;
  }
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("Streamable HTTP MCP transport", () => {
  it("discovers and invokes the frozen Spike tools plus Slice M1 inventory locally", async () => {
    const workspace = createTestWorkspace();
    cleanups.push(workspace.cleanup);
    const app = createWorkspaceHttpApp(workspace.service);
    httpServer = app.listen(0);
    await new Promise<void>((resolve) => httpServer?.once("listening", resolve));

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not expose a TCP port");
    }

    const client = new Client({ name: "paw-test-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${address.port}/mcp`),
    );

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "workspace_admit_transition",
        "workspace_create_job_application",
        "workspace_find_job_application",
        "workspace_get_project",
        "workspace_list_job_applications",
        "workspace_ping",
        "workspace_propose_transition",
        "workspace_record_observation",
        "workspace_update_job_application",
      ]);
      expect(
        tools.tools.find(
          (tool) => tool.name === "workspace_find_job_application",
        ),
      ).toMatchObject({
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          required: ["company", "role"],
        },
      });

      const ping = await client.callTool({
        name: "workspace_ping",
        arguments: {},
      });
      expect(ping.isError).not.toBe(true);

      const lookup = await client.callTool({
        name: "workspace_find_job_application",
        arguments: { company: " example   co ", role: "SOFTWARE ENGINEER" },
      });
      expect(lookup.isError).not.toBe(true);
      expect(lookup.structuredContent).toMatchObject({
        result: {
          matchStatus: "EXACT",
          matches: [{ projectId: workspace.projectId }],
        },
      });

      const creation = await client.callTool({
        name: "workspace_create_job_application",
        arguments: {
          company: "M1 Example Co",
          role: "Data Engineer",
          appliedDate: "2026-09-02",
          location: "Sydney",
          postingReference:
            "https://jobs.example.test/data-engineer?tracking=removed#apply",
          userConfirmed: true,
          authorityReference: "MCP test user requested registration",
          idempotencyKey: "mcp-create-job-application-1",
        },
      });
      expect(creation.isError).not.toBe(true);
      const creationResult = creation.structuredContent as {
        result: { project: { id: string; recordVersion: number } };
      };
      expect(creationResult.result.project.recordVersion).toBe(1);

      const listing = await client.callTool({
        name: "workspace_list_job_applications",
        arguments: {},
      });
      expect(listing.isError).not.toBe(true);
      expect(listing.structuredContent).toMatchObject({
        result: {
          totalCount: 2,
          truncated: false,
          includeClosed: false,
        },
      });

      const registrationUpdate = await client.callTool({
        name: "workspace_update_job_application",
        arguments: {
          projectId: creationResult.result.project.id,
          expectedRecordVersion: 1,
          role: "Senior Data Engineer",
          location: null,
          idempotencyKey: "mcp-update-job-application-1",
        },
      });
      expect(registrationUpdate.isError).not.toBe(true);
      expect(registrationUpdate.structuredContent).toMatchObject({
        result: {
          project: {
            lifecycleState: "APPLIED",
            lifecycleVersion: 1,
            recordVersion: 2,
            metadata: { role: "Senior Data Engineer", location: null },
          },
          changed: true,
        },
      });

      const project = await client.callTool({
        name: "workspace_get_project",
        arguments: { projectId: workspace.projectId },
      });
      expect(project.isError).not.toBe(true);
      expect(project.structuredContent).toMatchObject({
        result: {
          project: {
            id: workspace.projectId,
            lifecycleState: "APPLIED",
            lifecycleVersion: 1,
          },
        },
      });

      const observation = await client.callTool({
        name: "workspace_record_observation",
        arguments: {
          projectId: workspace.projectId,
          resourceType: "EMAIL",
          provider: "mcp-test-mail",
          externalId: "mcp-message-001",
          observedFacts: { recruiterReplied: true },
          observedAt: "2026-09-02T03:00:00.000Z",
          idempotencyKey: "mcp-observation-1",
        },
      });
      expect(observation.isError).not.toBe(true);
      const observationResult = observation.structuredContent as {
        result: { resource: { id: string }; projectStateChanged: boolean };
      };
      expect(observationResult.result.projectStateChanged).toBe(false);

      const proposal = await client.callTool({
        name: "workspace_propose_transition",
        arguments: {
          projectId: workspace.projectId,
          expectedLifecycleVersion: 1,
          toState: "RECRUITER_CONTACT",
          triggerType: "EXTERNAL_EVIDENCE",
          evidenceResourceIds: [observationResult.result.resource.id],
          rationale: "MCP test recruiter reply",
          idempotencyKey: "mcp-proposal-1",
        },
      });
      expect(proposal.isError).not.toBe(true);
      const proposalResult = proposal.structuredContent as {
        result: {
          transition: { id: string; status: string };
          projectStateChanged: boolean;
        };
      };
      expect(proposalResult.result.transition.status).toBe("PROPOSED");
      expect(proposalResult.result.projectStateChanged).toBe(false);

      const admission = await client.callTool({
        name: "workspace_admit_transition",
        arguments: {
          transitionId: proposalResult.result.transition.id,
          expectedLifecycleVersion: 1,
          userConfirmed: true,
          authorityReference: "MCP test explicit user instruction",
          idempotencyKey: "mcp-admission-1",
        },
      });
      expect(admission.isError).not.toBe(true);
      expect(admission.structuredContent).toMatchObject({
        result: {
          project: {
            lifecycleState: "RECRUITER_CONTACT",
            lifecycleVersion: 2,
          },
          transition: {
            status: "ADMITTED",
            admissionAuthorityType: "EXPLICIT_USER_DEV",
          },
          derivedTask: { taskKind: "RESPOND_TO_RECRUITER" },
        },
      });
    } finally {
      await client.close();
    }
  });
});
