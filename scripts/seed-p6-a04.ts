import Database from "better-sqlite3";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { WorkspaceService } from "../src/application/workspace-service.js";
import { loadConfig } from "../src/config.js";

const COMPANY_PREFIX = "SYNTHETIC TEST - P6-A04 Company";
const ROLE = "Synthetic Engineer";
const LOCATION = "Synthetic";
const POSTING_PREFIX = "https://synthetic.p6-a04.test/posting/";
const DEFAULT_COUNT = 106;
const MAX_COUNT = 200;

export interface SeedP6A04Result {
  requestedCount: number;
  createdCount: number;
  replayedCount: number;
  workspaceId: string;
  projectIds: string[];
}

/**
 * Bounded synthetic A04 bulk seed. Creates only `SYNTHETIC TEST - P6-A04`
 * Job Applications through the same service authority/idempotency path the MCP
 * surface uses. It never writes observations, candidates, links, tasks,
 * transitions beyond the initial APPLIED admission, or any non-synthetic row.
 * The configured development principal must already be mapped to an existing
 * Workspace; a missing mapping fails closed.
 */
export function runSeedP6A04(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
): SeedP6A04Result {
  const allowed = ["--db", "--authority-reference", "--count"];
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (
      !key ||
      !allowed.includes(key) ||
      !value ||
      value.startsWith("--") ||
      options.has(key)
    ) {
      throw new Error("Invalid or duplicate seed argument");
    }
    options.set(key, value);
  }

  const dbPath = options.get("--db");
  const authorityReference = options.get("--authority-reference")?.trim();
  if (!dbPath || !authorityReference) {
    throw new Error("Required argument: --db and --authority-reference");
  }

  const countArgument = options.get("--count");
  const count = countArgument === undefined
    ? DEFAULT_COUNT
    : /^\d+$/u.test(countArgument) ? Number(countArgument) : Number.NaN;
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count must be an integer between 1 and ${MAX_COUNT}`);
  }

  const config = loadConfig({ ...environment, PAW_DB_PATH: dbPath });
  // Fail closed: never create, migrate or seed an unprepared database.
  const database = new Database(config.databasePath, { fileMustExist: true });
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  try {
    const workspaceService = new WorkspaceService(
      database,
      config.developmentPrincipal,
    );
    // Fail closed: the development principal must already be mapped.
    const identity = workspaceService.resolveDevelopmentIdentity();

    const projectIds: string[] = [];
    let createdCount = 0;
    let replayedCount = 0;
    for (let index = 0; index < count; index += 1) {
      const suffix = index.toString().padStart(3, "0");
      const result = workspaceService.createJobApplication({
        company: `${COMPANY_PREFIX} ${suffix}`,
        role: ROLE,
        appliedDate: null,
        location: LOCATION,
        postingReference: `${POSTING_PREFIX}${suffix}`,
        authority: {
          type: "EXPLICIT_USER_DEV",
          confirmed: true,
          reference: authorityReference,
        },
        idempotencyKey: `p6-a04-seed-${suffix}`,
      });
      if (result.creationStatus !== "CREATED") {
        throw new Error(`Unexpected duplicate for synthetic seed ${suffix}`);
      }
      projectIds.push(result.project.id);
      if (result.replayed) replayedCount += 1;
      else createdCount += 1;
    }

    return {
      requestedCount: count,
      createdCount,
      replayedCount,
      workspaceId: identity.workspaceId,
      projectIds,
    };
  } finally {
    database.close();
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  try {
    console.log(JSON.stringify(runSeedP6A04(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  }
}
