import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { WorkspaceService } from "../application/workspace-service.js";
import type { JsonValue } from "../domain/types.js";
import { WorkspaceError } from "../domain/errors.js";

const resultOutputSchema = {
  result: z.record(z.string(), z.unknown()),
};

function successResult(result: object) {
  const structuredResult = result as Record<string, unknown>;
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredResult),
      },
    ],
    structuredContent: { result: structuredResult },
  };
}

function errorResult(error: unknown) {
  const code = error instanceof WorkspaceError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: { code, message } }),
      },
    ],
  };
}

export function createWorkspaceMcpServer(
  workspaceService: WorkspaceService,
): McpServer {
  const server = new McpServer(
    {
      name: "personal-ai-workspace",
      version: "0.1.0",
    },
    {
      instructions:
        "Models may record observations and propose transitions. Never call workspace_admit_transition from model inference alone. Call it only after the user explicitly requests or confirms admission, and include a short authority reference. No Spike 1A runtime lifecycle edge has deterministic auto-admission.",
    },
  );

  server.registerTool(
    "workspace_ping",
    {
      title: "Check Workspace availability",
      description:
        "Check that the Personal AI Workspace MCP server and its persistent database are available.",
      inputSchema: {},
      outputSchema: resultOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        return successResult(workspaceService.ping());
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "workspace_get_project",
    {
      title: "Get a Workspace Project",
      description:
        "Read one durable Project, including its lifecycle, observations, transitions, and open tasks.",
      inputSchema: {
        projectId: z.string().uuid(),
      },
      outputSchema: resultOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId }) => {
      try {
        return successResult(workspaceService.getProject(projectId));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "workspace_record_observation",
    {
      title: "Record a Project observation",
      description:
        "Persist attributable observed facts as a Resource without changing Project lifecycle state. This is an internal Workspace write.",
      inputSchema: {
        projectId: z.string().uuid(),
        resourceType: z.enum([
          "EMAIL",
          "DOCUMENT",
          "URL",
          "CALENDAR_EVENT",
          "NOTE",
          "OTHER",
        ]),
        provider: z.string().trim().min(1).max(100),
        externalId: z.string().trim().min(1).max(500).optional(),
        externalUri: z.string().trim().min(1).max(2_000).optional(),
        title: z.string().trim().min(1).max(500).optional(),
        observedFacts: z.record(z.string(), z.unknown()),
        observedAt: z.string().datetime({ offset: true }),
        idempotencyKey: z.string().trim().min(1).max(200),
      },
      outputSchema: resultOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return successResult(
          workspaceService.recordObservation({
            projectId: input.projectId,
            resourceType: input.resourceType,
            provider: input.provider,
            externalId: input.externalId ?? null,
            externalUri: input.externalUri ?? null,
            title: input.title ?? null,
            observedFacts: input.observedFacts as Record<string, JsonValue>,
            observedAt: input.observedAt,
            idempotencyKey: input.idempotencyKey,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "workspace_propose_transition",
    {
      title: "Propose a Project lifecycle transition",
      description:
        "Validate and persist a proposed lifecycle transition. A proposal never changes durable Project state and never grants admission authority.",
      inputSchema: {
        projectId: z.string().uuid(),
        expectedLifecycleVersion: z.number().int().min(1),
        toState: z.enum(["RECRUITER_CONTACT", "INTERVIEWING"]),
        triggerType: z.enum([
          "USER_ASSERTION",
          "EXTERNAL_EVIDENCE",
          "ACTION_OUTCOME",
        ]),
        evidenceResourceIds: z.array(z.string().uuid()).default([]),
        rationale: z.string().trim().min(1).max(1_000),
        idempotencyKey: z.string().trim().min(1).max(200),
      },
      outputSchema: resultOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return successResult(workspaceService.proposeTransition(input));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "workspace_admit_transition",
    {
      title: "Admit a transition with explicit user authority",
      description:
        "Admit one valid proposal only after the user explicitly requests or confirms admission. The model must not call this from inference alone. Spike 1A has no automatic runtime lifecycle admission rules.",
      inputSchema: {
        transitionId: z.string().uuid(),
        expectedLifecycleVersion: z.number().int().min(1),
        userConfirmed: z.literal(true).describe(
          "True only when the user explicitly requested or confirmed this admission.",
        ),
        authorityReference: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe(
            "A short attributable reference to the explicit user instruction or confirmation.",
          ),
        idempotencyKey: z.string().trim().min(1).max(200),
      },
      outputSchema: resultOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return successResult(
          workspaceService.admitTransition({
            transitionId: input.transitionId,
            expectedLifecycleVersion: input.expectedLifecycleVersion,
            authority: {
              type: "EXPLICIT_USER_DEV",
              confirmed: input.userConfirmed,
              reference: input.authorityReference,
            },
            idempotencyKey: input.idempotencyKey,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
