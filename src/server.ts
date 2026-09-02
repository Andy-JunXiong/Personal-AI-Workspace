import { loadConfig } from "./config.js";
import { WorkspaceService } from "./application/workspace-service.js";
import { createWorkspaceHttpApp } from "./mcp/http-app.js";
import { openDatabase } from "./persistence/database.js";

const config = loadConfig();
const database = openDatabase(config.databasePath, config.migrationsDirectory);
const workspaceService = new WorkspaceService(
  database,
  config.developmentPrincipal,
  { timeZone: config.timeZone },
);
const identity = workspaceService.ensureDevelopmentIdentity();
const app = createWorkspaceHttpApp(workspaceService);

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

function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));
  httpServer.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
