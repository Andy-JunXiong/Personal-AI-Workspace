import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gmailModelKey, loadGmailConfig } from "../../src/gmail/config.js";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
it("reads only the API key from dotenv and gives a mounted secret precedence", () => {
  const dir = mkdtempSync(join(tmpdir(), "paw-env-test-")); dirs.push(dir);
  const dotenv = join(dir, ".env"), secret = join(dir, "secret");
  writeFileSync(dotenv, '\uFEFFOPENAI_API_KEY="test-key"\r\nPAW_WEB_WRITES_ENABLED=true\r\nPAW_GMAIL_ENABLED=true\r\n');
  const env = { PAW_OPENAI_ENV_FILE: dotenv };
  expect(gmailModelKey(env)).toBe("test-key");
  expect(loadGmailConfig(env)).toBeUndefined();
  expect(env).toEqual({ PAW_OPENAI_ENV_FILE: dotenv });
  writeFileSync(secret, "mounted-key\n");
  expect(gmailModelKey({ ...env, OPENAI_API_KEY: "environment-key", PAW_OPENAI_API_KEY_FILE: secret })).toBe("mounted-key");
  expect(gmailModelKey({ ...env, OPENAI_API_KEY: "environment-key" })).toBe("environment-key");
  writeFileSync(secret, "");
  expect(() => gmailModelKey({ ...env, PAW_OPENAI_API_KEY_FILE: secret })).toThrow();
  expect(() => gmailModelKey({ PAW_OPENAI_ENV_FILE: "relative.env" })).toThrow();
});
