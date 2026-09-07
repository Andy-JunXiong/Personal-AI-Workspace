import { loadConfig } from "./config.js";
import { WorkspaceService } from "./application/workspace-service.js";
import { createWorkspaceHttpApp } from "./mcp/http-app.js";
import { openDatabase } from "./persistence/database.js";
import type { Server } from "node:http";
import { loadWebConfig } from "./auth/web-config.js";
import { googleLoginProvider } from "./auth/oidc.js";
import { createWebAuthApp } from "./auth/web-auth-app.js";
import { loadGmailConfig } from "./gmail/config.js";
import { GmailConnections } from "./gmail/connections.js";
import { googleGmailAuthorization, GmailReader, OpenAiMailInterpreter } from "./gmail/providers.js";
import { GmailMcpReader } from "./gmail/mcp-reader.js";

const config = loadConfig();
let webConfig: ReturnType<typeof loadWebConfig>;
let webConfigurationInvalid = false;
try { webConfig = loadWebConfig(); }
catch {
  webConfigurationInvalid = true;
  console.error(JSON.stringify({ level: "error", event: "web_configuration_invalid" }));
}
const database = openDatabase(config.databasePath, config.migrationsDirectory);
const workspaceService = new WorkspaceService(
  database,
  config.developmentPrincipal,
  { timeZone: config.timeZone },
);
// Web-enabled startup must find the existing identity, never create a substitute.
const identity = webConfig || webConfigurationInvalid
  ? workspaceService.resolveDevelopmentIdentity()
  : workspaceService.ensureDevelopmentIdentity();
let gmailMcpReader: GmailMcpReader | undefined;
const app = createWorkspaceHttpApp(workspaceService, { webOrigin: webConfig?.origin, gmailReader: () => gmailMcpReader });

const httpServer = app.listen(config.port, () => {
  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  console.log(
    JSON.stringify({
      level: "info",
      event: "server_started",
      port,
      mcpEndpoint: "/mcp",
      workspaceId: identity.workspaceId,
    }),
  );
});

let webServer: Server | undefined;
let shuttingDown = false;
if (webConfig) {
  const selected = webConfig;
  void googleLoginProvider(selected.clientId, selected.clientSecret, selected.origin)
    .then(async (provider) => {
      if (shuttingDown) return;
      const gmailConfig = loadGmailConfig();
      const gmail = gmailConfig ? {
        connections: new GmailConnections(gmailConfig.connectionDirectory, gmailConfig.encryptionKey),
        authorization: await googleGmailAuthorization(selected.clientId, selected.clientSecret, selected.origin),
        reader: new GmailReader(), interpreter: new OpenAiMailInterpreter(gmailConfig.apiKey, gmailConfig.model),
      } : undefined;
      if (shuttingDown) return;
      const web = createWebAuthApp({ database, provider, origin: selected.origin,
        bootstrapEnabled: selected.bootstrapEnabled, writesEnabled: selected.writesEnabled,
        timeZone: config.timeZone, gmail });
      if (gmail) gmailMcpReader = new GmailMcpReader(gmail.connections, gmail.authorization);
      // Local S1 only: no Docker/public ingress change accompanies this listener.
      webServer = web.listen(selected.port, selected.bindHost);
      webServer.on("error", () => {
        console.error(JSON.stringify({ level: "error", event: "web_listener_failed" }));
      });
    }).catch(() => {
      console.error(JSON.stringify({ level: "error", event: "web_login_provider_unavailable" }));
    });
}

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));
  const close = (server?: Server) => new Promise<void>((done) => {
    if (!server?.listening) { done(); return; }
    server.close(() => done());
  });
  void Promise.all([close(webServer), close(httpServer)]).then(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
