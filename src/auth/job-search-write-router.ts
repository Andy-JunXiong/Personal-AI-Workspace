import { Router, type Request } from "express";
import { z } from "zod";
import type { WorkspaceService } from "../application/workspace-service.js";

const completionSchema = z.object({
  expectedRecordVersion: z.number().int().min(1),
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
  return router;
}
