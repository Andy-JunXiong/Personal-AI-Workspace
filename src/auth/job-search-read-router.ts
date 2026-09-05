import { Router, type Request } from "express";
import type { WorkspaceService } from "../application/workspace-service.js";
import { ValidationError } from "../domain/errors.js";

function query(request: Request): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(request.query)) {
    if (typeof value !== "string") throw new ValidationError("Query parameters must be single values");
    if (key === "pageSize") {
      if (!/^\d+$/u.test(value)) throw new ValidationError("Invalid page size");
      values[key] = Number(value);
    } else values[key] = value;
  }
  return values;
}

export function createJobSearchReadRouter(serviceFor: (request: Request) => WorkspaceService,
  now: () => number = Date.now) {
  const router = Router();
  const read = (path: string, handler: (service: WorkspaceService, request: Request) => unknown) => {
    router.get(path, (request, response) => {
      // Each registered read resolves a fresh authenticated identity. Client
      // query/path values cannot select the Principal or Workspace.
      const service = serviceFor(request);
      response.json(handler(service, request));
    });
  };
  const noQuery = (request: Request): void => {
    if (Object.keys(request.query).length) throw new ValidationError("This read accepts no query parameters");
  };
  read("/today", (service, request) => {
    noQuery(request);
    return { ...service.todayQueryService.getToday(), asOf: new Date(now()).toISOString() };
  });
  read("/applications", (service, request) => service.jobSearchQueryService.listApplications(query(request)));
  read("/applications/:id", (service, request) => {
    noQuery(request);
    return service.jobSearchQueryService.getApplication(request.params.id as string);
  });
  read("/applications/:id/tasks", (service, request) =>
    service.jobSearchQueryService.listTasks(request.params.id as string, query(request)));
  read("/applications/:id/history", (service, request) =>
    service.jobSearchQueryService.listHistory(request.params.id as string, query(request)));
  read("/applications/:id/resources", (service, request) =>
    service.jobSearchQueryService.listResources(request.params.id as string, query(request)));
  read("/tasks/:id", (service, request) => {
    noQuery(request);
    return { task: service.jobSearchQueryService.getTask(request.params.id as string), asOf: new Date(now()).toISOString() };
  });
  return router;
}
