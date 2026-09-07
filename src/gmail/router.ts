import { Router, type Request } from "express";
import { z } from "zod";
import { randomToken, equalToken } from "../auth/session-store.js";
import { ActionDeniedError } from "../domain/errors.js";
import type { IdentityContext } from "../domain/types.js";
import type { WorkspaceService } from "../application/workspace-service.js";
import type { LoginChecks } from "../auth/oidc.js";
import { GmailChecks, type GmailRuntime } from "./checks.js";

export function createGmailRouter(runtime: GmailRuntime, origin: string,
  identityFor: (request: Request, write?: boolean) => IdentityContext & { csrfToken: string },
  serviceFor: (request: Request) => WorkspaceService, now = Date.now) {
  const router = Router(), checks = new GmailChecks(runtime, now);
  const pending = new Map<string, { checks: LoginChecks; identity: IdentityContext & { csrfToken: string };
    slot: number; projectId: string; expires: number }>();
  router.post("/api/v1/gmail/check-all", (req, res) => {
    const identity = identityFor(req, true);
    z.object({}).strict().parse(req.body);
    res.status(202).json({ batch: checks.startBatch(identity, serviceFor(req)) });
  });
  router.get("/api/v1/gmail/check-all", (req, res) => {
    const identity = identityFor(req);
    res.json({ batch: checks.currentBatch(identity) });
  });
  router.post("/api/v1/gmail/connect", async (req, res) => {
    const identity = identityFor(req, true);
    const input = z.object({ slot: z.union([z.literal(1), z.literal(2)]), projectId: z.string().uuid() }).strict().parse(req.body);
    serviceFor(req).jobSearchQueryService.getApplication(input.projectId);
    for (const [key, value] of pending) if (value.expires <= now()) pending.delete(key);
    if (pending.size >= 100) throw new Error("Authorization capacity reached");
    const transaction = { state: randomToken(), nonce: randomToken(), codeVerifier: randomToken() };
    const url = await runtime.authorization.authorizationUrl(transaction);
    pending.set(transaction.state, { checks: transaction, identity, ...input, expires: now() + 600_000 });
    res.json({ url: url.toString() });
  });
  router.get("/auth/gmail/callback", async (req, res) => {
    const identity = identityFor(req), callback = new URL(req.originalUrl, origin);
    const states = callback.searchParams.getAll("state"), state = states[0] ?? "";
    const entry = pending.get(state);
    if (states.length !== 1 || !entry || entry.expires <= now()
      || entry.identity.workspaceId !== identity.workspaceId || entry.identity.principalId !== identity.principalId
      || !equalToken(entry.identity.csrfToken, identity.csrfToken)) throw new ActionDeniedError("Invalid Gmail authorization session");
    pending.delete(state);
    const connection = await runtime.authorization.authenticate(callback, entry.checks);
    // Revalidate the browser session after the asynchronous OAuth exchange.
    const current = identityFor(req);
    if (!equalToken(current.csrfToken, entry.identity.csrfToken)) throw new ActionDeniedError("Session changed");
    runtime.connections.put(current, entry.slot, connection);
    res.redirect(303, `/workspace/job-search/applications/${entry.projectId}`);
  });
  router.post("/api/v1/gmail/disconnect", (req, res) => {
    const identity = identityFor(req, true);
    const { slot } = z.object({ slot: z.union([z.literal(1), z.literal(2)]) }).strict().parse(req.body);
    runtime.connections.remove(identity, slot);
    res.status(204).end();
  });
  router.post("/api/v1/gmail/applications/:id/check", (req, res) => {
    const identity = identityFor(req, true), projectId = z.string().uuid().parse(req.params.id);
    z.object({}).strict().parse(req.body);
    res.status(202).json(checks.start(identity, serviceFor(req), projectId));
  });
  router.get("/api/v1/gmail/applications/:id/check", (req, res) => {
    const identity = identityFor(req), projectId = z.string().uuid().parse(req.params.id);
    serviceFor(req).jobSearchQueryService.getApplication(projectId);
    res.json({ run: checks.current(identity, projectId) });
  });
  return router;
}
