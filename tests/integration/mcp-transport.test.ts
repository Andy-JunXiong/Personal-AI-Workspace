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
  it("discovers and invokes frozen Spike/M1 tools plus Slice M2 locally", async () => {
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
        "workspace_create_task",
        "workspace_find_job_application",
        "workspace_get_project",
        "workspace_get_today",
        "workspace_list_job_applications",
        "workspace_ping",
        "workspace_propose_transition",
        "workspace_record_observation",
        "workspace_update_job_application",
        "workspace_update_task",
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
      expect(
        tools.tools.find(
          (tool) => tool.name === "workspace_create_job_application",
        ),
      ).toMatchObject({
        inputSchema: {
          properties: {
            allowDistinctDuplicate: { const: true },
            postingReference: expect.any(Object),
          },
        },
      });
      expect(
        tools.tools.find((tool) => tool.name === "workspace_get_today"),
      ).toMatchObject({
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: { type: "object" },
      });
      expect(
        tools.tools.find((tool) => tool.name === "workspace_create_task"),
      ).toMatchObject({
        inputSchema: {
          required: [
            "projectId",
            "title",
            "taskKind",
            "priority",
            "userConfirmed",
            "authorityReference",
            "idempotencyKey",
          ],
          properties: {
            projectId: { type: "string", format: "uuid" },
            dueAt: expect.any(Object),
            taskKind: {
              enum: [
                "FOLLOW_UP",
                "PREPARE_FOR_INTERVIEW",
                "RESPOND_TO_RECRUITER",
                "OTHER",
              ],
            },
          },
        },
      });
      expect(
        tools.tools.find(
          (tool) => tool.name === "workspace_propose_transition",
        ),
      ).toMatchObject({
        inputSchema: {
          properties: {
            toState: {
              enum: [
                "RECRUITER_CONTACT",
                "INTERVIEWING",
                "OFFER",
                "ACCEPTED",
                "REJECTED",
                "WITHDRAWN",
              ],
            },
          },
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

      const duplicateCreation = await client.callTool({
        name: "workspace_create_job_application",
        arguments: {
          company: "  m1   example co ",
          role: "DATA ENGINEER",
          userConfirmed: true,
          authorityReference:
            "Explicit creation authority does not override duplicates",
          idempotencyKey: "mcp-duplicate-job-application-1",
        },
      });
      expect(duplicateCreation.isError).not.toBe(true);
      expect(duplicateCreation.structuredContent).toMatchObject({
        result: {
          creationStatus: "POSSIBLE_DUPLICATE",
          matches: [{ projectId: creationResult.result.project.id }],
          replayed: false,
        },
      });

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

      const taskCreation = await client.callTool({
        name: "workspace_create_task",
        arguments: {
          projectId: creationResult.result.project.id,
          title: "Send M2 follow-up",
          taskKind: "FOLLOW_UP",
          priority: "HIGH",
          userConfirmed: true,
          authorityReference: "MCP test explicit Task request",
          idempotencyKey: "mcp-task-create-1",
        },
      });
      expect(taskCreation.isError).not.toBe(true);
      const taskResult = taskCreation.structuredContent as {
        result: {
          task: {
            id: string;
            projectId: string;
            title: string;
            taskKind: string;
            priority: string;
            dueAt: string | null;
            recordVersion: number;
          };
          replayed: boolean;
        };
      };
      expect(taskResult.result).toMatchObject({
        task: {
          projectId: creationResult.result.project.id,
          title: "Send M2 follow-up",
          taskKind: "FOLLOW_UP",
          priority: "HIGH",
          dueAt: null,
          recordVersion: 1,
        },
        replayed: false,
      });

      const taskReplay = await client.callTool({
        name: "workspace_create_task",
        arguments: {
          projectId: creationResult.result.project.id,
          title: "Send M2 follow-up",
          taskKind: "FOLLOW_UP",
          priority: "HIGH",
          userConfirmed: true,
          authorityReference: "MCP test explicit Task request",
          idempotencyKey: "mcp-task-create-1",
        },
      });
      expect(taskReplay.isError).not.toBe(true);
      expect(taskReplay.structuredContent).toMatchObject({
        result: {
          task: { id: taskResult.result.task.id },
          replayed: true,
        },
      });

      const createdProject = await client.callTool({
        name: "workspace_get_project",
        arguments: { projectId: creationResult.result.project.id },
      });
      expect(createdProject.isError).not.toBe(true);
      expect(createdProject.structuredContent).toMatchObject({
        result: {
          project: {
            id: creationResult.result.project.id,
            status: "ACTIVE",
            lifecycleState: "APPLIED",
          },
          openTasks: [{ id: taskResult.result.task.id }],
          totalCounts: { openTasks: 1 },
        },
      });

      const taskUpdate = await client.callTool({
        name: "workspace_update_task",
        arguments: {
          taskId: taskResult.result.task.id,
          expectedRecordVersion: taskResult.result.task.recordVersion,
          status: "IN_PROGRESS",
          userConfirmed: true,
          authorityReference: "MCP test explicit Task update",
          idempotencyKey: "mcp-task-update-1",
        },
      });
      expect(taskUpdate.isError).not.toBe(true);
      expect(taskUpdate.structuredContent).toMatchObject({
        result: { task: { status: "IN_PROGRESS", recordVersion: 2 } },
      });

      const today = await client.callTool({
        name: "workspace_get_today",
        arguments: {},
      });
      expect(today.isError).not.toBe(true);
      expect(today.structuredContent).toMatchObject({
        result: {
          timeZone: "Australia/Sydney",
          attention: expect.any(Array),
          upcoming: expect.any(Array),
          applicationsWithoutOpenTask: expect.any(Array),
          recentLifecycleChanges: expect.any(Array),
        },
      });

      const interviewingProposal = await client.callTool({
        name: "workspace_propose_transition",
        arguments: {
          projectId: workspace.projectId,
          expectedLifecycleVersion: 2,
          toState: "INTERVIEWING",
          triggerType: "USER_ASSERTION",
          evidenceResourceIds: [],
          rationale: "MCP test interview progression",
          idempotencyKey: "mcp-m3-interview-proposal",
        },
      });
      expect(interviewingProposal.isError).not.toBe(true);
      const interviewingProposalResult = interviewingProposal.structuredContent as {
        result: { transition: { id: string } };
      };
      const interviewingAdmission = await client.callTool({
        name: "workspace_admit_transition",
        arguments: {
          transitionId: interviewingProposalResult.result.transition.id,
          expectedLifecycleVersion: 2,
          userConfirmed: true,
          authorityReference: "MCP test explicit interview admission",
          idempotencyKey: "mcp-m3-interview-admission",
        },
      });
      expect(interviewingAdmission.isError).not.toBe(true);
      expect(interviewingAdmission.structuredContent).toMatchObject({
        result: {
          project: { lifecycleState: "INTERVIEWING", lifecycleVersion: 3 },
          derivedTask: { taskKind: "PREPARE_FOR_INTERVIEW", priority: "HIGH" },
        },
      });

      const offerProposal = await client.callTool({
        name: "workspace_propose_transition",
        arguments: {
          projectId: workspace.projectId,
          expectedLifecycleVersion: 3,
          toState: "OFFER",
          triggerType: "USER_ASSERTION",
          evidenceResourceIds: [],
          rationale: "MCP test offer progression",
          idempotencyKey: "mcp-m3-offer-proposal",
        },
      });
      const offerProposalResult = offerProposal.structuredContent as {
        result: { transition: { id: string } };
      };
      const offerAdmission = await client.callTool({
        name: "workspace_admit_transition",
        arguments: {
          transitionId: offerProposalResult.result.transition.id,
          expectedLifecycleVersion: 3,
          userConfirmed: true,
          authorityReference: "MCP test explicit offer admission",
          idempotencyKey: "mcp-m3-offer-admission",
        },
      });
      expect(offerAdmission.isError).not.toBe(true);
      expect(offerAdmission.structuredContent).toMatchObject({
        result: {
          project: { lifecycleState: "OFFER", lifecycleVersion: 4 },
          derivedTask: { taskKind: "REVIEW_OFFER", priority: "HIGH" },
        },
      });

      const acceptedProposal = await client.callTool({
        name: "workspace_propose_transition",
        arguments: {
          projectId: workspace.projectId,
          expectedLifecycleVersion: 4,
          toState: "ACCEPTED",
          triggerType: "USER_ASSERTION",
          evidenceResourceIds: [],
          rationale: "MCP test accepted outcome",
          idempotencyKey: "mcp-m3-accepted-proposal",
        },
      });
      const acceptedProposalResult = acceptedProposal.structuredContent as {
        result: { transition: { id: string } };
      };
      const acceptedAdmission = await client.callTool({
        name: "workspace_admit_transition",
        arguments: {
          transitionId: acceptedProposalResult.result.transition.id,
          expectedLifecycleVersion: 4,
          userConfirmed: true,
          authorityReference: "MCP test explicit accepted admission",
          idempotencyKey: "mcp-m3-accepted-admission",
        },
      });
      expect(acceptedAdmission.isError).not.toBe(true);
      expect(acceptedAdmission.structuredContent).toMatchObject({
        result: {
          project: {
            status: "CLOSED",
            lifecycleState: "ACCEPTED",
            lifecycleVersion: 5,
          },
          derivedTask: null,
        },
      });

      const closedProject = await client.callTool({
        name: "workspace_get_project",
        arguments: { projectId: workspace.projectId },
      });
      expect(closedProject.structuredContent).toMatchObject({
        result: { openTasks: [], totalCounts: { openTasks: 0 } },
      });
    } finally {
      await client.close();
    }
  });
});
