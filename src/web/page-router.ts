import { Router, type Request } from "express";
import { fileURLToPath } from "node:url";
import type { WorkspaceService } from "../application/workspace-service.js";
import { AuthorizationError, NotFoundError, ValidationError } from "../domain/errors.js";
import { CursorError } from "../application/read-pagination.js";
import { applicationListView, applicationView, errorView, loginView, rootPath, taskView, todayView } from "./views.js";

export function createWebAssetsRouter() {
  const router = Router();
  for (const name of ["workspace.css", "workspace.js"]) {
    router.get(`/assets/${name}`, (_request, response) => {
      response.sendFile(fileURLToPath(new URL(`./assets/${name}`, import.meta.url)), { cacheControl: false });
    });
  }
  return router;
}

function query(request: Request, allowed: string[]): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(request.query)) {
    if (!allowed.includes(key) || typeof value !== "string") throw new ValidationError("Invalid page query");
    if (key === "pageSize") {
      if (!/^\d+$/u.test(value)) throw new ValidationError("Invalid page size");
      values[key] = Number(value);
    } else if (key !== "lifecycle" || value !== "") values[key] = value;
  }
  return values;
}

export function createJobSearchPageRouter(serviceFor: (request: Request) => WorkspaceService,
  timeZone = "Australia/Sydney", now: () => number = Date.now) {
  const router = Router();
  router.get(["/", rootPath], (_request, response) => response.redirect(303, `${rootPath}/today`));
  const page = (path: string, render: (service: WorkspaceService, request: Request) => string) => {
    router.get(`${rootPath}${path}`, (request, response) => {
      let authenticated = false;
      // Keep login return paths object-only. Filters are intentionally discarded.
      const returnTo = /^\/workspace\/job-search\/(?:today|applications(?:\/[a-f0-9-]{36})?|tasks\/[a-f0-9-]{36})$/u.test(request.path)
        ? request.path : `${rootPath}/applications`;
      try {
        const service = serviceFor(request);
        authenticated = true;
        response.type("html").send(render(service, request));
      } catch (error) {
        if (error instanceof AuthorizationError) {
          response.status(401).type("html").send(loginView(returnTo));
          return;
        }
        const status = error instanceof NotFoundError ? 404 : error instanceof CursorError ? 409
          : error instanceof ValidationError ? 400 : 503;
        // Reload the first page with valid filters after a cursor expires.
        const params = new URLSearchParams(request.originalUrl.split("?")[1]);
        params.delete("cursor");
        const reload = status === 409 && params.size ? `${returnTo}?${params}` : returnTo;
        response.status(status).type("html").send(errorView(status, reload, authenticated));
      }
    });
  };
  page("/today", (service, request) => { query(request, []); return todayView(service, new Date(now()).toISOString()); });
  page("/applications", (service, request) => applicationListView(service,
    query(request, ["q", "status", "lifecycle", "sort", "cursor", "pageSize"]), timeZone));
  page("/applications/:id", (service, request) => {
    const input = query(request, ["section", "status", "cursor", "pageSize"]);
    if (input.section !== undefined && !["tasks", "resources", "history"].includes(String(input.section))) {
      throw new ValidationError("Invalid section");
    }
    if (input.section === "resources" && input.status !== undefined) throw new ValidationError("Invalid resource filter");
    return applicationView(service, request.params.id as string, input, timeZone);
  });
  page("/tasks/:id", (service, request) => { query(request, []); return taskView(service,
    request.params.id as string, timeZone, new Date(now()).toISOString()); });
  return router;
}
