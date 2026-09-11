import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const inputSchema = z.object({ projectId: z.uuid(), resumeVariantId: z.uuid().optional() });
const historySchema = z.object({
  returned: z.number().int().nonnegative(), total: z.number().int().nonnegative(),
  truncated: z.boolean(),
});
const resultSchema = z.object({
  project: z.object({ id: z.uuid(), projectType: z.literal("job_application") }),
  preparationContext: z.object({
    contractVersion: z.literal("job-application-preparation-context-v0.1"),
    readAt: z.iso.datetime(),
    missingItems: z.array(z.string()),
    workingResume: z.object({
      status: z.enum(["SELECTED", "MISSING", "SELECTION_REQUIRED"]),
      options: z.array(z.object({ id: z.uuid(), recordVersion: z.number().int().positive() })),
      selected: z.object({
        id: z.uuid(), recordVersion: z.number().int().positive(),
        selectionBasis: z.enum(["EXPLICIT_ID", "SINGLE_APPLICATION_VARIANT"]),
      }).nullable(),
    }),
    submittedResume: z.object({
      status: z.enum(["MISSING", "FILE_CONFIRMED", "VERSION_CONFIRMED", "MULTIPLE_CONFIRMATIONS"]),
    }),
    history: z.object({ resources: historySchema, transitions: historySchema, openTasks: historySchema }),
  }),
});

// The report deliberately contains no JD, resume body, company name or source text.
export async function checkApplicationPreparation(
  client: Pick<Client, "callTool">,
  input: { projectId: string; resumeVariantId?: string },
) {
  const args = inputSchema.parse(input);
  const started = performance.now();
  const response = await client.callTool({ name: "workspace_get_project", arguments: args });
  if (response.isError) throw new Error("Application preparation read failed; check the exact IDs and access.");
  const parsed = z.object({ result: resultSchema }).safeParse(response.structuredContent);
  if (!parsed.success) throw new Error("Application preparation response does not satisfy the R2 read contract.");
  const { project, preparationContext: context } = parsed.data.result;
  if (project.id !== args.projectId) throw new Error("Application preparation returned a different project.");
  if (args.resumeVariantId && (context.workingResume.selected?.id !== args.resumeVariantId
    || context.workingResume.selected.selectionBasis !== "EXPLICIT_ID")) {
    throw new Error("Application preparation did not return the explicitly selected resume.");
  }
  return {
    readContractPassed: true,
    toolCalls: 1,
    elapsedMs: Math.round(performance.now() - started),
    responseBytes: Buffer.byteLength(JSON.stringify(response), "utf8"),
    projectId: project.id,
    readAt: context.readAt,
    missingItems: context.missingItems,
    workingResume: context.workingResume,
    submittedResumeStatus: context.submittedResume.status,
    history: context.history,
    realApplicationUsefulness: "NOT_ASSESSED",
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    endpoint: { type: "string" }, "project-id": { type: "string" },
    "resume-variant-id": { type: "string" },
  }, strict: true, allowPositionals: false });
  if (!values.endpoint || !values["project-id"]) {
    throw new Error("Usage: node --import tsx scripts/check-application-preparation.ts --endpoint https://host/mcp --project-id UUID [--resume-variant-id UUID]");
  }
  const input = inputSchema.parse({ projectId: values["project-id"], resumeVariantId: values["resume-variant-id"] });
  const endpoint = new URL(values.endpoint);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash
    || (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:"
      && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)))) {
    throw new Error("Use an HTTPS endpoint (HTTP is allowed on loopback), without credentials, query or fragment.");
  }
  const token = process.env.PAW_MCP_BEARER_TOKEN;
  const client = new Client({ name: "paw-preparation-check", version: "0.1.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint, {
      requestInit: { redirect: "error", ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
    }));
    console.log(JSON.stringify(await checkApplicationPreparation(client, input), null, 2));
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Transport errors can embed private URLs or response content.
    console.error("Preparation check failed. Verify the endpoint, access token, exact IDs and deployed R2 contract. Required: --endpoint URL --project-id UUID; optional: --resume-variant-id UUID.");
    process.exitCode = 1;
  });
}
