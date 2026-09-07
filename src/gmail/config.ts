import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parseEnv } from "node:util";

export interface GmailConfig {
  apiKey: string;
  model: string;
  encryptionKey: Buffer;
  connectionDirectory: string;
}

function secret(path: string | undefined): string {
  if (!path || !isAbsolute(path)) throw new Error("Gmail integration requires absolute secret file paths");
  const value = readFileSync(path, "utf8").trim();
  if (!value || /\s/u.test(value)) throw new Error("Invalid integration secret");
  return value;
}

// Read only the model credential from the local dotenv file. Never copy its
// contents into process.env or let it enable integrations/browser writes.
export function gmailModelKey(env: NodeJS.ProcessEnv = process.env): string {
  if (env.PAW_OPENAI_API_KEY_FILE !== undefined) return secret(env.PAW_OPENAI_API_KEY_FILE);
  let value = env.OPENAI_API_KEY;
  if (value === undefined) {
    const path = env.PAW_OPENAI_ENV_FILE ?? resolve(".env");
    if (!isAbsolute(path)) throw new Error("Model dotenv path must be absolute");
    try { value = parseEnv(readFileSync(path, "utf8").replace(/^\uFEFF/u, "")).OPENAI_API_KEY; }
    catch { throw new Error("Cannot read model credential configuration"); }
  }
  const key = value?.trim();
  if (!key || /\s/u.test(key)) throw new Error("Missing or invalid model API key");
  return key;
}

export function loadGmailConfig(env: NodeJS.ProcessEnv = process.env): GmailConfig | undefined {
  if (env.PAW_GMAIL_ENABLED === undefined || env.PAW_GMAIL_ENABLED === "false") return undefined;
  if (env.PAW_GMAIL_ENABLED !== "true") throw new Error("PAW_GMAIL_ENABLED must be true or false");
  const model = env.PAW_GMAIL_MODEL?.trim();
  const connectionDirectory = env.PAW_GMAIL_CONNECTION_DIR;
  if (!model || !connectionDirectory || !isAbsolute(connectionDirectory)) throw new Error("Gmail model and private connection directory required");
  const encoded = secret(env.PAW_GMAIL_ENCRYPTION_KEY_FILE);
  if (!/^[a-f0-9]{64}$/u.test(encoded)) throw new Error("Gmail encryption key must be 32 bytes encoded as hex");
  return { apiKey: gmailModelKey(env), model,
    encryptionKey: Buffer.from(encoded, "hex"), connectionDirectory };
}
