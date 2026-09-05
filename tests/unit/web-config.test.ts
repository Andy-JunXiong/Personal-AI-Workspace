import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { loadWebConfig } from "../../src/auth/web-config.js";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

it("defaults web off and refuses malformed enabled configuration and browser writes", () => {
  expect(loadWebConfig({})).toBeUndefined();
  expect(() => loadWebConfig({ PAW_WEB_ENABLED: "yes" })).toThrow(/true or false/u);
  expect(() => loadWebConfig({ PAW_WEB_ENABLED: "true", PAW_WEB_ORIGIN: "http://public.example.test" })).toThrow(/HTTPS/u);
  expect(() => loadWebConfig({ PAW_WEB_ENABLED: "true", PAW_WEB_WRITES_ENABLED: "true" })).toThrow(/not implemented/u);
});

it("loads a private secret file without accepting URL credentials, paths or loose port parsing", () => {
  const directory = mkdtempSync(join(tmpdir(), "paw-auth-config-")); directories.push(directory);
  const secret = join(directory, "client-secret"); writeFileSync(secret, "synthetic-secret\n");
  const environment = { PAW_WEB_ENABLED: "true", PAW_WEB_ORIGIN: "https://workspace.example.test",
    PAW_GOOGLE_CLIENT_ID: "synthetic-client", PAW_GOOGLE_CLIENT_SECRET_FILE: secret };
  expect(loadWebConfig(environment)).toMatchObject({ port: 3001, bootstrapEnabled: false, clientSecret: "synthetic-secret" });
  for (const origin of ["https://workspace.example.test/", "https://user:pass@workspace.example.test", "https://workspace.example.test/path"]) {
    expect(() => loadWebConfig({ ...environment, PAW_WEB_ORIGIN: origin })).toThrow(/exact HTTPS/u);
  }
  expect(() => loadWebConfig({ ...environment, PAW_WEB_PORT: "3001suffix" })).toThrow(/PORT/u);
  expect(() => loadWebConfig({ ...environment, PAW_GOOGLE_CLIENT_SECRET_FILE: "relative-secret" })).toThrow(/absolute/u);
});
