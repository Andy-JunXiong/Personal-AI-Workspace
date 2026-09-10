import { Router, type Request } from "express";
import { z } from "zod";
import type { WorkspaceService } from "../application/workspace-service.js";
import { platformWatchFindingKeySchema } from "../application/platform-watch-service.js";

const completionSchema = z.object({
  expectedRecordVersion: z.number().int().min(1),
  intentKey: z.string().uuid(),
}).strict();

const candidateDecisionSchema = z.object({
  action: z.enum(["SAVE", "DISMISS", "RESTORE"]),
  expectedRecordVersion: z.number().int().min(1),
  intentKey: z.string().uuid(),
}).strict();

const candidateLinkSchema = z.object({
  projectId: z.string().uuid(),
  intentKey: z.string().uuid(),
}).strict();

export function createJobSearchWriteRouter(
  serviceFor: (request: Request) => WorkspaceService,
  now: () => number = Date.now,
) {
  const router = Router();
  router.post("/tasks/:id/complete", (request, response) => {
    const service = serviceFor(request);
    const taskId = z.string().uuid().parse(request.params.id);
    const input = completionSchema.parse(request.body);
    const result = service.taskService.completeTaskFromWeb({
      taskId,
      expectedRecordVersion: input.expectedRecordVersion,
      intentKey: input.intentKey,
    });
    response.json({ ...result, asOf: new Date(now()).toISOString() });
  });
  router.post("/candidates/:id/decide", (request, response) => {
    const service = serviceFor(request);
    const candidateId = z.string().uuid().parse(request.params.id);
    const input = candidateDecisionSchema.parse(request.body);
    const result = service.candidateService.decideCandidateFromWeb({
      candidateId,
      action: input.action,
      expectedRecordVersion: input.expectedRecordVersion,
      intentKey: input.intentKey,
    });
    response.json({ ...result, asOf: new Date(now()).toISOString() });
  });
  router.post("/candidates/:id/link", (request, response) => {
    const service = serviceFor(request);
    const candidateId = z.string().uuid().parse(request.params.id);
    const input = candidateLinkSchema.parse(request.body);
    const result = service.candidateService.linkCandidateFromWeb({
      candidateId,
      projectId: input.projectId,
      intentKey: input.intentKey,
    });
    response.json({ ...result, asOf: new Date(now()).toISOString() });
  });
  return router;
}

/** Scoped report actions; the caller must verify the session, origin and CSRF token. */
export function createPlatformWatchWriteRouter(
  serviceFor: (request: Request) => WorkspaceService,
  now: () => number = Date.now,
) {
  const router = Router();
  router.post("/platform-watch", (request, response) => {
    const service = serviceFor(request);
    const result = service.platformWatchService.recordReportFromWeb(request.body);
    response.json({ ...result, asOf: new Date(now()).toISOString() });
  });
  router.post("/platform-watch/:id/findings/:key/decision", (request, response) => {
    const service = serviceFor(request);
    const reportId = z.string().uuid().parse(request.params.id);
    const findingKey = platformWatchFindingKeySchema.parse(request.params.key);
    const result = service.platformWatchService.decideFindingFromWeb(reportId, findingKey, request.body);
    response.json({ ...result, asOf: new Date(now()).toISOString() });
  });
  return router;
}
