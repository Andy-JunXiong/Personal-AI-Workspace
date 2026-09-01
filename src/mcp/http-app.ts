import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import type { WorkspaceService } from "../application/workspace-service.js";
import { createWorkspaceMcpServer } from "./create-server.js";

export function createWorkspaceHttpApp(workspaceService: WorkspaceService) {
  const app = createMcpExpressApp();

  app.get("/healthz", (_request: Request, response: Response) => {
    try {
      const ping = workspaceService.ping();
      response.status(200).json({ status: "ok", database: ping.database });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  app.post("/mcp", async (request: Request, response: Response) => {
    const server = createWorkspaceMcpServer(workspaceService);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    response.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "mcp_request_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const methodNotAllowed = (_request: Request, response: Response) => {
    response.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  return app;
}
