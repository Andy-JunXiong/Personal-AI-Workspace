import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("cloud Web deployment contract", () => {
  it("keeps the base runtime MCP-only with browser writes explicitly off", () => {
    const compose = read("deploy/cloud/compose.yaml");
    expect(compose).toContain('PAW_WEB_ENABLED: "false"');
    expect(compose).toContain('PAW_WEB_WRITES_ENABLED: "false"');
    expect(compose).toContain('"127.0.0.1:3000:3000"');
    expect(compose).not.toContain("0.0.0.0:");
    expect(compose).not.toContain("3001:3001");
  });

  it("adds a loopback-only read surface with a read-only Google secret", () => {
    const compose = read("deploy/cloud/compose.web.yaml");
    expect(compose).toContain('PAW_WEB_ENABLED: "true"');
    expect(compose).toContain('PAW_WEB_WRITES_ENABLED: "false"');
    expect(compose).toContain('"127.0.0.1:3001:3001"');
    expect(compose).not.toContain("0.0.0.0:");
    expect(compose).toContain("source: /etc/paw/secrets/google-client-secret");
    expect(compose).toContain("target: /run/secrets/google-client-secret");
    expect(compose).toContain("read_only: true");
  });

  it("requires a separate overlay to enable browser writes", () => {
    const compose = read("deploy/cloud/compose.web-writes.yaml");
    expect(compose).toContain('PAW_WEB_WRITES_ENABLED: "true"');
    expect(compose).not.toContain("ports:");
    expect(compose).not.toContain("PAW_WEB_ENABLED");
  });

  it("routes only the reviewed hostname to Web and rejects all other ingress", () => {
    const config = read("deploy/cloud/web-tunnel.yml.example");
    expect(config).toContain("service: http://127.0.0.1:3001");
    expect(config).toContain("httpHostHeader: workspace.example.com");
    expect(config).toMatch(/- service: http_status:404\s*$/u);
    expect(config).not.toContain("127.0.0.1:3000");
    expect(config).not.toContain("/mcp");
    expect(config).not.toContain("/healthz");
  });

  it("isolates the tunnel credential and makes off-mode stop-publication first", () => {
    const service = read("deploy/cloud/systemd/paw-web-tunnel.service");
    const mode = read("deploy/cloud/web-mode.sh");
    const rollback = read("deploy/cloud/rollback.sh");
    const health = read("deploy/cloud/web-health.sh");
    expect(service).toContain("DynamicUser=yes");
    expect(service).toContain("LoadCredential=web-tunnel-credentials:");
    expect(service).toContain("--credentials-file %d/web-tunnel-credentials");
    expect(service).toContain("--no-autoupdate");
    expect(service).not.toContain("--token");
    expect(service).toContain("NoNewPrivileges=yes");
    expect(mode).toContain("Refusing to remove the Web listener while paw-web-tunnel.service is active");
    expect(mode).toContain("owned by container UID 1000 with mode 0400");
    expect(rollback).toContain("Refusing image rollback while paw-web-tunnel.service is active");
    expect(health).toContain('[[ "${status}" == 401 ]]');
    expect(health).toContain("content-security-policy:");
    expect(health).toContain("x-content-type-options:");
  });

  it("fails closed before binding an inconsistent or write-enabled public surface", () => {
    const preflight = read("deploy/cloud/web-binding-preflight.sh");
    expect(preflight).toContain('require_file "${paw_env}" 0 600');
    expect(preflight).toContain('require_file "${google_secret}" 1000 400');
    expect(preflight).toContain('require_file "${tunnel_credential}" 0 600');
    expect(preflight).toContain('[[ "${web_origin}" == "https://${web_host}" ]]');
    expect(preflight).toContain('[[ "${web_writes_enabled}" == false ]]');
    expect(preflight).toContain('[[ "${web_bootstrap_enabled}" == false ]]');
    expect(preflight).toContain('service: http://127.0.0.1:3001');
    expect(preflight).toContain('service: http_status:404');
    expect(preflight).toContain("paw-web-tunnel.service must be inactive");
    expect(preflight).toContain('cloudflared tunnel --config "${tunnel_config}" ingress validate');
    expect(preflight).not.toContain("cat \"${google_secret}\"");
    expect(preflight).not.toContain("cat \"${tunnel_credential}\"");
  });
});
