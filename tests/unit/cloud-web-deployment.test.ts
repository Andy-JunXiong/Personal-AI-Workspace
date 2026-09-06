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
    expect(compose).toContain('PAW_WEB_BIND_HOST: "0.0.0.0"');
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
    expect(mode).toContain("for ingress_service in paw-web-tunnel.service paw-web-ingress.service");
    expect(mode).toContain("active|activating|reloading|deactivating");
    expect(mode).toContain("Refusing to remove the Web listener while ${ingress_service} is ${ingress_state}");
    expect(mode).toContain("owned by container UID 1000 with mode 0400");
    expect(rollback).toContain("for ingress_service in paw-web-tunnel.service paw-web-ingress.service");
    expect(rollback).toContain("active|activating|reloading|deactivating");
    expect(rollback).toContain("Refusing image rollback while ${ingress_service} is ${ingress_state}");
    expect(health).toContain('[[ "${status}" == 401 ]]');
    expect(health).toContain("for candidate in /etc/paw/web-ingress.env /etc/paw/web-tunnel.env");
    expect(health).toContain("Expected exactly one readable Web ingress environment file");
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

  it("provides an isolated HTTPS-only Route 53 ingress for the AI Radar subdomain", () => {
    const config = read("deploy/cloud/caddy/Caddyfile");
    const service = read("deploy/cloud/systemd/paw-web-ingress.service");
    expect(config).toContain("admin off");
    expect(config).toContain("auto_https disable_redirects");
    expect(config).toContain("{$PAW_WEB_HOST}");
    expect(config).toContain("bind 0.0.0.0");
    expect(config).toContain("disable_http_challenge");
    expect(config).toContain("reverse_proxy 127.0.0.1:3001");
    expect(config).not.toContain("127.0.0.1:3000");
    expect(config).not.toMatch(/(^|\n)\s*log\s*\{/u);
    expect(service).toContain("DynamicUser=yes");
    expect(service).toContain("EnvironmentFile=/etc/paw/web-ingress.env");
    expect(service).toContain("caddy validate --config /etc/caddy/paw.Caddyfile --adapter caddyfile");
    expect(service).not.toContain("--envfile");
    expect(service).toContain("CapabilityBoundingSet=CAP_NET_BIND_SERVICE");
    expect(service).toContain("NoNewPrivileges=yes");
    expect(service).toContain("ProtectSystem=strict");
    expect(service).not.toContain("ExecReload=");
  });

  it("fails closed on Route 53 drift and verifies the live HTTPS boundary", () => {
    const environment = read("deploy/cloud/web-ingress.env.example");
    const preflight = read("deploy/cloud/web-route53-preflight.sh");
    const health = read("deploy/cloud/web-ingress-health.sh");
    expect(environment).toContain("PAW_WEB_ZONE=ai-radar-lab.com");
    expect(environment).toContain("PAW_WEB_HOST=workspace.ai-radar-lab.com");
    expect(environment).toContain("PAW_WEB_EXPECTED_IPV4=203.0.113.10");
    expect(preflight).toContain('[[ "${web_zone}" == ai-radar-lab.com ]]');
    expect(preflight).toContain('[[ "${web_host}" == "workspace.${web_zone}" ]]');
    expect(preflight).toContain('[[ "${web_origin}" == "https://${web_host}" ]]');
    expect(preflight).toContain('[[ "${web_writes_enabled}" == false ]]');
    expect(preflight).toContain('[[ "${web_bootstrap_enabled}" == false ]]');
    expect(preflight).toContain("installed Caddyfile differs from the reviewed repository copy");
    expect(preflight).toContain("Route 53 must resolve only PAW_WEB_HOST");
    expect(preflight).toContain("active|activating|reloading|deactivating");
    expect(preflight).toContain('XDG_DATA_HOME="${validation_root}/data"');
    expect(health).toContain('--resolve "${PAW_WEB_HOST}:443:127.0.0.1"');
    expect(health).toContain("active|activating|reloading|deactivating");
    expect(health).toContain("Unexpected port 80 listener");
    expect(health).toContain("/mcp /healthz /admin");
  });

  it("rehearses recovery with isolated current and previous image copies", () => {
    const rehearsal = read("deploy/cloud/rehearse-database-copy.sh");
    const fingerprint = read("deploy/cloud/database-logical-fingerprint.mjs");

    expect(rehearsal).toContain("/srv/paw/recovery-rehearsal");
    expect(rehearsal).toContain("--network none");
    expect(rehearsal).toContain("--read-only");
    expect(rehearsal).toContain("--cap-drop ALL");
    expect(rehearsal).toContain("PAW_WEB_ENABLED=false");
    expect(rehearsal).toContain('"${before_hash}" != "${after_hash}"');
    expect(rehearsal).not.toContain("--publish");
    expect(rehearsal).not.toContain("PAW_MCP_BEARER_TOKEN");
    expect(rehearsal).not.toContain("PAW_GOOGLE_CLIENT_SECRET");
    expect(rehearsal).not.toContain("deploy/cloud/restore.sh");
    expect(fingerprint).toContain("readonly: true");
    expect(fingerprint).toContain('database.pragma("query_only = ON")');
    expect(fingerprint).toContain("name NOT LIKE 'sqlite_%'");
  });

  it("samples Web capacity without inheriting credentials or invoking writes", () => {
    const capacity = read("deploy/cloud/sample-web-capacity.sh");

    expect(capacity).toContain("Capacity window active");
    expect(capacity).toContain('"${script_dir}/backup.sh"');
    expect(capacity).toContain("docker stats --no-stream");
    expect(capacity).toContain("http://127.0.0.1:3000/healthz");
    expect(capacity).toContain("/workspace/job-search/today");
    expect(capacity).toContain('[[ "${status}" == 401 ]]');
    expect(capacity).toContain("RestartCount");
    expect(capacity).toContain("OOMKilled");
    expect(capacity).not.toContain("PAW_MCP_BEARER_TOKEN");
    expect(capacity).not.toContain("/complete");
  });
});
