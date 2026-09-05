import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

export interface WebConfig {
  origin: string;
  port: number;
  clientId: string;
  clientSecret: string;
  bootstrapEnabled: boolean;
}

function flag(value: string | undefined, name: string): boolean {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`${name} must be true or false`);
}

export function loadWebConfig(environment: NodeJS.ProcessEnv = process.env): WebConfig | undefined {
  if (!flag(environment.PAW_WEB_ENABLED, "PAW_WEB_ENABLED")) return undefined;
  if (flag(environment.PAW_WEB_WRITES_ENABLED, "PAW_WEB_WRITES_ENABLED")) {
    throw new Error("Browser business writes are not implemented in S1-01");
  }
  const origin = environment.PAW_WEB_ORIGIN ?? "";
  let url: URL;
  try { url = new URL(origin); } catch { throw new Error("PAW_WEB_ORIGIN must be an HTTPS origin"); }
  if (url.protocol !== "https:" || url.origin !== origin) {
    throw new Error("PAW_WEB_ORIGIN must be an exact HTTPS origin without a path");
  }
  const portValue = environment.PAW_WEB_PORT ?? "3001";
  const port = Number(portValue);
  if (!/^\d+$/u.test(portValue) || port < 1 || port > 65_535) {
    throw new Error("Invalid PAW_WEB_PORT");
  }
  const clientId = environment.PAW_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("PAW_GOOGLE_CLIENT_ID is required");
  const secretFile = environment.PAW_GOOGLE_CLIENT_SECRET_FILE;
  if (!secretFile || !isAbsolute(secretFile)) {
    throw new Error("PAW_GOOGLE_CLIENT_SECRET_FILE must be an absolute private file path");
  }
  let clientSecret: string;
  try { clientSecret = readFileSync(secretFile, "utf8").trim(); }
  catch { throw new Error("Cannot read Google client secret file"); }
  if (!clientSecret || clientSecret.length > 16_384 || /\s/u.test(clientSecret)) {
    throw new Error("Invalid Google client secret file contents");
  }
  return { origin, port, clientId, clientSecret,
    bootstrapEnabled: flag(environment.PAW_WEB_BOOTSTRAP_ENABLED, "PAW_WEB_BOOTSTRAP_ENABLED") };
}
