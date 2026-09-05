import Database from "better-sqlite3";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.js";
import { IdentityLinks } from "../src/auth/identity-links.js";

// Deliberately no HTTP equivalent. Run only on a privately controlled host.
export function runIdentityAdmin(args: string[], environment: NodeJS.ProcessEnv = process.env): unknown {
  const [action, ...rest] = args;
  if (!["inspect", "link", "revoke"].includes(action ?? "")) {
    throw new Error("Expected inspect, link or revoke");
  }
  const allowed = action === "inspect" ? ["--db", "--pending"] :
    action === "link" ? ["--db", "--pending", "--principal", "--workspace"] :
    ["--db", "--issuer", "--subject", "--principal", "--workspace"];
  const options = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!key || !allowed.includes(key) || !value || value.startsWith("--") || options.has(key)) {
      throw new Error("Invalid or duplicate administration argument");
    }
    options.set(key, value);
  }
  for (const key of allowed) if (!options.has(key)) throw new Error(`Required argument: ${key}`);
  const config = loadConfig({ ...environment, PAW_DB_PATH: options.get("--db") });
  // No create/migrate/seed here. A missing or unprepared database fails closed.
  const database = new Database(config.databasePath, { fileMustExist: true });
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  try {
    const links = new IdentityLinks(database);
    if (action === "inspect") return links.inspectPending(options.get("--pending")!);
    const target = { principalId: options.get("--principal")!, workspaceId: options.get("--workspace")! };
    if (action === "link") links.linkPending(options.get("--pending")!, target, target.principalId);
    else links.revoke({ issuer: options.get("--issuer")!, subject: options.get("--subject")! }, target, target.principalId);
    return { status: "ok", action };
  } finally { database.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runIdentityAdmin(process.argv.slice(2)))); }
  catch { console.error("Identity administration failed; check arguments, existing target and pending expiry."); process.exitCode = 1; }
}
